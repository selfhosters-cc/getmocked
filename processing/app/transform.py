import cv2
import numpy as np
from PIL import Image


def _prepare_design_alpha(design: Image.Image) -> np.ndarray:
    """Convert design to RGBA, preserving native alpha or creating one.

    If the design already has an alpha channel, use it as-is.
    If it doesn't (RGB/JPEG), the design likely has a solid background that
    should not be visible in the mockup — make near-white pixels transparent.
    """
    if design.mode == "RGBA":
        return np.array(design)

    rgba = np.array(design.convert("RGBA"))

    # Design has no native alpha — remove near-white background
    # Check if the image has a predominantly white/light border (background indicator)
    rgb = rgba[:, :, :3].astype(np.float32)
    # Lightness: average of RGB channels
    lightness = rgb.mean(axis=2)

    # Sample border pixels to detect if there's a solid background
    h, w = lightness.shape
    border = np.concatenate([
        lightness[0, :], lightness[-1, :],   # top and bottom rows
        lightness[:, 0], lightness[:, -1],    # left and right columns
    ])
    border_mean = border.mean()

    if border_mean > 220:
        # Background appears to be white/near-white — make light pixels transparent
        # Use a threshold: pixels close to the border color become transparent
        threshold = 240
        bg_mask = (rgb[:, :, 0] > threshold) & (rgb[:, :, 1] > threshold) & (rgb[:, :, 2] > threshold)
        # Smooth the mask edges to avoid harsh cutoffs
        bg_mask_float = bg_mask.astype(np.float32)
        bg_mask_smooth = cv2.GaussianBlur(bg_mask_float, (5, 5), 0)
        rgba[:, :, 3] = ((1.0 - bg_mask_smooth) * 255).clip(0, 255).astype(np.uint8)

    return rgba


def _apply_curvature(
    design: np.ndarray,
    curvature: float,
    axis: str,
    dst_pts: np.ndarray,
) -> np.ndarray:
    """Apply barrel/pincushion distortion to simulate wrapping around a cylinder.

    curvature: -1 to 1. Positive = convex (mug), negative = concave.
    axis: 'auto', 'horizontal', or 'vertical'.
      - horizontal: distort along x-axis (vertical cylinder like a mug)
      - vertical: distort along y-axis (horizontal cylinder like a tubular pillow)
      - auto: pick based on overlay quad aspect ratio
    """
    if abs(curvature) < 0.01:
        return design

    h, w = design.shape[:2]

    # Determine effective axis
    if axis == "auto":
        # Estimate quad dimensions
        top_w = np.linalg.norm(dst_pts[1] - dst_pts[0])
        bot_w = np.linalg.norm(dst_pts[2] - dst_pts[3])
        left_h = np.linalg.norm(dst_pts[3] - dst_pts[0])
        right_h = np.linalg.norm(dst_pts[2] - dst_pts[1])
        quad_w = (top_w + bot_w) / 2
        quad_h = (left_h + right_h) / 2
        effective_axis = "vertical" if quad_w > quad_h * 1.3 else "horizontal"
    else:
        effective_axis = axis

    # Build remap coordinates (vectorized for performance)
    map_x, map_y = _build_curvature_maps(w, h, curvature, effective_axis)

    result = cv2.remap(
        design, map_x, map_y,
        interpolation=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(0, 0, 0, 0),
    )
    return result


def _build_curvature_maps(
    w: int, h: int, curvature: float, axis: str
) -> tuple[np.ndarray, np.ndarray]:
    """Build remap coordinate arrays (vectorized for performance)."""
    cols = np.arange(w, dtype=np.float32)
    rows = np.arange(h, dtype=np.float32)

    if axis == "horizontal":
        # Normalize cols to [-1, 1]
        t = (cols / max(w - 1, 1)) * 2.0 - 1.0
        t_new = t * (1.0 + curvature * t * t)
        mapped_cols = (t_new + 1.0) / 2.0 * max(w - 1, 1)
        # Broadcast to full grid
        map_x = np.tile(mapped_cols, (h, 1))
        map_y = np.tile(rows.reshape(-1, 1), (1, w))
    else:
        t = (rows / max(h - 1, 1)) * 2.0 - 1.0
        t_new = t * (1.0 + curvature * t * t)
        mapped_rows = (t_new + 1.0) / 2.0 * max(h - 1, 1)
        map_x = np.tile(cols, (h, 1))
        map_y = np.tile(mapped_rows.reshape(-1, 1), (1, w))

    return map_x, map_y


def apply_perspective_transform(
    template: Image.Image,
    design: Image.Image,
    corners: list[dict],
    displacement_intensity: float = 0.0,
    transparency: float = 0.0,
    curvature: float = 0.0,
    curve_axis: str = "auto",
    texture_data: dict | None = None,
) -> Image.Image:
    """Apply a design onto a template image using perspective warp."""
    if not corners or len(corners) != 4:
        # No overlay configured, return template as-is
        return template.convert("RGB")

    template_cv = np.array(template.convert("RGB"))

    # Ensure design has alpha channel, preserving native transparency
    design_cv = _prepare_design_alpha(design)

    # Destination corners (where to place on template)
    dst_pts = np.float32([[c["x"], c["y"]] for c in corners])

    # Fit design into overlay quad while preserving aspect ratio
    design_cv = _fit_design_to_quad(design_cv, dst_pts)

    # Apply curvature distortion before perspective warp
    if abs(curvature) > 0.01:
        design_cv = _apply_curvature(design_cv, curvature, curve_axis, dst_pts)
        print(f"[curvature] intensity={curvature}, axis={curve_axis}")

    h, w = design_cv.shape[:2]

    # Source corners (fitted design image corners)
    src_pts = np.float32([[0, 0], [w, 0], [w, h], [0, h]])

    # Compute perspective transform matrix
    matrix = cv2.getPerspectiveTransform(src_pts, dst_pts)

    # Warp the design - use zeros output so alpha is 0 outside warped region
    template_h, template_w = template_cv.shape[:2]
    warped = cv2.warpPerspective(
        design_cv, matrix, (template_w, template_h),
        flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT,
        borderValue=(0, 0, 0, 0),
    )

    # Apply transparency — reduce alpha of the warped design
    if transparency > 0:
        opacity = 1.0 - min(transparency, 1.0)
        warped[:, :, 3] = (warped[:, :, 3].astype(np.float32) * opacity).astype(np.uint8)

    # Apply displacement (luminance modulation) if requested
    if displacement_intensity > 0:
        warped = _apply_displacement(template_cv, warped, displacement_intensity)

    # Composite — blend strength scales with displacement intensity
    # 0% displacement → pure overlay (pasted), 100% → strong multiply (printed)
    blend = 0.05 + displacement_intensity * 0.55  # range: 0.05 to 0.60
    result = _composite(template_cv, warped, blend_strength=blend)

    return Image.fromarray(result)


def _fit_design_to_quad(design: np.ndarray, dst_pts: np.ndarray) -> np.ndarray:
    """Pad design image to match overlay quad aspect ratio, preserving design proportions."""
    dh, dw = design.shape[:2]

    # Estimate overlay quad dimensions from average edge lengths
    # corners order: TL, TR, BR, BL
    top_w = np.linalg.norm(dst_pts[1] - dst_pts[0])
    bot_w = np.linalg.norm(dst_pts[2] - dst_pts[3])
    left_h = np.linalg.norm(dst_pts[3] - dst_pts[0])
    right_h = np.linalg.norm(dst_pts[2] - dst_pts[1])

    quad_w = (top_w + bot_w) / 2
    quad_h = (left_h + right_h) / 2

    if quad_w < 1 or quad_h < 1:
        return design

    quad_aspect = quad_w / quad_h
    design_aspect = dw / dh

    if abs(quad_aspect - design_aspect) < 0.01:
        # Aspects already match
        return design

    # Calculate canvas size that matches quad aspect ratio
    if design_aspect > quad_aspect:
        # Design is wider than quad — add vertical padding
        canvas_w = dw
        canvas_h = int(round(dw / quad_aspect))
    else:
        # Design is taller than quad — add horizontal padding
        canvas_h = dh
        canvas_w = int(round(dh * quad_aspect))

    # Center design on transparent canvas
    canvas = np.zeros((canvas_h, canvas_w, 4), dtype=np.uint8)
    y_off = (canvas_h - dh) // 2
    x_off = (canvas_w - dw) // 2
    canvas[y_off:y_off + dh, x_off:x_off + dw] = design

    return canvas


def _apply_displacement(
    template: np.ndarray, warped: np.ndarray, intensity: float
) -> np.ndarray:
    """Apply fabric surface lighting to the design using luminance mapping.

    Instead of edge detection (which only catches fine lines), this uses the
    template's actual brightness to modulate the design — folds and shadows
    darken the design, highlights brighten it, just like real fabric printing.
    """
    if warped.shape[2] != 4:
        return warped

    mask = warped[:, :, 3] > 0
    if not mask.any():
        return warped

    gray = cv2.cvtColor(template, cv2.COLOR_RGB2GRAY).astype(np.float32)

    # Smooth to remove noise/texture grain, keep broad folds and shadows
    gray = cv2.GaussianBlur(gray, (31, 31), 0)

    # Normalize relative to the overlay region's average brightness so the
    # effect is about folds/shadows, not the fabric's overall color
    region_mean = gray[mask].mean()
    if region_mean < 1:
        return warped

    # luminance_map: >1 where brighter than average, <1 where darker
    luminance_map = gray / region_mean

    # Amplify the contrast — subtle fabric folds need boosting to be visible
    # This pushes values further from 1.0 (e.g. 0.95 → 0.85, 1.05 → 1.15)
    luminance_map = 1.0 + (luminance_map - 1.0) * 3.0

    lum_min = luminance_map[mask].min()
    lum_max = luminance_map[mask].max()
    print(f"[displacement] intensity={intensity}, region_mean={region_mean:.1f}, "
          f"lum_range=[{lum_min:.3f}, {lum_max:.3f}] (amplified)")

    # Clamp to reasonable range to avoid blowout
    luminance_map = np.clip(luminance_map, 0.3, 1.7)

    # Blend between neutral (1.0) and the luminance map based on intensity
    # intensity=0 → no effect, intensity=1 → full luminance modulation
    modulation = 1.0 + (luminance_map - 1.0) * intensity

    for c in range(3):
        channel = warped[:, :, c].astype(np.float32)
        channel[mask] = (channel[mask] * modulation[mask]).clip(0, 255)
        warped[:, :, c] = channel.astype(np.uint8)

    return warped


def _composite(
    background: np.ndarray, overlay: np.ndarray, blend_strength: float = 0.35
) -> np.ndarray:
    """Composite RGBA overlay onto RGB background with fabric-realistic blending.

    Combines normal alpha blending with a multiply blend so the template's
    surface texture, folds, and shadows show through the design — making it
    look printed on the fabric rather than pasted on top.

    blend_strength: 0.0 = pure overlay (pasted look), higher = more fabric
                    interaction. 0.30-0.40 is a good range for apparel.
    """
    if overlay.shape[2] != 4:
        return overlay[:, :, :3]

    alpha = overlay[:, :, 3:4].astype(np.float32) / 255.0
    fg = overlay[:, :, :3].astype(np.float32)
    bg = background.astype(np.float32)

    # Normal composite (design on top)
    normal = fg

    # Multiply composite (design * background) — lets fabric texture through
    multiply = (fg * bg) / 255.0

    # Blend between normal and multiply for a printed-on look
    blended_fg = normal * (1 - blend_strength) + multiply * blend_strength

    result = (blended_fg * alpha + bg * (1 - alpha)).astype(np.uint8)
    return result
