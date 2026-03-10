import numpy as np
from PIL import Image
from app.transform import apply_perspective_transform


def test_perspective_transform_produces_output():
    template_img = Image.new("RGB", (800, 600), color=(200, 200, 200))
    design_img = Image.new("RGB", (400, 400), color=(255, 0, 0))

    corners = [
        {"x": 200, "y": 100},
        {"x": 600, "y": 120},
        {"x": 580, "y": 480},
        {"x": 220, "y": 460},
    ]

    result = apply_perspective_transform(template_img, design_img, corners)
    assert result.size == template_img.size
    center_pixel = result.getpixel((400, 300))
    assert center_pixel != (200, 200, 200)


def test_perspective_transform_with_displacement():
    template_img = Image.new("RGB", (800, 600), color=(200, 200, 200))
    design_img = Image.new("RGB", (400, 400), color=(255, 0, 0))
    corners = [
        {"x": 200, "y": 100},
        {"x": 600, "y": 120},
        {"x": 580, "y": 480},
        {"x": 220, "y": 460},
    ]

    result = apply_perspective_transform(
        template_img, design_img, corners, displacement_intensity=0.5
    )
    assert result.size == template_img.size
