import numpy as np
from PIL import Image
from app.texture import detect_texture


def test_detect_texture_returns_data():
    img = Image.new("RGB", (400, 400), color=(200, 200, 200))
    pixels = np.array(img)
    for i in range(0, 400, 10):
        pixels[i : i + 2, :] = [180, 180, 180]
    img = Image.fromarray(pixels)

    result = detect_texture(img, corners=[
        {"x": 50, "y": 50},
        {"x": 350, "y": 50},
        {"x": 350, "y": 350},
        {"x": 50, "y": 350},
    ])

    assert "edgeDensity" in result
    assert "dominantDirection" in result
    assert isinstance(result["edgeDensity"], float)
