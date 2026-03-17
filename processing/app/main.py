import io
import os
import zipfile
from uuid import uuid4

import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from PIL import Image, ImageDraw, ImageFont, ImageOps

from app.transform import apply_perspective_transform
from app.texture import detect_texture

app = FastAPI(title="Get Mocked - Image Processing")

ALLOWED_DIRS = [
    os.path.abspath(os.environ.get("UPLOAD_DIR", "/app/uploads")),
    os.path.abspath(os.environ.get("RENDER_DIR", "/app/rendered")),
]


def validate_path(file_path: str, allow_write: bool = False) -> str:
    """Validate that a file path is within allowed directories."""
    abs_path = os.path.abspath(file_path)
    if not any(abs_path.startswith(d + os.sep) or abs_path == d for d in ALLOWED_DIRS):
        raise HTTPException(status_code=403, detail="Path outside allowed directories")
    return abs_path


class Corner(BaseModel):
    x: float
    y: float


class RenderRequest(BaseModel):
    templateImagePath: str
    designImagePath: str
    overlayConfig: dict
    outputDir: str
    renderId: str


class TextureDetectRequest(BaseModel):
    imagePath: str
    corners: list[Corner]


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/render")
def render(req: RenderRequest):
    validate_path(req.templateImagePath)
    validate_path(req.designImagePath)
    validate_path(req.outputDir, allow_write=True)
    template = ImageOps.exif_transpose(Image.open(req.templateImagePath))
    design = ImageOps.exif_transpose(Image.open(req.designImagePath))

    corners = req.overlayConfig.get("corners", [])
    displacement = req.overlayConfig.get("displacementIntensity", 0.0)
    transparency = req.overlayConfig.get("transparency", 0.0)
    curvature = req.overlayConfig.get("curvature", 0.0)
    curve_axis = req.overlayConfig.get("curveAxis", "auto")
    texture_data = req.overlayConfig.get("textureData")
    tint_color = req.overlayConfig.get("tintColor")
    mask_path = req.overlayConfig.get("maskPath")
    if mask_path:
        validate_path(mask_path)
    output_mode = req.overlayConfig.get("outputMode", "original")
    output_color = req.overlayConfig.get("outputColor")
    print(f"[render] displacement={displacement}, transparency={transparency}, "
          f"curvature={curvature}, curveAxis={curve_axis}, corners={len(corners)}, "
          f"tint={tint_color}, outputMode={output_mode}, outputColor={output_color}")

    result = apply_perspective_transform(
        template, design, corners,
        displacement_intensity=displacement,
        transparency=transparency,
        curvature=curvature,
        curve_axis=curve_axis,
        texture_data=texture_data,
        tint_color=tint_color,
        mask_path=mask_path,
        output_mode=output_mode,
        output_color=output_color,
    )

    os.makedirs(req.outputDir, exist_ok=True)
    output_path = os.path.join(req.outputDir, f"{req.renderId}.png")
    result.save(output_path, "PNG")

    return {"outputPath": output_path}


class MaskDetectRequest(BaseModel):
    imagePath: str

class MaskRefineRequest(BaseModel):
    imagePath: str
    maskPath: str
    strokes: list[dict]

@app.post("/detect-mask")
def detect_mask_endpoint(req: MaskDetectRequest):
    validate_path(req.imagePath)
    from app.mask import detect_product_mask
    image = ImageOps.exif_transpose(Image.open(req.imagePath))
    mask = detect_product_mask(image)
    mask_path = req.imagePath.rsplit(".", 1)[0] + "_mask.png"
    mask.save(mask_path, "PNG")
    return {"maskPath": mask_path}

@app.post("/refine-mask")
def refine_mask_endpoint(req: MaskRefineRequest):
    validate_path(req.imagePath)
    validate_path(req.maskPath)
    from app.mask import apply_mask_refinement
    base_mask = Image.open(req.maskPath).convert("L")
    original_image = ImageOps.exif_transpose(Image.open(req.imagePath))
    refined = apply_mask_refinement(base_mask, req.strokes, original_image)
    refined.save(req.maskPath, "PNG")
    return {"maskPath": req.maskPath}

@app.post("/detect-texture")
def detect_texture_endpoint(req: TextureDetectRequest):
    validate_path(req.imagePath)
    image = ImageOps.exif_transpose(Image.open(req.imagePath))
    corners = [{"x": c.x, "y": c.y} for c in req.corners]
    result = detect_texture(image, corners)
    return result


# --- Free tool endpoints (file-upload based) ---


@app.post("/background-remove")
async def background_remove(
    image: UploadFile = File(...),
    threshold: int = Form(240),
    mode: str = Form("white"),  # "white" or "contour"
):
    img_bytes = await image.read()
    img = ImageOps.exif_transpose(Image.open(io.BytesIO(img_bytes)))

    if mode == "contour":
        result = _contour_background_remove(img, threshold)
    else:
        result = _white_background_remove(img, threshold)

    buf = io.BytesIO()
    result.save(buf, format="PNG")
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/png")


def _white_background_remove(img: Image.Image, threshold: int) -> Image.Image:
    rgba = np.array(img.convert("RGBA"))
    rgb = rgba[:, :, :3].astype(np.float32)
    bg_mask = (rgb[:, :, 0] > threshold) & (rgb[:, :, 1] > threshold) & (rgb[:, :, 2] > threshold)
    bg_mask_float = bg_mask.astype(np.float32)
    bg_mask_smooth = cv2.GaussianBlur(bg_mask_float, (5, 5), 0)
    rgba[:, :, 3] = ((1.0 - bg_mask_smooth) * 255).clip(0, 255).astype(np.uint8)
    return Image.fromarray(rgba)


def _contour_background_remove(img: Image.Image, threshold: int) -> Image.Image:
    rgb = np.array(img.convert("RGB"))
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    _, binary = cv2.threshold(gray, threshold, 255, cv2.THRESH_BINARY_INV)
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return img.convert("RGBA")
    largest = max(contours, key=cv2.contourArea)
    mask = np.zeros(gray.shape, dtype=np.uint8)
    cv2.drawContours(mask, [largest], -1, 255, -1)
    mask_smooth = cv2.GaussianBlur(mask, (5, 5), 0)
    rgba = np.array(img.convert("RGBA"))
    rgba[:, :, 3] = mask_smooth
    return Image.fromarray(rgba)


@app.post("/color-variants")
async def color_variants(
    image: UploadFile = File(...),
    colors: str = Form(...),  # "#ff0000,#00ff00,#0000ff"
):
    img_bytes = await image.read()
    img = ImageOps.exif_transpose(Image.open(io.BytesIO(img_bytes))).convert("RGB")
    color_list = [c.strip() for c in colors.split(",") if c.strip()]

    if not color_list:
        raise HTTPException(status_code=400, detail="At least one color required")
    if len(color_list) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 colors")

    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for i, hex_color in enumerate(color_list):
            tinted = _tint_image(img, hex_color)
            img_buf = io.BytesIO()
            tinted.save(img_buf, format="PNG")
            zf.writestr(f"variant_{hex_color.replace('#', '')}_{i}.png", img_buf.getvalue())

    zip_buf.seek(0)
    return StreamingResponse(zip_buf, media_type="application/zip")


def _tint_image(img: Image.Image, hex_color: str) -> Image.Image:
    from app.tint import hex_to_rgb
    rgb = np.array(img).astype(np.float32)
    gray = cv2.cvtColor(rgb.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)
    lum = gray / 255.0
    r, g, b = hex_to_rgb(hex_color)
    tinted = np.zeros_like(rgb)
    tinted[:, :, 0] = lum * r
    tinted[:, :, 1] = lum * g
    tinted[:, :, 2] = lum * b
    return Image.fromarray(tinted.clip(0, 255).astype(np.uint8))


@app.post("/pattern-tile")
async def pattern_tile(
    image: UploadFile = File(...),
    mode: str = Form("straight"),  # straight, half_drop, half_brick, mirror
    cols: int = Form(4),
    rows: int = Form(4),
    scale: float = Form(1.0),
):
    img_bytes = await image.read()
    img = ImageOps.exif_transpose(Image.open(io.BytesIO(img_bytes))).convert("RGBA")

    cols = min(max(cols, 1), 10)
    rows = min(max(rows, 1), 10)
    scale = min(max(scale, 0.25), 2.0)

    if scale != 1.0:
        new_w = max(1, int(img.width * scale))
        new_h = max(1, int(img.height * scale))
        img = img.resize((new_w, new_h), Image.LANCZOS)

    tw, th = img.width, img.height
    canvas = Image.new("RGBA", (tw * cols, th * rows), (0, 0, 0, 0))

    for row in range(rows):
        for col in range(cols):
            tile = img.copy()
            x_offset = 0
            y_offset = 0

            if mode == "half_drop":
                y_offset = (th // 2) if col % 2 else 0
            elif mode == "half_brick":
                x_offset = (tw // 2) if row % 2 else 0
            elif mode == "mirror":
                if col % 2:
                    tile = tile.transpose(Image.FLIP_LEFT_RIGHT)
                if row % 2:
                    tile = tile.transpose(Image.FLIP_TOP_BOTTOM)

            x = col * tw + x_offset
            y = row * th + y_offset
            paste_w = min(tile.width, canvas.width - x)
            paste_h = min(tile.height, canvas.height - y)
            if paste_w > 0 and paste_h > 0 and x >= 0 and y >= 0:
                cropped = tile.crop((0, 0, paste_w, paste_h))
                canvas.paste(cropped, (x, y), cropped)

    buf = io.BytesIO()
    canvas.save(buf, format="PNG")
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/png")


@app.post("/watermark")
async def watermark(
    image: UploadFile = File(...),
    text: str = Form(None),
    watermark_image: UploadFile = File(None),
    opacity: int = Form(50),
    position: str = Form("center"),
    font_size: int = Form(24),
    color: str = Form("#ffffff"),
):
    img_bytes = await image.read()
    img = ImageOps.exif_transpose(Image.open(io.BytesIO(img_bytes))).convert("RGBA")
    alpha = int(255 * opacity / 100)

    if text:
        watermark_layer = _create_text_watermark(img.size, text, font_size, color, alpha, position)
    elif watermark_image:
        wm_bytes = await watermark_image.read()
        wm = Image.open(io.BytesIO(wm_bytes)).convert("RGBA")
        watermark_layer = _create_image_watermark(img.size, wm, alpha, position)
    else:
        raise HTTPException(status_code=400, detail="Provide text or watermark_image")

    result = Image.alpha_composite(img, watermark_layer)
    buf = io.BytesIO()
    result.save(buf, format="PNG")
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/png")


def _get_position_xy(canvas_size: tuple, wm_size: tuple, position: str) -> tuple:
    cw, ch = canvas_size
    ww, wh = wm_size
    positions = {
        "top-left": (10, 10),
        "top-center": ((cw - ww) // 2, 10),
        "top-right": (cw - ww - 10, 10),
        "center-left": (10, (ch - wh) // 2),
        "center": ((cw - ww) // 2, (ch - wh) // 2),
        "center-right": (cw - ww - 10, (ch - wh) // 2),
        "bottom-left": (10, ch - wh - 10),
        "bottom-center": ((cw - ww) // 2, ch - wh - 10),
        "bottom-right": (cw - ww - 10, ch - wh - 10),
    }
    return positions.get(position, positions["center"])


def _create_text_watermark(size: tuple, text: str, font_size: int, color: str, alpha: int, position: str) -> Image.Image:
    from app.tint import hex_to_rgb
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", font_size)
    except (OSError, IOError):
        font = ImageFont.load_default()

    r, g, b = hex_to_rgb(color)
    fill = (r, g, b, alpha)

    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]

    if position == "tiled":
        for y in range(0, size[1], th + 60):
            for x in range(0, size[0], tw + 60):
                draw.text((x, y), text, font=font, fill=fill)
    else:
        x, y = _get_position_xy(size, (tw, th), position)
        draw.text((x, y), text, font=font, fill=fill)

    return layer


def _create_image_watermark(size: tuple, wm: Image.Image, alpha: int, position: str) -> Image.Image:
    max_w = int(size[0] * 0.3)
    if wm.width > max_w:
        ratio = max_w / wm.width
        wm = wm.resize((max_w, int(wm.height * ratio)), Image.LANCZOS)

    wm_arr = np.array(wm)
    if wm_arr.shape[2] == 4:
        wm_arr[:, :, 3] = (wm_arr[:, :, 3].astype(np.float32) * alpha / 255).astype(np.uint8)
    wm = Image.fromarray(wm_arr)

    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    if position == "tiled":
        for y in range(0, size[1], wm.height + 40):
            for x in range(0, size[0], wm.width + 40):
                layer.paste(wm, (x, y), wm)
    else:
        x, y = _get_position_xy(size, wm.size, position)
        layer.paste(wm, (x, y), wm)

    return layer
