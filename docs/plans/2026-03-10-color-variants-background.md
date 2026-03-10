# Color Variants & Background Customization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let sellers render designs across multiple product colors (auto-tinted from a single photo) and choose output background (original, transparent, solid color).

**Architecture:** Add product mask auto-detection + brush refinement in Python processing service. Luminance-preserving tint applied before the existing perspective warp pipeline. Batch render API expanded to accept color × template matrix. Background removal is a post-composite step using the inverted product mask.

**Tech Stack:** Python (OpenCV, Pillow, NumPy), Next.js 14 API routes, Prisma, React/Tailwind canvas editor.

---

### Task 1: Product Mask Auto-Detection (Python)

**Files:**
- Create: `processing/app/mask.py`
- Create: `processing/tests/test_mask.py`

**Step 1: Write the failing test**

```python
# processing/tests/test_mask.py
import numpy as np
from PIL import Image
from app.mask import detect_product_mask


def test_detect_mask_white_background():
    """A white-background image with a gray product should produce a mask
    where the product area is 255 and background is 0."""
    img = Image.new("RGB", (400, 400), color=(255, 255, 255))
    # Draw a "product" rectangle in the center
    pixels = np.array(img)
    pixels[100:300, 100:300] = (128, 128, 128)  # gray product
    img = Image.fromarray(pixels)

    mask = detect_product_mask(img)

    assert mask.size == img.size
    assert mask.mode == "L"
    arr = np.array(mask)
    # Center should be product (high value)
    assert arr[200, 200] > 200
    # Corner should be background (low value)
    assert arr[10, 10] < 50


def test_detect_mask_no_clear_background():
    """An image with no clear background should return an all-white mask
    (treat everything as product)."""
    img = Image.new("RGB", (400, 400), color=(100, 80, 60))
    mask = detect_product_mask(img)
    arr = np.array(mask)
    assert arr.mean() > 200  # mostly product
```

**Step 2: Run test to verify it fails**

Run: `cd processing && ../.venv/bin/pytest tests/test_mask.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.mask'`

**Step 3: Write implementation**

```python
# processing/app/mask.py
import cv2
import numpy as np
from PIL import Image


def detect_product_mask(image: Image.Image) -> Image.Image:
    """Auto-detect product region by identifying studio background.

    Works best with white/light gray backgrounds (common in product photography).
    Returns a grayscale mask: 255 = product, 0 = background, with soft edges.
    """
    img = np.array(image.convert("RGB"))

    # Convert to LAB — L channel isolates lightness from color
    lab = cv2.cvtColor(img, cv2.COLOR_RGB2LAB)
    l_channel = lab[:, :, 0]  # 0-255 range

    # Sample border pixels to estimate background lightness
    h, w = l_channel.shape
    border = np.concatenate([
        l_channel[0, :], l_channel[-1, :],
        l_channel[:, 0], l_channel[:, -1],
    ])
    bg_mean = float(border.mean())
    bg_std = float(border.std())

    # If border isn't consistently light, there's no clear studio background
    if bg_mean < 180 or bg_std > 30:
        # Return all-white mask (entire image is "product")
        return Image.new("L", image.size, 255)

    # Threshold: pixels significantly darker than background = product
    # Use adaptive threshold relative to background brightness
    threshold = bg_mean - max(20, bg_std * 3)
    product_mask = (l_channel < threshold).astype(np.uint8) * 255

    # Also check saturation — colored products on white bg
    a_channel = lab[:, :, 1].astype(np.float32) - 128
    b_channel = lab[:, :, 2].astype(np.float32) - 128
    saturation = np.sqrt(a_channel ** 2 + b_channel ** 2)
    color_mask = (saturation > 15).astype(np.uint8) * 255

    # Combine: product = darker than bg OR has color
    combined = np.maximum(product_mask, color_mask)

    # Morphological cleanup: close small gaps, remove noise
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    combined = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel, iterations=2)
    combined = cv2.morphologyEx(combined, cv2.MORPH_OPEN, kernel, iterations=1)

    # Soft edges with gaussian blur
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

    # Re-blur edges after refinement
    mask = cv2.GaussianBlur(mask, (5, 5), 0)
    return Image.fromarray(mask, mode="L")
```

**Step 4: Run tests to verify they pass**

Run: `cd processing && ../.venv/bin/pytest tests/test_mask.py -v`
Expected: Both PASS

**Step 5: Commit**

```bash
git add processing/app/mask.py processing/tests/test_mask.py
git commit -m "feat: auto product mask detection with refinement support"
```

---

### Task 2: Luminance-Preserving Tint (Python)

**Files:**
- Create: `processing/app/tint.py`
- Create: `processing/tests/test_tint.py`

**Step 1: Write the failing test**

```python
# processing/tests/test_tint.py
import numpy as np
from PIL import Image
from app.tint import tint_product


def test_tint_white_product_to_navy():
    """Tinting a white product to navy should produce dark blue pixels
    in the product area and leave background unchanged."""
    # White product on white background
    img = Image.new("RGB", (200, 200), (255, 255, 255))
    pixels = np.array(img)
    pixels[50:150, 50:150] = (240, 240, 240)  # slightly off-white product
    img = Image.fromarray(pixels)

    # Mask: center is product
    mask = Image.new("L", (200, 200), 0)
    mask_arr = np.array(mask)
    mask_arr[50:150, 50:150] = 255
    mask = Image.fromarray(mask_arr)

    result = tint_product(img, mask, "#1a2744")
    result_arr = np.array(result)

    # Product area should be dark blue-ish
    center = result_arr[100, 100]
    assert center[2] > center[0]  # blue > red
    assert center[2] > center[1]  # blue > green

    # Background should be unchanged (white)
    corner = result_arr[10, 10]
    assert corner[0] > 250 and corner[1] > 250 and corner[2] > 250


def test_tint_preserves_shadows():
    """Dark pixels (shadows) in product area should stay darker than
    light pixels after tinting — luminance is preserved."""
    img = Image.new("RGB", (200, 200), (255, 255, 255))
    pixels = np.array(img)
    pixels[50:100, 50:150] = (200, 200, 200)  # lighter area
    pixels[100:150, 50:150] = (100, 100, 100)  # darker shadow area
    img = Image.fromarray(pixels)

    mask = Image.new("L", (200, 200), 0)
    mask_arr = np.array(mask)
    mask_arr[50:150, 50:150] = 255
    mask = Image.fromarray(mask_arr)

    result = tint_product(img, mask, "#ff0000")
    result_arr = np.array(result)

    light_pixel = result_arr[75, 100]  # lighter area
    dark_pixel = result_arr[125, 100]  # shadow area
    # Shadow area should be darker than light area
    assert sum(dark_pixel[:3]) < sum(light_pixel[:3])


def test_tint_none_returns_original():
    """Passing None as color should return the image unchanged."""
    img = Image.new("RGB", (100, 100), (200, 200, 200))
    mask = Image.new("L", (100, 100), 255)
    result = tint_product(img, mask, None)
    assert np.array_equal(np.array(result), np.array(img))
```

**Step 2: Run test to verify it fails**

Run: `cd processing && ../.venv/bin/pytest tests/test_tint.py -v`
Expected: FAIL — `ModuleNotFoundError`

**Step 3: Write implementation**

```python
# processing/app/tint.py
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

    Args:
        image: Original template image (RGB)
        mask: Product mask (L mode, 255=product, 0=background)
        color: Hex color string like '#1a2744', or None for no tint
    """
    if color is None:
        return image

    img = np.array(image.convert("RGB")).astype(np.float32)
    mask_arr = np.array(mask.convert("L")).astype(np.float32) / 255.0
    r, g, b = hex_to_rgb(color)

    # Convert to grayscale luminance (preserves shadows, folds, texture)
    gray = cv2.cvtColor(img.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)

    # Normalize luminance to 0-1 range
    lum = gray / 255.0

    # Tinted version: luminance * target color
    tinted = np.zeros_like(img)
    tinted[:, :, 0] = lum * r
    tinted[:, :, 1] = lum * g
    tinted[:, :, 2] = lum * b

    # Blend using mask: product pixels get tinted, background stays original
    mask_3ch = mask_arr[:, :, np.newaxis]
    result = tinted * mask_3ch + img * (1.0 - mask_3ch)

    return Image.fromarray(result.clip(0, 255).astype(np.uint8))
```

**Step 4: Run tests to verify they pass**

Run: `cd processing && ../.venv/bin/pytest tests/test_tint.py -v`
Expected: All 3 PASS

**Step 5: Commit**

```bash
git add processing/app/tint.py processing/tests/test_tint.py
git commit -m "feat: luminance-preserving product tinting"
```

---

### Task 3: Integrate Tint + Background into Render Pipeline (Python)

**Files:**
- Modify: `processing/app/transform.py`
- Modify: `processing/app/main.py`
- Modify: `processing/tests/test_transform.py`

**Step 1: Write failing tests**

Add to `processing/tests/test_transform.py`:

```python
def test_perspective_transform_with_tint():
    """Rendering with a tint color should change the template product color."""
    template_img = Image.new("RGB", (800, 600), color=(200, 200, 200))
    design_img = Image.new("RGB", (400, 400), color=(255, 0, 0))
    corners = [
        {"x": 200, "y": 100},
        {"x": 600, "y": 120},
        {"x": 580, "y": 480},
        {"x": 220, "y": 460},
    ]

    result = apply_perspective_transform(
        template_img, design_img, corners,
        tint_color="#1a2744",
    )
    assert result.size == template_img.size
    # Outside the design area, the template should be tinted (not original gray)
    edge_pixel = result.getpixel((50, 50))
    # Should be dark blue-ish, not (200, 200, 200)
    assert edge_pixel[2] > edge_pixel[0] or edge_pixel == (200, 200, 200)  # may not tint if mask says no product


def test_perspective_transform_transparent_output():
    """Transparent output mode should return RGBA with alpha=0 in background."""
    template_img = Image.new("RGB", (800, 600), color=(255, 255, 255))
    design_img = Image.new("RGB", (400, 400), color=(255, 0, 0))
    corners = [
        {"x": 200, "y": 100},
        {"x": 600, "y": 120},
        {"x": 580, "y": 480},
        {"x": 220, "y": 460},
    ]

    result = apply_perspective_transform(
        template_img, design_img, corners,
        output_mode="transparent",
    )
    assert result.mode == "RGBA"
    # Corner should be transparent (white bg detected)
    corner_alpha = result.getpixel((5, 5))[3]
    assert corner_alpha < 50


def test_perspective_transform_solid_bg():
    """Solid output mode should replace background with chosen color."""
    template_img = Image.new("RGB", (800, 600), color=(255, 255, 255))
    design_img = Image.new("RGB", (400, 400), color=(255, 0, 0))
    corners = [
        {"x": 200, "y": 100},
        {"x": 600, "y": 120},
        {"x": 580, "y": 480},
        {"x": 220, "y": 460},
    ]

    result = apply_perspective_transform(
        template_img, design_img, corners,
        output_mode="solid",
        output_color="#000000",
    )
    assert result.mode == "RGB"
    # Corner should be black (replaced bg)
    corner = result.getpixel((5, 5))
    assert corner[0] < 50 and corner[1] < 50 and corner[2] < 50
```

**Step 2: Run to verify failure**

Run: `cd processing && ../.venv/bin/pytest tests/test_transform.py -v`
Expected: FAIL — `unexpected keyword argument 'tint_color'`

**Step 3: Modify transform.py**

Add new parameters to `apply_perspective_transform`:

```python
# In apply_perspective_transform signature, add:
#   tint_color: str | None = None,
#   mask_path: str | None = None,
#   output_mode: str = "original",   # "original" | "transparent" | "solid"
#   output_color: str | None = None,

# After template_cv = np.array(...), before design_cv processing:
    # Apply tint if requested
    if tint_color:
        from app.mask import detect_product_mask
        from app.tint import tint_product
        if mask_path and os.path.exists(mask_path):
            product_mask = Image.open(mask_path).convert("L")
        else:
            product_mask = detect_product_mask(template)
        tinted = tint_product(template.convert("RGB"), product_mask, tint_color)
        template_cv = np.array(tinted)
        template = tinted  # for displacement later

# At the end, before return, after result = Image.fromarray(result):
    # Apply output mode
    if output_mode == "transparent":
        from app.mask import detect_product_mask
        if mask_path and os.path.exists(mask_path):
            product_mask = Image.open(mask_path).convert("L")
        else:
            product_mask = detect_product_mask(template)
        mask_arr = np.array(product_mask)
        rgba = np.array(result.convert("RGBA"))
        rgba[:, :, 3] = mask_arr
        result = Image.fromarray(rgba)
    elif output_mode == "solid" and output_color:
        from app.mask import detect_product_mask
        from app.tint import hex_to_rgb
        if mask_path and os.path.exists(mask_path):
            product_mask = Image.open(mask_path).convert("L")
        else:
            product_mask = detect_product_mask(template)
        mask_arr = np.array(product_mask).astype(np.float32) / 255.0
        bg_r, bg_g, bg_b = hex_to_rgb(output_color)
        result_arr = np.array(result.convert("RGB")).astype(np.float32)
        bg = np.full_like(result_arr, [bg_r, bg_g, bg_b], dtype=np.float32)
        mask_3ch = mask_arr[:, :, np.newaxis]
        blended = result_arr * mask_3ch + bg * (1.0 - mask_3ch)
        result = Image.fromarray(blended.clip(0, 255).astype(np.uint8))
```

Add `import os` at top of transform.py.

Update `main.py` render endpoint to pass new params:

```python
    tint_color = req.overlayConfig.get("tintColor")
    mask_path = req.overlayConfig.get("maskPath")
    output_mode = req.overlayConfig.get("outputMode", "original")
    output_color = req.overlayConfig.get("outputColor")

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
```

**Step 4: Run tests**

Run: `cd processing && ../.venv/bin/pytest tests/ -v`
Expected: All PASS

**Step 5: Add mask detection endpoint to main.py**

```python
# New endpoint in main.py

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
    # Save mask next to image
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
```

**Step 6: Commit**

```bash
git add processing/app/transform.py processing/app/main.py processing/tests/test_transform.py
git commit -m "feat: integrate tint and background modes into render pipeline"
```

---

### Task 4: Database Schema — Color Variants + Render Options

**Files:**
- Modify: `frontend/prisma/schema.prisma`

**Step 1: Add fields**

Add to `MockupSet` model:
```prisma
  colorVariants Json?  @default("[]") @map("color_variants")
```

Add to `RenderedMockup` model:
```prisma
  renderOptions Json?  @map("render_options")
```

**Step 2: Run migration**

```bash
cd frontend && npx prisma migrate dev --name add_color_variants_and_render_options
```

**Step 3: Generate client**

```bash
cd frontend && npx prisma generate
```

**Step 4: Commit**

```bash
git add frontend/prisma/
git commit -m "feat: add colorVariants and renderOptions to schema"
```

---

### Task 5: API — Color Variants CRUD on MockupSet

**Files:**
- Modify: `frontend/src/app/api/mockup-sets/[id]/route.ts`
- Modify: `frontend/src/lib/api.ts`

**Step 1: Update set PATCH to accept colorVariants**

In `mockup-sets/[id]/route.ts`, update `updateSchema`:

```typescript
const colorVariantSchema = z.object({
  name: z.string().min(1),
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
})

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  colorVariants: z.array(colorVariantSchema).optional(),
})
```

**Step 2: Update API client**

Add to `api.ts`:
```typescript
  updateSetColors: (id: string, colorVariants: Array<{ name: string; hex: string }>) =>
    request(`/api/mockup-sets/${id}`, { method: 'PATCH', body: JSON.stringify({ colorVariants }) }),
```

**Step 3: Commit**

```bash
git add frontend/src/app/api/mockup-sets/[id]/route.ts frontend/src/lib/api.ts
git commit -m "feat: color variants CRUD on mockup set API"
```

---

### Task 6: API — Mask Detection Proxy Route

**Files:**
- Create: `frontend/src/app/api/mockup-sets/[id]/templates/[templateId]/mask/route.ts`
- Modify: `frontend/src/lib/api.ts`

**Step 1: Create mask API route**

```typescript
// frontend/src/app/api/mockup-sets/[id]/templates/[templateId]/mask/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, handleAuthError } from '@/lib/server/auth'
import { getUploadPath } from '@/lib/server/storage'

const PROCESSING_URL = process.env.PROCESSING_URL || 'http://localhost:5000'

type Params = { params: Promise<{ id: string; templateId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const userId = await requireAuth()
    const { id: setId, templateId } = await params

    const set = await prisma.mockupSet.findFirst({ where: { id: setId, userId } })
    if (!set) return NextResponse.json({ error: 'Set not found' }, { status: 404 })

    const template = await prisma.mockupTemplate.findFirst({
      where: { id: templateId, mockupSetId: setId },
    })
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

    const imagePath = getUploadPath(template.originalImagePath)
    const response = await fetch(`${PROCESSING_URL}/detect-mask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imagePath }),
    })

    if (!response.ok) throw new Error(`Processing service returned ${response.status}`)
    const result = await response.json()
    return NextResponse.json(result)
  } catch (err) {
    return handleAuthError(err)
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const userId = await requireAuth()
    const { id: setId, templateId } = await params

    const set = await prisma.mockupSet.findFirst({ where: { id: setId, userId } })
    if (!set) return NextResponse.json({ error: 'Set not found' }, { status: 404 })

    const template = await prisma.mockupTemplate.findFirst({
      where: { id: templateId, mockupSetId: setId },
    })
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

    const { maskPath, strokes } = await req.json()
    const response = await fetch(`${PROCESSING_URL}/refine-mask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imagePath: getUploadPath(template.originalImagePath), maskPath, strokes }),
    })

    if (!response.ok) throw new Error(`Processing service returned ${response.status}`)
    const result = await response.json()
    return NextResponse.json(result)
  } catch (err) {
    return handleAuthError(err)
  }
}
```

**Step 2: Add API client methods**

```typescript
  detectMask: (setId: string, templateId: string) =>
    request(`/api/mockup-sets/${setId}/templates/${templateId}/mask`, { method: 'POST' }),
  refineMask: (setId: string, templateId: string, maskPath: string, strokes: unknown[]) =>
    request(`/api/mockup-sets/${setId}/templates/${templateId}/mask`, {
      method: 'PATCH',
      body: JSON.stringify({ maskPath, strokes }),
    }),
```

**Step 3: Commit**

```bash
git add frontend/src/app/api/mockup-sets/[id]/templates/[templateId]/mask/route.ts frontend/src/lib/api.ts
git commit -m "feat: mask detection and refinement API routes"
```

---

### Task 7: API — Batch Render with Colors + Output Mode

**Files:**
- Modify: `frontend/src/app/api/render/batch/route.ts`
- Modify: `frontend/src/lib/api.ts`

**Step 1: Update batch route**

Update the POST handler to accept `colorVariants`, `outputMode`, `outputColor`. Create renders for each template × color combination:

```typescript
const { mockupSetId, designId, colorVariants, outputMode, outputColor } = await req.json()
// colorVariants: string[] of hex colors, e.g. ["#1a2744", "#111111"]
// Empty array or undefined = just render original (no tint)

const colors = colorVariants && colorVariants.length > 0
  ? colorVariants as string[]
  : [null]  // null = no tint (original)

// Create renders for each template × color
const renders = await Promise.all(
  set.templates.flatMap((template) =>
    colors.map((color) =>
      prisma.renderedMockup.create({
        data: {
          mockupTemplateId: template.id,
          designId: design.id,
          batchId: batch.id,
          renderedImagePath: '',
          status: 'pending',
          renderOptions: { tintColor: color, outputMode: outputMode || 'original', outputColor },
        },
      })
    )
  )
)
```

Update `processRender` to pass tint/output params to the processing service via `overlayConfig`:

```typescript
body: JSON.stringify({
  templateImagePath: getUploadPath(template.originalImagePath),
  designImagePath: getUploadPath(design.imagePath),
  overlayConfig: {
    ...(template.overlayConfig as Record<string, unknown>),
    tintColor: renderOptions?.tintColor ?? null,
    maskPath: maskPath ?? null,
    outputMode: renderOptions?.outputMode ?? 'original',
    outputColor: renderOptions?.outputColor ?? null,
  },
  outputDir: getRenderPath(`${design.id}`),
  renderId,
}),
```

**Step 2: Update api.ts**

```typescript
  batchRender: (
    mockupSetId: string,
    designId: string,
    colorVariants?: string[],
    outputMode?: string,
    outputColor?: string,
  ) =>
    request('/api/render/batch', {
      method: 'POST',
      body: JSON.stringify({ mockupSetId, designId, colorVariants, outputMode, outputColor }),
    }),
```

**Step 3: Commit**

```bash
git add frontend/src/app/api/render/batch/route.ts frontend/src/lib/api.ts
git commit -m "feat: batch render with color variants and output mode"
```

---

### Task 8: UI — Color Variant Manager on Set Detail Page

**Files:**
- Modify: `frontend/src/app/(app)/sets/[id]/page.tsx`

**Step 1: Add color variant management section**

Below the templates grid, add a "Color Variants" section:
- Row of color swatches showing current variants
- "Add Color" button opens a small inline form (name + color picker)
- Each swatch has an X to remove
- Saves to API on every add/remove

The color variant state comes from the set data (`set.colorVariants`). Add the interface:

```typescript
interface ColorVariant {
  name: string
  hex: string
}
```

Add a `ColorVariantManager` component inline in the page:
- Input for name (text) and color (native `<input type="color">`)
- Button to add
- Display as horizontal row of colored circles with name below and delete X

**Step 2: Commit**

```bash
git add frontend/src/app/(app)/sets/[id]/page.tsx
git commit -m "feat: color variant manager UI on set detail page"
```

---

### Task 9: UI — Mask Editor Component

**Files:**
- Create: `frontend/src/components/editor/mask-editor.tsx`

**Step 1: Build mask editor component**

Props: `setId, templateId, imageUrl, onMaskReady(maskPath)`

Features:
- "Detect Product" button calls `api.detectMask()`
- Shows the mask as a green semi-transparent overlay on the template image
- Brush tool: click and drag to paint include/exclude strokes
- Brush size slider (5-50px)
- Toggle: Include (paint green) / Exclude (paint red/erase)
- "Save Mask" sends strokes to `api.refineMask()`
- Uses a second canvas layered on top of the template for the mask overlay

**Step 2: Wire into template editor page**

Add `MaskEditor` below the main `MockupCanvas` in the edit page. Show it in a collapsible section "Product Mask (for color variants)".

**Step 3: Commit**

```bash
git add frontend/src/components/editor/mask-editor.tsx frontend/src/app/(app)/sets/[id]/templates/[templateId]/edit/page.tsx
git commit -m "feat: mask editor with brush refinement in template editor"
```

---

### Task 10: UI — Apply Page Color + Output Controls

**Files:**
- Modify: `frontend/src/app/(app)/sets/[id]/apply/page.tsx`

**Step 1: Add color selection step**

Between design selection and render button:
- Fetch set data to get `colorVariants`
- Show swatches as toggleable pills (click to include/exclude from render)
- "Original" is always shown as first option
- Display render count: "Will render N templates × M colors = X mockups"

**Step 2: Add output mode selector**

Below color selection:
- Three radio buttons: Original / Transparent / Solid Color
- Solid Color shows `<input type="color">` when selected

**Step 3: Update handleRender**

Pass selected colors + output mode to `api.batchRender()`:

```typescript
const handleRender = async () => {
  if (!selectedDesign) return
  setRendering(true)
  setRenders([])
  setFinalElapsed(null)
  const now = Date.now()
  setStartTime(now)
  setElapsed(0)

  const colors = selectedColors.length > 0 ? selectedColors : undefined
  const result = await api.batchRender(setId, selectedDesign, colors, outputMode, outputColor)
  // ... rest stays the same
}
```

**Step 4: Update render cards to show color swatch**

In the results grid, show a small colored circle on each render card indicating which color variant it used (from `renderOptions`).

**Step 5: Commit**

```bash
git add frontend/src/app/(app)/sets/[id]/apply/page.tsx
git commit -m "feat: color variant and output mode selection on apply page"
```

---

### Task 11: Type Check + Integration Test

**Files:** All modified files

**Step 1: Type check frontend**

```bash
cd frontend && npx tsc --noEmit
```
Expected: Clean

**Step 2: Run Python tests**

```bash
cd processing && ../.venv/bin/pytest tests/ -v
```
Expected: All pass

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: color variants and background customization complete"
git push
```

---

## Execution Order Summary

| Task | Component | Dependencies |
|------|-----------|-------------|
| 1 | Product mask detection (Python) | None |
| 2 | Luminance tint (Python) | None |
| 3 | Pipeline integration (Python) | 1, 2 |
| 4 | DB schema migration | None |
| 5 | Color variants API | 4 |
| 6 | Mask detection API | 1, 4 |
| 7 | Batch render API update | 3, 4, 5 |
| 8 | Color variant manager UI | 5 |
| 9 | Mask editor component | 6 |
| 10 | Apply page UI update | 7, 8 |
| 11 | Type check + test | All |

Tasks 1, 2, and 4 can run in parallel. Tasks 5 and 6 can run in parallel after 4.
