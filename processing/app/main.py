import os
from uuid import uuid4
from fastapi import FastAPI
from pydantic import BaseModel
from PIL import Image, ImageOps

from app.transform import apply_perspective_transform
from app.texture import detect_texture

app = FastAPI(title="Get Mocked - Image Processing")


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
    from app.mask import detect_product_mask
    image = ImageOps.exif_transpose(Image.open(req.imagePath))
    mask = detect_product_mask(image)
    mask_path = req.imagePath.rsplit(".", 1)[0] + "_mask.png"
    mask.save(mask_path, "PNG")
    return {"maskPath": mask_path}

@app.post("/refine-mask")
def refine_mask_endpoint(req: MaskRefineRequest):
    from app.mask import apply_mask_refinement
    base_mask = Image.open(req.maskPath).convert("L")
    refined = apply_mask_refinement(base_mask, req.strokes)
    refined.save(req.maskPath, "PNG")
    return {"maskPath": req.maskPath}

@app.post("/detect-texture")
def detect_texture_endpoint(req: TextureDetectRequest):
    image = ImageOps.exif_transpose(Image.open(req.imagePath))
    corners = [{"x": c.x, "y": c.y} for c in req.corners]
    result = detect_texture(image, corners)
    return result
