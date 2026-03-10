# Curvature Feature Design

## Problem

The current 4-corner perspective warp only handles flat surfaces. Cylindrical products (mugs, bottles, candles, tubular pillows) need a barrel distortion so the design looks wrapped around the surface rather than pasted flat.

## Solution

Add a curvature parameter (intensity + axis) to the existing overlay config. The distortion is applied to the design image before the perspective warp — no changes to the rest of the pipeline.

## Data Model

Two new fields on `overlayConfig` JSON (no migration needed):

- `curvature`: float, -1.0 to 1.0. 0 = flat (default), positive = convex (mug facing you), negative = concave.
- `curveAxis`: `"auto"` | `"horizontal"` | `"vertical"`. Default `"auto"`.
  - Auto: if overlay quad is wider than tall, curve vertically (horizontal cylinder like a pillow); if taller than wide, curve horizontally (vertical cylinder like a mug).
  - Horizontal/Vertical: explicit override.

Existing templates without these fields default to `curvature=0, curveAxis="auto"` — fully backwards compatible.

## Processing Pipeline (Python)

New function `_apply_curvature(design, curvature, axis)` called before perspective warp:

1. Determine effective axis: if "auto", compare quad width vs height.
2. Build a coordinate remap using `cv2.remap()`.
3. For each pixel at normalized coordinate `t` (-1 to 1 from center along the curve axis):
   - New coordinate: `t * (1 + curvature * t^2)`
   - This is standard barrel (positive) / pincushion (negative) distortion on one axis.
4. The perpendicular axis is unchanged.
5. Return the distorted design image.

Pipeline order: fit to quad → **apply curvature** → perspective warp → displacement → composite.

## Editor UI

### Toolbar (advanced mode only)

Add after Transparency slider:
- **Curve** slider: range -1 to 1, step 0.05, displays as percentage (-100% to +100%)
- **Curve axis** segmented control: Auto / H / V (three small buttons)
- Short labels to fit mobile: "Curve:" and axis buttons

### Canvas Preview

- **Edit mode**: Draw left/right (or top/bottom) edges of overlay quad as quadratic bezier curves bowed inward by curvature amount, so the user sees the effect before previewing.
- **Preview mode**: Apply a canvas-based horizontal/vertical squeeze approximation within the clipped quad region.

## Files Changed

1. `frontend/src/lib/canvas-utils.ts` — Add `curvature` and `curveAxis` to OverlayConfig interface
2. `frontend/src/components/editor/toolbar.tsx` — Add Curve slider and axis toggle
3. `frontend/src/components/editor/mockup-canvas.tsx` — Curved quad edges in edit mode, curvature preview
4. `frontend/src/app/(app)/sets/[id]/templates/[templateId]/edit/page.tsx` — Wire curvature/axis state
5. `processing/app/transform.py` — New `_apply_curvature()` function, call it in `apply_perspective_transform()`
6. `processing/app/main.py` — Pass curvature params from overlayConfig to transform
