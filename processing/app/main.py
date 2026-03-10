import os
from uuid import uuid4
from fastapi import FastAPI
from pydantic import BaseModel
from PIL import Image

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
    template = Image.open(req.templateImagePath)
    design = Image.open(req.designImagePath)

    corners = req.overlayConfig.get("corners", [])
    displacement = req.overlayConfig.get("displacementIntensity", 0.0)
    texture_data = req.overlayConfig.get("textureData")

    result = apply_perspective_transform(
        template, design, corners,
        displacement_intensity=displacement,
        texture_data=texture_data,
    )

    os.makedirs(req.outputDir, exist_ok=True)
    output_path = os.path.join(req.outputDir, f"{req.renderId}.png")
    result.save(output_path, "PNG")

    return {"outputPath": output_path}


@app.post("/detect-texture")
def detect_texture_endpoint(req: TextureDetectRequest):
    image = Image.open(req.imagePath)
    corners = [{"x": c.x, "y": c.y} for c in req.corners]
    result = detect_texture(image, corners)
    return result
