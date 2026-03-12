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
) -> Image.Image:
    """Apply user brush strokes to refine the auto-detected mask.
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

    mask = cv2.GaussianBlur(mask, (5, 5), 0)
    return Image.fromarray(mask, mode="L")
