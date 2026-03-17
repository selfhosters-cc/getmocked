import io
import zipfile
from PIL import Image
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def _make_image(width=100, height=100, color=(200, 100, 50), mode="RGB"):
    img = Image.new(mode, (width, height), color=color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf


def test_background_remove_white():
    img = Image.new("RGB", (100, 100), color=(255, 255, 255))
    for x in range(25, 75):
        for y in range(25, 75):
            img.putpixel((x, y), (200, 50, 50))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    response = client.post(
        "/background-remove",
        files={"image": ("test.png", buf, "image/png")},
        data={"threshold": "240"},
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    result = Image.open(io.BytesIO(response.content))
    assert result.mode == "RGBA"
    assert result.getpixel((0, 0))[3] < 50
    assert result.getpixel((50, 50))[3] > 200


def test_background_remove_contour():
    img = Image.new("RGB", (100, 100), color=(255, 255, 255))
    for x in range(25, 75):
        for y in range(25, 75):
            img.putpixel((x, y), (50, 50, 50))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    response = client.post(
        "/background-remove",
        files={"image": ("test.png", buf, "image/png")},
        data={"threshold": "240", "mode": "contour"},
    )
    assert response.status_code == 200
    result = Image.open(io.BytesIO(response.content))
    assert result.mode == "RGBA"


def test_color_variants():
    buf = _make_image()
    response = client.post(
        "/color-variants",
        files={"image": ("test.png", buf, "image/png")},
        data={"colors": "#ff0000,#00ff00,#0000ff"},
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    z = zipfile.ZipFile(io.BytesIO(response.content))
    assert len(z.namelist()) == 3


def test_color_variants_empty():
    buf = _make_image()
    response = client.post(
        "/color-variants",
        files={"image": ("test.png", buf, "image/png")},
        data={"colors": ""},
    )
    assert response.status_code == 400


def test_pattern_tile_straight():
    buf = _make_image()
    response = client.post(
        "/pattern-tile",
        files={"image": ("test.png", buf, "image/png")},
        data={"mode": "straight", "cols": "3", "rows": "3"},
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    result = Image.open(io.BytesIO(response.content))
    assert result.size == (300, 300)


def test_pattern_tile_mirror():
    buf = _make_image()
    response = client.post(
        "/pattern-tile",
        files={"image": ("test.png", buf, "image/png")},
        data={"mode": "mirror", "cols": "2", "rows": "2"},
    )
    assert response.status_code == 200
    result = Image.open(io.BytesIO(response.content))
    assert result.size == (200, 200)


def test_watermark_text():
    buf = _make_image(400, 300)
    response = client.post(
        "/watermark",
        files={"image": ("test.png", buf, "image/png")},
        data={"text": "SAMPLE", "opacity": "50", "position": "center", "font_size": "24", "color": "#ffffff"},
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    result = Image.open(io.BytesIO(response.content))
    assert result.size == (400, 300)


def test_watermark_no_text_or_image():
    buf = _make_image()
    response = client.post(
        "/watermark",
        files={"image": ("test.png", buf, "image/png")},
        data={"opacity": "50"},
    )
    assert response.status_code == 400
