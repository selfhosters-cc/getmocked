import numpy as np
from PIL import Image
from app.mask import detect_product_mask


def test_detect_mask_white_background():
    """A white-background image with a gray product should produce a mask
    where the product area is 255 and background is 0."""
    img = Image.new("RGB", (400, 400), color=(255, 255, 255))
    pixels = np.array(img)
    pixels[100:300, 100:300] = (128, 128, 128)
    img = Image.fromarray(pixels)

    mask = detect_product_mask(img)

    assert mask.size == img.size
    assert mask.mode == "L"
    arr = np.array(mask)
    assert arr[200, 200] > 200
    assert arr[10, 10] < 50


def test_detect_mask_no_clear_background():
    """An image with no clear background should return an all-white mask."""
    img = Image.new("RGB", (400, 400), color=(100, 80, 60))
    mask = detect_product_mask(img)
    arr = np.array(mask)
    assert arr.mean() > 200
