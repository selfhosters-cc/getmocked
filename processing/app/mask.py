import cv2
import numpy as np
from PIL import Image


def detect_product_mask(image: Image.Image) -> Image.Image:
    """Auto-detect product region by identifying studio background.
    Works with white/light backgrounds via thresholding, falls back to
    GrabCut edge-based detection for darker or non-uniform backgrounds.
    Returns a grayscale mask: 255 = product, 0 = background, with soft edges.
    """
    img = np.array(image.convert("RGB"))
    lab = cv2.cvtColor(img, cv2.COLOR_RGB2LAB)
    l_channel = lab[:, :, 0]

    h, w = l_channel.shape
    border = np.concatenate([
        l_channel[0, :], l_channel[-1, :],
        l_channel[:, 0], l_channel[:, -1],
    ])
    bg_mean = float(border.mean())
    bg_std = float(border.std())

    if bg_mean >= 180 and bg_std <= 30:
        # Light uniform background — use threshold-based detection
        threshold = bg_mean - max(20, bg_std * 3)
        product_mask = (l_channel < threshold).astype(np.uint8) * 255

        a_channel = lab[:, :, 1].astype(np.float32) - 128
        b_channel = lab[:, :, 2].astype(np.float32) - 128
        saturation = np.sqrt(a_channel ** 2 + b_channel ** 2)
        color_mask = (saturation > 15).astype(np.uint8) * 255

        combined = np.maximum(product_mask, color_mask)
    else:
        # Non-white or non-uniform background — use GrabCut
        margin_x = max(1, w // 10)
        margin_y = max(1, h // 10)
        rect = (margin_x, margin_y, w - 2 * margin_x, h - 2 * margin_y)
        gc_mask = np.zeros((h, w), np.uint8)
        bgd_model = np.zeros((1, 65), np.float64)
        fgd_model = np.zeros((1, 65), np.float64)
        cv2.grabCut(img, gc_mask, rect, bgd_model, fgd_model, 5, cv2.GC_INIT_WITH_RECT)
        combined = np.where(
            (gc_mask == cv2.GC_FGD) | (gc_mask == cv2.GC_PR_FGD), 255, 0
        ).astype(np.uint8)

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    combined = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel, iterations=2)
    combined = cv2.morphologyEx(combined, cv2.MORPH_OPEN, kernel, iterations=1)

    mask = cv2.GaussianBlur(combined, (9, 9), 0)
    return Image.fromarray(mask, mode="L")


def apply_mask_refinement(
    base_mask: Image.Image,
    strokes: list[dict],
    original_image: Image.Image | None = None,
) -> Image.Image:
    """Apply user brush strokes to refine the auto-detected mask, then snap
    edges to the actual product boundaries using GrabCut.
    Each stroke: { "points": [{"x": int, "y": int}, ...], "radius": int, "mode": "include"|"exclude" }
    """
    mask = np.array(base_mask)

    for stroke in strokes:
        color = 255 if stroke["mode"] == "include" else 0
        radius = stroke.get("radius", 15)
        points = stroke["points"]
        for i in range(len(points) - 1):
            pt1 = (int(points[i]["x"]), int(points[i]["y"]))
            pt2 = (int(points[i + 1]["x"]), int(points[i + 1]["y"]))
            cv2.line(mask, pt1, pt2, color, thickness=radius * 2)
        if len(points) == 1:
            pt = (int(points[0]["x"]), int(points[0]["y"]))
            cv2.circle(mask, pt, radius, color, -1)

    # Snap mask edges to real image edges using GrabCut
    if original_image is not None:
        mask = _edge_snap_grabcut(mask, original_image)

    mask = cv2.GaussianBlur(mask, (5, 5), 0)
    return Image.fromarray(mask, mode="L")


def _edge_snap_grabcut(
    rough_mask: np.ndarray,
    original_image: Image.Image,
) -> np.ndarray:
    """Use GrabCut to refine a rough painted mask so its edges snap to
    the actual object boundaries in the original image.

    Converts the rough mask into a GrabCut trimap:
    - Solid white (>240) → definite foreground
    - Solid black (<15) → definite background
    - Near the boundary → probable foreground/background (let GrabCut decide)
    """
    img = np.array(original_image.convert("RGB"))

    # Resize image to match mask if needed
    if img.shape[:2] != rough_mask.shape[:2]:
        img = cv2.resize(img, (rough_mask.shape[1], rough_mask.shape[0]))

    # Find the boundary zone where the mask transitions (the sloppy edges)
    # Erode and dilate to find a band around the mask edge
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
    eroded = cv2.erode(rough_mask, kernel, iterations=2)
    dilated = cv2.dilate(rough_mask, kernel, iterations=2)

    # Build GrabCut mask
    gc_mask = np.zeros(rough_mask.shape, dtype=np.uint8)
    gc_mask[:] = cv2.GC_BGD                           # default: definite background
    gc_mask[dilated > 128] = cv2.GC_PR_BGD             # dilated zone: probable background
    gc_mask[rough_mask > 128] = cv2.GC_PR_FGD          # rough mask: probable foreground
    gc_mask[eroded > 128] = cv2.GC_FGD                 # eroded core: definite foreground

    # Need at least some foreground and background for GrabCut
    if not (np.any(gc_mask == cv2.GC_FGD) and np.any(gc_mask == cv2.GC_BGD)):
        return rough_mask

    bgd_model = np.zeros((1, 65), np.float64)
    fgd_model = np.zeros((1, 65), np.float64)

    try:
        cv2.grabCut(img, gc_mask, None, bgd_model, fgd_model, 3, cv2.GC_INIT_WITH_MASK)
    except cv2.error:
        # GrabCut can fail on edge cases — fall back to rough mask
        return rough_mask

    # Extract refined mask: foreground + probable foreground = product
    refined = np.where(
        (gc_mask == cv2.GC_FGD) | (gc_mask == cv2.GC_PR_FGD), 255, 0
    ).astype(np.uint8)

    # Morphological cleanup: close small gaps, remove specks
    close_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    refined = cv2.morphologyEx(refined, cv2.MORPH_CLOSE, close_kernel, iterations=1)
    refined = cv2.morphologyEx(refined, cv2.MORPH_OPEN, close_kernel, iterations=1)

    return refined
