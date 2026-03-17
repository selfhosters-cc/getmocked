# Free Tools Design

## Overview

Add a suite of free image tools to Get Mocked to drive organic traffic (SEO), attract e-commerce sellers and designers, and funnel them into the core mockup product. Tools are split into public (browser-side, no login) for acquisition and login-required (server-side) for retention.

## Target Audience

E-commerce sellers (Etsy, Shopify, Amazon) and designers — broader than the core POD mockup audience to maximize reach.

## Site Structure

### URL Structure

Public tools (no login required):
- `/tools` — index page listing all tools
- `/tools/resize` — Image Resizer
- `/tools/crop` — Image Cropper
- `/tools/convert` — Format Converter
- `/tools/compress` — Image Compressor
- `/tools/dpi` — DPI Checker/Converter

Login-required tools:
- `/tools/background-remover` — Background Remover
- `/tools/color-variants` — Color Variant Generator
- `/tools/pattern-preview` — Tile/Pattern Repeat Preview
- `/tools/watermark` — Batch Watermark Adder

### Navigation

- Add "Free Tools" link to the landing page navbar
- Add "Free Tools" link to the authenticated sidebar
- `/tools` index page serves as both SEO landing page and navigation hub

### Route Groups

- New `(tools)` route group for public tool pages — minimal layout with navbar, no sidebar
- Login-required tools reuse the `(app)` layout with sidebar
- Login-required tool pages redirect to login if unauthenticated, but show a preview/description + sample before/after first

## Usage Tracking

### Data Model

```prisma
model ToolUsage {
  id        Int      @id @default(autoincrement())
  tool      String   // e.g. "resize", "crop", "convert"
  userId    Int?     @map("user_id")  // null for anonymous public use
  user      User?    @relation(fields: [userId], references: [id])
  createdAt DateTime @default(now()) @map("created_at")

  @@map("tool_usage")
}
```

- Public tools: log with `userId: null` (anonymous) or userId if logged in
- Login-required tools: always log with userId
- Queryable for: usage per tool over time, signup conversion patterns, peak usage

## Public Tools (Browser-Side)

All run entirely in the browser using Canvas API. No server cost, instant results.

### Image Resizer
- Upload image, choose output dimensions
- Preset categories:
  - Etsy: 2700x2025, 1500x1200
  - Shopify: 2048x2048
  - Amazon: 2560x2560
  - Social Media: 1080x1080 (IG), 1200x628 (FB), 1500x500 (Twitter banner)
- Custom width/height with lock-aspect-ratio toggle
- Live preview, download button

### Image Cropper
- Upload image, drag a crop region
- Aspect ratio presets: Free, 1:1, 4:3, 3:2, 16:9, Etsy listing 4:3, Shopify square
- Drag to reposition, resize handles on corners/edges
- Live preview, download button

### Format Converter
- Upload image(s) — supports PNG, JPG, WebP, GIF
- Pick target format from dropdown
- Quality slider for JPG/WebP (1-100)
- Batch support — convert multiple files at once
- Download individually or as ZIP

### Image Compressor
- Upload image(s)
- Quality slider with live file size estimate
- Side-by-side preview (original vs compressed)
- Shows percentage saved
- Batch support + ZIP download

### DPI Checker/Converter
- Upload image, displays current dimensions and estimated DPI
- Input desired DPI + physical print size (inches/cm), calculates required pixel dimensions
- Sufficiency indicator (green/yellow/red) for target print size
- Option to resample to target DPI

### Shared UX Pattern (Public Tools)
- Drag-and-drop upload zone (consistent with existing upload components)
- Tool runs instantly in browser — no loading spinner needed
- CTA at bottom: "Need product mockups? Try Get Mocked for free" linking to signup
- Each tool page has SEO-friendly heading, short description, and FAQ section

## Login-Required Tools (Server-Side)

These hit the processing service (Python/FastAPI) using OpenCV/Pillow. No paid third-party APIs.

### Background Remover
- Upload image
- Two modes:
  - White/solid background removal — reuse existing white background removal code from design upload flow (threshold-based)
  - Contrast-based removal — OpenCV contour detection, finds largest foreground object
- Tolerance slider to fine-tune threshold
- Preview with checkerboard transparency background
- Download as PNG (preserving alpha)

### Color Variant Generator
- Upload a product photo
- Pick multiple colors (color picker + hex input)
- Reuse existing luminance-preserving tint code from processing service
- Preview all variants in a grid
- Download individually or as ZIP
- Use case: sellers showing "available in 12 colors" without photographing each

### Tile/Pattern Repeat Preview
- Upload a design/pattern
- Repeat modes: straight, half-drop, half-brick, mirror
- Adjustable scale slider
- Large preview area (4x4 grid) to check seams
- Optional: overlay on preset surface (fabric, wall, wrapping paper) using existing warp code
- Download tiled output at chosen size
- Target: fabric/wallpaper/wrapping paper POD sellers

### Batch Watermark Adder
- Upload image(s)
- Watermark options:
  - Text: custom text, font size, color, opacity slider
  - Image: upload logo/watermark, opacity slider
- Position: 9-point grid (top-left through bottom-right) or tiled/diagonal repeat
- Live preview on first image, applies to all in batch
- Download individually or as ZIP

### Shared UX Pattern (Login-Required Tools)
- Same drag-and-drop upload pattern
- Unauthenticated visitors see tool description + sample before/after with "Sign up free to use this tool" CTA
- Processing requests go through API routes → processing service
- ToolUsage logged automatically on each use

## Technical Implementation

### Frontend

- New `(tools)` route group for public tool pages with minimal layout (navbar, no sidebar)
- Login-required tools under `(app)` layout with sidebar
- Shared `ToolLayout` component: upload zone, preview area, controls panel, download button, CTA banner
- Client-side tools use Canvas API directly
- Server-side tools call new API routes under `/api/tools/`

### New API Routes

```
POST /api/tools/background-remove   — accepts image, returns processed image
POST /api/tools/color-variants      — accepts image + colors array, returns ZIP
POST /api/tools/pattern-tile        — accepts image + repeat config, returns tiled image
POST /api/tools/watermark           — accepts image(s) + watermark config, returns ZIP
POST /api/tools/usage               — logs tool usage (public + server tools)
```

### Processing Service Additions

New FastAPI endpoints:
```
POST /background-remove   — threshold + contour-based removal
POST /color-variants      — batch tint (reuses existing tint code)
POST /pattern-tile        — tile generation with repeat modes
POST /watermark           — text/image overlay with positioning
```

Background remove and color variants mostly reuse existing code. Pattern tile and watermark are new but straightforward with Pillow.

### Usage Tracking Flow

- Public tools: frontend calls `POST /api/tools/usage` with tool name after each successful use
- Server tools: API route logs usage automatically before returning result
- Auth token checked but not required on usage endpoint — logs userId if available, null if not

### File Handling

- Public tools: everything in-browser, no files touch the server
- Server tools: uploaded file processed in memory, result streamed back. No permanent storage — stateless operations

## SEO & Conversion Strategy

### SEO
- Each public tool page: unique `<title>` and `<meta description>` targeting primary keyword (e.g., "Free Image Resizer for Etsy Sellers | Get Mocked")
- H1 heading with tool name, short intro paragraph
- FAQ section (3-5 questions) targeting long-tail searches (e.g., "what size should Etsy listing photos be")
- `/tools` index page targets "free image tools for e-commerce"
- Clean URL structure

### Conversion Funnel
- Every public tool page: subtle banner below result — "Need product mockups? Create them free with Get Mocked"
- After 2-3 uses in a session: slightly more prominent CTA (highlighted banner, not a popup)
- Login-required tool pages: compelling before/after preview for unauthenticated visitors before signup prompt
- `/tools` index: clearly marks which tools are free/instant vs require a free account

### No Aggressive Gating
- Public tools fully functional with no limits — builds trust and SEO value
- Login-required tools gated because they use server resources (legitimate, understandable reason)
