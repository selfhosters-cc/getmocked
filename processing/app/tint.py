import cv2
import numpy as np
from PIL import Image


def hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    """Convert '#1a2744' to (26, 39, 68)."""
    h = hex_color.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def tint_product(
    image: Image.Image,
    mask: Image.Image,
    color: str | None,
) -> Image.Image:
    """Apply luminance-preserving tint to the product region.
    Converts product to grayscale (preserving shadows/folds), then
    multiplies by target color. Background pixels are untouched.
    """
    if color is None:
        return image

    img = np.array(image.convert("RGB")).astype(np.float32)
    mask_arr = np.array(mask.convert("L")).astype(np.float32) / 255.0
    r, g, b = hex_to_rgb(color)

    gray = cv2.cvtColor(img.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)
    lum = gray / 255.0

    tinted = np.zeros_like(img)
    tinted[:, :, 0] = lum * r
    tinted[:, :, 1] = lum * g
    tinted[:, :, 2] = lum * b

    mask_3ch = mask_arr[:, :, np.newaxis]
    result = tinted * mask_3ch + img * (1.0 - mask_3ch)

    return Image.fromarray(result.clip(0, 255).astype(np.uint8))
