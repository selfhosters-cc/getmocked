import numpy as np
from PIL import Image
from app.tint import tint_product


def test_tint_white_product_to_navy():
    img = Image.new("RGB", (200, 200), (255, 255, 255))
    pixels = np.array(img)
    pixels[50:150, 50:150] = (240, 240, 240)
    img = Image.fromarray(pixels)

    mask = Image.new("L", (200, 200), 0)
    mask_arr = np.array(mask)
    mask_arr[50:150, 50:150] = 255
    mask = Image.fromarray(mask_arr)

    result = tint_product(img, mask, "#1a2744")
    result_arr = np.array(result)

    center = result_arr[100, 100]
    assert center[2] > center[0]
    assert center[2] > center[1]

    corner = result_arr[10, 10]
    assert corner[0] > 250 and corner[1] > 250 and corner[2] > 250


def test_tint_preserves_shadows():
    img = Image.new("RGB", (200, 200), (255, 255, 255))
    pixels = np.array(img)
    pixels[50:100, 50:150] = (200, 200, 200)
    pixels[100:150, 50:150] = (100, 100, 100)
    img = Image.fromarray(pixels)

    mask = Image.new("L", (200, 200), 0)
    mask_arr = np.array(mask)
    mask_arr[50:150, 50:150] = 255
    mask = Image.fromarray(mask_arr)

    result = tint_product(img, mask, "#ff0000")
    result_arr = np.array(result)

    light_pixel = result_arr[75, 100]
    dark_pixel = result_arr[125, 100]
    assert sum(dark_pixel[:3]) < sum(light_pixel[:3])


def test_tint_none_returns_original():
    img = Image.new("RGB", (100, 100), (200, 200, 200))
    mask = Image.new("L", (100, 100), 255)
    result = tint_product(img, mask, None)
    assert np.array_equal(np.array(result), np.array(img))
