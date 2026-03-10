# Color Variants & Background Customization Design

## Problem

Etsy POD sellers need the same design rendered across multiple product colors (navy tee, black tee, white tee) and need output options (transparent background, solid color) for listing images. Currently they must manually create each variant.

## Features

### 1. Color Variant System

**Data model:**
- `colorVariants` JSON array on `MockupSet`: `[{ name: "Navy", hex: "#1a2744" }, ...]`
- No new DB table — colors apply to the whole set
- Batch render matrix: templates × designs × colors

**Product mask generation (Python):**
- Auto-detect: LAB color space, threshold background (high lightness + low saturation = studio white/gray), invert for product mask
- GaussianBlur mask edges for smooth transitions
- Cache mask as PNG: `templates/{setId}/{templateId}_mask.png`
- Regenerate on user refinement

**Tinting pipeline:**
- Convert product region to grayscale (luminance)
- Multiply luminance by target color RGB (normalized)
- Blend using product mask — background untouched, product recolored
- Pipeline order: auto-mask → tint product → fit design → curvature → perspective warp → displacement → composite

**Mask refinement (Editor UI):**
- "Detect Product" button in template editor runs auto-detection
- Shows mask overlay (green tint on detected area)
- Brush tool: paint to add/remove from mask (include/exclude modes)
- Brush size slider
- Live tinted preview for immediate quality feedback
- Mask saved alongside overlay config

### 2. Background Customization

**Output options (per batch):**
- Original — keep template background (default)
- Transparent — remove background, output PNG with alpha
- Solid color — replace background with chosen color

**Implementation:**
- Uses inverted product mask as background mask
- Post-processing step after composite: transparent sets alpha=0, solid replaces background pixels
- Transparent always outputs PNG; solid/original outputs PNG or JPEG

**UI on Apply Design page:**
- "Output" section: three radio buttons (Original / Transparent / Solid)
- Solid shows color input
- Between design selection and render button

### 3. Batch Render Matrix

**Apply Design page:**
- New "Select Colors" step with swatch toggles
- "Original" (no tint) always available
- Render count preview: "8 templates × 3 colors = 24 mockups"

**API:**
- `POST /api/render/batch` new fields: `colorVariants: string[]`, `outputMode`, `outputColor?`
- One `RenderedMockup` per template × color
- `renderOptions` JSON field on RenderedMockup for display

**ZIP download:**
- Organized by color folders: `Navy/template-1.png`, `Black/template-1.png`

## Files Changed

### Python (processing service)
1. `processing/app/mask.py` — NEW: auto product mask detection (LAB threshold + grabCut refinement)
2. `processing/app/tint.py` — NEW: luminance-preserving color tinting
3. `processing/app/transform.py` — Accept tint color + mask path, apply tint before composite; accept output mode, apply background removal after composite
4. `processing/app/main.py` — New endpoints: `POST /detect-mask`, updated `/render` with color/output params

### Frontend (Next.js)
5. `frontend/prisma/schema.prisma` — Add `colorVariants` JSON field to MockupSet, add `renderOptions` JSON field to RenderedMockup
6. `frontend/src/lib/canvas-utils.ts` — Add mask-related types
7. `frontend/src/components/editor/mask-editor.tsx` — NEW: mask visualization + brush refinement tool
8. `frontend/src/components/editor/toolbar.tsx` — Add "Detect Product" button
9. `frontend/src/app/(app)/sets/[id]/templates/[templateId]/edit/page.tsx` — Wire mask editor
10. `frontend/src/app/(app)/sets/[id]/page.tsx` — Color variant management UI on set detail page
11. `frontend/src/app/(app)/sets/[id]/apply/page.tsx` — Color selection swatches + output mode controls
12. `frontend/src/app/api/render/batch/route.ts` — Handle color variants × templates matrix, pass output options
13. `frontend/src/app/api/mockup-sets/[id]/route.ts` — Support colorVariants CRUD
14. `frontend/src/app/api/mockup-sets/[id]/templates/[templateId]/mask/route.ts` — NEW: trigger mask detection, save refined mask
15. `frontend/src/lib/api.ts` — New API methods for mask + color variants
