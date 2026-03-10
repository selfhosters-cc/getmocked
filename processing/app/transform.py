import cv2
import numpy as np
from PIL import Image


def apply_perspective_transform(
    template: Image.Image,
    design: Image.Image,
    corners: list[dict],
    displacement_intensity: float = 0.0,
    texture_data: dict | None = None,
) -> Image.Image:
    """Apply a design onto a template image using perspective warp."""
    template_cv = np.array(template.convert("RGB"))
    design_cv = np.array(design.convert("RGBA"))

    h, w = design_cv.shape[:2]

    # Source corners (design image corners)
    src_pts = np.float32([[0, 0], [w, 0], [w, h], [0, h]])

    # Destination corners (where to place on template)
    dst_pts = np.float32([[c["x"], c["y"]] for c in corners])

    # Compute perspective transform matrix
    matrix = cv2.getPerspectiveTransform(src_pts, dst_pts)

    # Warp the design
    template_h, template_w = template_cv.shape[:2]
    warped = cv2.warpPerspective(
        design_cv, matrix, (template_w, template_h),
        flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_TRANSPARENT
    )

    # Apply displacement if requested
    if displacement_intensity > 0:
        warped = _apply_displacement(template_cv, warped, displacement_intensity)

    # Composite warped design onto template
    result = _composite(template_cv, warped)

    return Image.fromarray(result)


def _apply_displacement(
    template: np.ndarray, warped: np.ndarray, intensity: float
) -> np.ndarray:
    """Apply texture displacement based on template surface analysis."""
    gray = cv2.cvtColor(template, cv2.COLOR_RGB2GRAY)

    # Detect edges/texture in the template
    edges = cv2.Canny(gray, 50, 150)
    blur = cv2.GaussianBlur(edges.astype(np.float32), (15, 15), 0)
    blur = blur / (blur.max() + 1e-6)  # normalize

    # Use the texture map to modulate the design brightness
    if warped.shape[2] == 4:
        mask = warped[:, :, 3] > 0
        for c in range(3):
            channel = warped[:, :, c].astype(np.float32)
            displacement = 1.0 - (blur * intensity * 0.3)
            channel[mask] = (channel[mask] * displacement[mask]).clip(0, 255)
            warped[:, :, c] = channel.astype(np.uint8)

    return warped


def _composite(background: np.ndarray, overlay: np.ndarray) -> np.ndarray:
    """Composite RGBA overlay onto RGB background."""
    if overlay.shape[2] == 4:
        alpha = overlay[:, :, 3:4].astype(np.float32) / 255.0
        fg = overlay[:, :, :3].astype(np.float32)
        bg = background.astype(np.float32)
        result = (fg * alpha + bg * (1 - alpha)).astype(np.uint8)
        return result
    return overlay[:, :, :3]
