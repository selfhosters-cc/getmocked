# Free Tools Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 9 free image tools (5 public browser-side, 4 login-required server-side) to drive organic traffic and convert visitors into mockup users.

**Architecture:** Public tools run entirely client-side (Canvas API) in a new `(tools)` route group with minimal layout. Login-required tools call new API routes that proxy to the FastAPI processing service. A `ToolUsage` Prisma model tracks all usage. Navigation links added to landing page and sidebar.

**Tech Stack:** Next.js 14 App Router, Canvas API (client-side tools), FastAPI + OpenCV + Pillow (server-side tools), Prisma/Postgres (usage tracking), Tailwind CSS.

---

## Phase 1: Database & Infrastructure

### Task 1: Add ToolUsage Prisma Model

**Files:**
- Modify: `frontend/prisma/schema.prisma`

**Step 1: Add ToolUsage model to schema**

Add to the end of `schema.prisma`, and add `toolUsages ToolUsage[]` relation to the `User` model:

```prisma
model ToolUsage {
  id        String   @id @default(uuid())
  tool      String
  userId    String?  @map("user_id")
  user      User?    @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now()) @map("created_at")

  @@map("tool_usage")
}
```

On the User model, add:
```prisma
toolUsages    ToolUsage[]
```

**Step 2: Run migration**

```bash
cd frontend && npx prisma migrate dev --name add_tool_usage
```

**Step 3: Verify Prisma client generated**

```bash
cd frontend && npx prisma generate
```

**Step 4: Commit**

```bash
git add frontend/prisma/
git commit -m "feat: add ToolUsage model for tracking free tool usage"
```

---

### Task 2: Create Usage Tracking API Route

**Files:**
- Create: `frontend/src/app/api/tools/usage/route.ts`
- Test: `frontend/src/__tests__/api/tools-usage.test.ts`

**Step 1: Write the failing test**

```typescript
// frontend/src/__tests__/api/tools-usage.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('next/headers', () => ({ cookies: vi.fn() }))

const mockCreate = vi.fn()
vi.mock('@/lib/server/prisma', () => ({
  prisma: { toolUsage: { create: (...args: unknown[]) => mockCreate(...args) } }
}))

vi.mock('@/lib/server/auth', () => ({
  getAuthUserId: vi.fn(),
}))

import { POST } from '@/app/api/tools/usage/route'
import { getAuthUserId } from '@/lib/server/auth'

describe('POST /api/tools/usage', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('logs usage with userId when authenticated', async () => {
    vi.mocked(getAuthUserId).mockResolvedValue('user-123')
    mockCreate.mockResolvedValue({ id: '1', tool: 'resize', userId: 'user-123' })

    const req = new NextRequest('http://localhost/api/tools/usage', {
      method: 'POST',
      body: JSON.stringify({ tool: 'resize' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(mockCreate).toHaveBeenCalledWith({
      data: { tool: 'resize', userId: 'user-123' }
    })
  })

  it('logs usage without userId when not authenticated', async () => {
    vi.mocked(getAuthUserId).mockResolvedValue(null)
    mockCreate.mockResolvedValue({ id: '2', tool: 'crop', userId: null })

    const req = new NextRequest('http://localhost/api/tools/usage', {
      method: 'POST',
      body: JSON.stringify({ tool: 'crop' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(mockCreate).toHaveBeenCalledWith({
      data: { tool: 'crop', userId: null }
    })
  })

  it('returns 400 for missing tool name', async () => {
    vi.mocked(getAuthUserId).mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/tools/usage', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/__tests__/api/tools-usage.test.ts
```

Expected: FAIL — module not found.

**Step 3: Write the route**

```typescript
// frontend/src/app/api/tools/usage/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/server/prisma'
import { getAuthUserId } from '@/lib/server/auth'

const usageSchema = z.object({
  tool: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = usageSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'tool is required' }, { status: 400 })
  }

  const userId = await getAuthUserId()

  const usage = await prisma.toolUsage.create({
    data: { tool: parsed.data.tool, userId },
  })

  return NextResponse.json(usage, { status: 201 })
}
```

Note: `getAuthUserId()` should return `string | null` — it returns the userId if a valid token is present, null otherwise (does not throw). Check `frontend/src/lib/server/auth.ts` — if this function doesn't exist, add it: read the token from cookies, verify, return userId or null. The existing `requireAuth()` throws on missing auth; we need a non-throwing variant.

**Step 4: Run test to verify it passes**

```bash
cd frontend && npx vitest run src/__tests__/api/tools-usage.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/app/api/tools/usage/ frontend/src/__tests__/api/tools-usage.test.ts
git commit -m "feat: add tool usage tracking API route"
```

---

### Task 3: Create Tools Layout and Index Page

**Files:**
- Create: `frontend/src/app/(tools)/layout.tsx`
- Create: `frontend/src/app/(tools)/tools/page.tsx`

**Step 1: Create the tools layout**

This is a public layout — no auth required. Minimal navbar with logo, "Free Tools" text, and sign-in link. Reference the landing page (`frontend/src/app/page.tsx`) for styling patterns.

```tsx
// frontend/src/app/(tools)/layout.tsx
'use client'

import Link from 'next/link'

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-gray-900">
            Get Mocked
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/tools" className="text-sm text-gray-600 hover:text-gray-900">
              Free Tools
            </Link>
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">
              Sign In
            </Link>
            <Link
              href="/signup"
              className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Get Started Free
            </Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
```

**Step 2: Create the tools index page**

```tsx
// frontend/src/app/(tools)/tools/page.tsx
import Link from 'next/link'
import { Maximize, Crop, RefreshCw, Archive, Ruler, Eraser, Palette, Grid3X3, Stamp } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Free Image Tools for E-Commerce Sellers | Get Mocked',
  description: 'Free online image tools for e-commerce sellers and designers. Resize, crop, convert, compress images and more. No signup required.',
}

const publicTools = [
  {
    slug: 'resize',
    name: 'Image Resizer',
    description: 'Resize images with e-commerce platform presets for Etsy, Shopify, Amazon, and social media.',
    icon: Maximize,
  },
  {
    slug: 'crop',
    name: 'Image Cropper',
    description: 'Crop images with preset aspect ratios for e-commerce listings and social media.',
    icon: Crop,
  },
  {
    slug: 'convert',
    name: 'Format Converter',
    description: 'Convert images between PNG, JPG, WebP, and GIF. Adjust quality for optimal file size.',
    icon: RefreshCw,
  },
  {
    slug: 'compress',
    name: 'Image Compressor',
    description: 'Compress images to reduce file size while maintaining quality. Side-by-side preview.',
    icon: Archive,
  },
  {
    slug: 'dpi',
    name: 'DPI Checker',
    description: 'Check image DPI and calculate if your design is high enough resolution for print.',
    icon: Ruler,
  },
]

const loginTools = [
  {
    slug: 'background-remover',
    name: 'Background Remover',
    description: 'Remove white or solid backgrounds from product photos. Adjustable threshold.',
    icon: Eraser,
    requiresLogin: true,
  },
  {
    slug: 'color-variants',
    name: 'Color Variant Generator',
    description: 'Generate color variants of your product photo. Show "available in 12 colors" instantly.',
    icon: Palette,
    requiresLogin: true,
  },
  {
    slug: 'pattern-preview',
    name: 'Pattern Repeat Preview',
    description: 'Preview how your design tiles as a repeating pattern for fabric, wallpaper, or wrapping paper.',
    icon: Grid3X3,
    requiresLogin: true,
  },
  {
    slug: 'watermark',
    name: 'Batch Watermark',
    description: 'Add text or image watermarks to your product photos. Batch processing supported.',
    icon: Stamp,
    requiresLogin: true,
  },
]

export default function ToolsIndexPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Free Image Tools for E-Commerce
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Professional image tools built for online sellers and designers. No watermarks, no limits on free tools.
        </p>
      </div>

      <h2 className="text-2xl font-semibold text-gray-900 mb-6">
        Instant Tools — No Signup Required
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {publicTools.map((tool) => (
          <Link
            key={tool.slug}
            href={`/tools/${tool.slug}`}
            className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <tool.icon className="w-8 h-8 text-blue-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{tool.name}</h3>
            <p className="text-sm text-gray-600">{tool.description}</p>
          </Link>
        ))}
      </div>

      <h2 className="text-2xl font-semibold text-gray-900 mb-6">
        Advanced Tools — Free Account Required
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {loginTools.map((tool) => (
          <Link
            key={tool.slug}
            href={`/tools/${tool.slug}`}
            className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow relative"
          >
            <div className="absolute top-4 right-4 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
              Free account
            </div>
            <tool.icon className="w-8 h-8 text-blue-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{tool.name}</h3>
            <p className="text-sm text-gray-600">{tool.description}</p>
          </Link>
        ))}
      </div>

      <div className="bg-blue-50 rounded-xl p-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Need Product Mockups?</h2>
        <p className="text-gray-600 mb-6">
          Create professional product mockups for your e-commerce listings. Batch generate, perspective-accurate, with Etsy integration.
        </p>
        <Link
          href="/signup"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
        >
          Get Started — It&apos;s Free
        </Link>
      </div>
    </div>
  )
}
```

**Step 3: Verify pages render**

```bash
cd frontend && npm run build
```

Should compile without errors.

**Step 4: Commit**

```bash
git add frontend/src/app/\(tools\)/
git commit -m "feat: add tools layout and index page"
```

---

### Task 4: Create Shared ToolLayout Component

**Files:**
- Create: `frontend/src/components/tool-layout.tsx`

**Step 1: Create the shared layout component**

This component provides the common structure for every tool page: title, description, upload zone, controls area, preview area, download button, and CTA banner.

```tsx
// frontend/src/components/tool-layout.tsx
'use client'

import { useCallback, useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import Link from 'next/link'
import { useFileDrop } from '@/hooks/use-file-drop'

interface ToolLayoutProps {
  title: string
  description: string
  accept?: string
  multiple?: boolean
  children: (props: {
    files: File[]
    setFiles: (files: File[]) => void
    clearFiles: () => void
  }) => React.ReactNode
  faq?: { question: string; answer: string }[]
}

export default function ToolLayout({
  title,
  description,
  accept = 'image/*',
  multiple = false,
  children,
  faq,
}: ToolLayoutProps) {
  const [files, setFiles] = useState<File[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const onDrop = useCallback((dropped: File[]) => {
    setFiles(multiple ? dropped : dropped.slice(0, 1))
  }, [multiple])

  const { isDragging, dropProps } = useFileDrop(onDrop, accept)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || [])
    setFiles(multiple ? selected : selected.slice(0, 1))
    if (inputRef.current) inputRef.current.value = ''
  }

  const clearFiles = () => setFiles([])

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{title}</h1>
        <p className="text-gray-600">{description}</p>
      </div>

      {files.length === 0 ? (
        <div
          {...dropProps}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-700 mb-1">
            Drop {multiple ? 'images' : 'an image'} here or click to upload
          </p>
          <p className="text-sm text-gray-500">PNG, JPG, WebP, GIF supported</p>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={handleInputChange}
            className="hidden"
          />
        </div>
      ) : (
        children({ files, setFiles, clearFiles })
      )}

      {/* CTA Banner */}
      <div className="mt-12 bg-blue-50 rounded-xl p-6 text-center">
        <p className="text-gray-700 mb-3">
          Need product mockups? Create professional mockups for your e-commerce listings.
        </p>
        <Link
          href="/signup"
          className="inline-block bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          Try Get Mocked Free
        </Link>
      </div>

      {/* FAQ Section */}
      {faq && faq.length > 0 && (
        <div className="mt-12">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {faq.map((item, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="font-medium text-gray-900 mb-2">{item.question}</h3>
                <p className="text-sm text-gray-600">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/tool-layout.tsx
git commit -m "feat: add shared ToolLayout component for free tools"
```

---

### Task 5: Add Usage Tracking Helper

**Files:**
- Create: `frontend/src/lib/track-tool-usage.ts`

**Step 1: Create the client-side helper**

```typescript
// frontend/src/lib/track-tool-usage.ts
export async function trackToolUsage(tool: string) {
  try {
    await fetch('/api/tools/usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ tool }),
    })
  } catch {
    // Silently fail — usage tracking should never block the user
  }
}
```

**Step 2: Commit**

```bash
git add frontend/src/lib/track-tool-usage.ts
git commit -m "feat: add client-side tool usage tracking helper"
```

---

## Phase 2: Public Browser-Side Tools

### Task 6: Image Resizer Tool

**Files:**
- Create: `frontend/src/app/(tools)/tools/resize/page.tsx`

**Step 1: Create the resizer page**

Key functionality:
- Upload image, display it on a canvas
- Preset dropdown grouped by platform (Etsy, Shopify, Amazon, Social Media) with specific pixel dimensions
- Custom width/height inputs with a lock-aspect-ratio toggle
- Live preview of resized image on a second canvas
- Download button that exports the canvas as PNG
- Call `trackToolUsage('resize')` on each download

Presets to include:
```typescript
const presets = [
  { group: 'Etsy', options: [
    { label: 'Etsy Listing (2700×2025)', width: 2700, height: 2025 },
    { label: 'Etsy Thumbnail (1500×1200)', width: 1500, height: 1200 },
  ]},
  { group: 'Shopify', options: [
    { label: 'Shopify Product (2048×2048)', width: 2048, height: 2048 },
  ]},
  { group: 'Amazon', options: [
    { label: 'Amazon Main (2560×2560)', width: 2560, height: 2560 },
  ]},
  { group: 'Social Media', options: [
    { label: 'Instagram Post (1080×1080)', width: 1080, height: 1080 },
    { label: 'Facebook Share (1200×628)', width: 1200, height: 628 },
    { label: 'Twitter Banner (1500×500)', width: 1500, height: 500 },
  ]},
]
```

Use `ToolLayout` for the upload zone. After upload, render a controls panel (presets, custom inputs, lock ratio) alongside a canvas preview. Use `canvas.toBlob()` for download.

Add metadata export:
```typescript
export const metadata: Metadata = {
  title: 'Free Image Resizer for E-Commerce | Get Mocked',
  description: 'Resize images for Etsy, Shopify, Amazon listings and social media. Free, instant, no signup required.',
}
```

**Step 2: Verify it renders**

```bash
cd frontend && npm run build
```

**Step 3: Commit**

```bash
git add frontend/src/app/\(tools\)/tools/resize/
git commit -m "feat: add image resizer tool with e-commerce presets"
```

---

### Task 7: Image Cropper Tool

**Files:**
- Create: `frontend/src/app/(tools)/tools/crop/page.tsx`

**Step 1: Create the cropper page**

Key functionality:
- Upload image, display on canvas
- Draggable crop rectangle with resize handles on corners and edges
- Aspect ratio preset buttons: Free, 1:1, 4:3, 3:2, 16:9, Etsy (4:3), Shopify (1:1)
- When a ratio is selected, constrain the crop rectangle
- Live preview of cropped area
- Download cropped image
- Call `trackToolUsage('crop')` on download

Implementation approach:
- Use a `<canvas>` to display the image with a dark overlay outside the crop area
- Track mouse events (mousedown, mousemove, mouseup) for drag and resize
- State: `{ x, y, width, height }` for crop rectangle
- On download: create offscreen canvas, `drawImage()` with source crop coordinates, `toBlob()`

Add SEO metadata for "Free Image Cropper for E-Commerce".

**Step 2: Verify it renders**

```bash
cd frontend && npm run build
```

**Step 3: Commit**

```bash
git add frontend/src/app/\(tools\)/tools/crop/
git commit -m "feat: add image cropper tool with aspect ratio presets"
```

---

### Task 8: Format Converter Tool

**Files:**
- Create: `frontend/src/app/(tools)/tools/convert/page.tsx`

**Step 1: Create the converter page**

Key functionality:
- Upload one or more images
- Target format dropdown: PNG, JPEG, WebP
- Quality slider (1-100) visible for JPEG and WebP only
- Batch support: show a list of files with their current format and size
- Convert all: draw each image on an offscreen canvas, export via `canvas.toBlob(targetMimeType, quality)`
- Download individually or as ZIP (use JSZip library — add to package.json)
- Call `trackToolUsage('convert')` on download

Note: GIF input is supported (browser can decode it) but GIF output is not (Canvas can't encode GIF). Show a note if user picks GIF as source and wants to convert.

Add `jszip` dependency:
```bash
cd frontend && npm install jszip
```

Add SEO metadata for "Free Image Format Converter".

**Step 2: Verify it renders**

```bash
cd frontend && npm run build
```

**Step 3: Commit**

```bash
git add frontend/src/app/\(tools\)/tools/convert/ frontend/package.json frontend/package-lock.json
git commit -m "feat: add image format converter tool with batch support"
```

---

### Task 9: Image Compressor Tool

**Files:**
- Create: `frontend/src/app/(tools)/tools/compress/page.tsx`

**Step 1: Create the compressor page**

Key functionality:
- Upload one or more images
- Quality slider (1-100, default 80)
- For each image show side-by-side: original (left) and compressed preview (right)
- Display original file size, compressed file size, and percentage saved
- Use `canvas.toBlob('image/jpeg', quality/100)` for compression — re-encode as JPEG
- Option to keep as PNG if the original was PNG (lossless, but can still reduce via canvas re-encode)
- Batch support + ZIP download (reuse JSZip from Task 8)
- Call `trackToolUsage('compress')` on download

Implementation note: Use `canvas.toBlob()` with a callback, get the blob size via `blob.size`, compare to original `file.size`.

Add SEO metadata for "Free Image Compressor".

**Step 2: Verify it renders**

```bash
cd frontend && npm run build
```

**Step 3: Commit**

```bash
git add frontend/src/app/\(tools\)/tools/compress/
git commit -m "feat: add image compressor tool with side-by-side preview"
```

---

### Task 10: DPI Checker/Converter Tool

**Files:**
- Create: `frontend/src/app/(tools)/tools/dpi/page.tsx`

**Step 1: Create the DPI checker page**

Key functionality:
- Upload image, display dimensions (pixels)
- Show estimated DPI (note: browser cannot read EXIF DPI reliably, so display pixel dimensions and let user input current DPI, default 72)
- Input fields: desired DPI, desired physical print size (width × height in inches or cm, toggle)
- Calculate: required pixels = physical_size × DPI
- Sufficiency indicator:
  - Green: image has >= required pixels (both dimensions)
  - Yellow: image is within 80% of required pixels
  - Red: image is too small
- Option to resample: use canvas to resize to exact required pixel dimensions
- Download resampled image
- Call `trackToolUsage('dpi')` on download

Useful presets for print sizes:
```typescript
const printPresets = [
  { label: '4×6 inches (Postcard)', width: 4, height: 6 },
  { label: '8×10 inches (Print)', width: 8, height: 10 },
  { label: '11×14 inches (Poster)', width: 11, height: 14 },
  { label: '16×20 inches (Large)', width: 16, height: 20 },
]
```

Add SEO metadata for "Free DPI Checker for Print on Demand".

**Step 2: Verify it renders**

```bash
cd frontend && npm run build
```

**Step 3: Commit**

```bash
git add frontend/src/app/\(tools\)/tools/dpi/
git commit -m "feat: add DPI checker/converter tool for print sellers"
```

---

## Phase 3: Processing Service Endpoints

### Task 11: Add Background Removal Endpoint

**Files:**
- Modify: `processing/app/main.py`
- Test: `processing/tests/test_tools.py`

**Step 1: Write the failing test**

```python
# processing/tests/test_tools.py
from PIL import Image
import io
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_background_remove_white():
    """White background should become transparent."""
    img = Image.new("RGB", (100, 100), color=(255, 255, 255))
    # Draw a colored square in the center
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
    # Corner pixel should be transparent
    assert result.getpixel((0, 0))[3] < 50
    # Center pixel should be opaque
    assert result.getpixel((50, 50))[3] > 200
```

**Step 2: Run test to verify it fails**

```bash
cd processing && pytest tests/test_tools.py::test_background_remove_white -v
```

Expected: FAIL — no route `/background-remove`.

**Step 3: Implement the endpoint**

Add to `processing/app/main.py`:

```python
from fastapi import UploadFile, File, Form

@app.post("/background-remove")
async def background_remove(
    image: UploadFile = File(...),
    threshold: int = Form(240),
    mode: str = Form("white"),  # "white" or "contour"
):
    """Remove background from image. Returns PNG with transparency."""
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
    """Remove white/light background using threshold."""
    import cv2
    rgba = np.array(img.convert("RGBA"))
    rgb = rgba[:, :, :3].astype(np.float32)
    bg_mask = (rgb[:, :, 0] > threshold) & (rgb[:, :, 1] > threshold) & (rgb[:, :, 2] > threshold)
    bg_mask_float = bg_mask.astype(np.float32)
    bg_mask_smooth = cv2.GaussianBlur(bg_mask_float, (5, 5), 0)
    rgba[:, :, 3] = ((1.0 - bg_mask_smooth) * 255).clip(0, 255).astype(np.uint8)
    return Image.fromarray(rgba)


def _contour_background_remove(img: Image.Image, threshold: int) -> Image.Image:
    """Remove background using contour detection — find largest foreground object."""
    import cv2
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
```

Also add required imports at the top of `main.py`:

```python
import io
import numpy as np
from fastapi.responses import StreamingResponse
from fastapi import UploadFile, File, Form
```

**Step 4: Run test to verify it passes**

```bash
cd processing && pytest tests/test_tools.py::test_background_remove_white -v
```

Expected: PASS

**Step 5: Commit**

```bash
git add processing/app/main.py processing/tests/test_tools.py
git commit -m "feat: add background removal endpoint to processing service"
```

---

### Task 12: Add Color Variants Endpoint

**Files:**
- Modify: `processing/app/main.py`
- Modify: `processing/tests/test_tools.py`

**Step 1: Write the failing test**

```python
# Add to processing/tests/test_tools.py

def test_color_variants():
    """Should return a ZIP of tinted variants."""
    img = Image.new("RGB", (100, 100), color=(128, 128, 128))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    response = client.post(
        "/color-variants",
        files={"image": ("test.png", buf, "image/png")},
        data={"colors": "#ff0000,#00ff00,#0000ff"},
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"

    import zipfile
    z = zipfile.ZipFile(io.BytesIO(response.content))
    assert len(z.namelist()) == 3
```

**Step 2: Run test to verify it fails**

```bash
cd processing && pytest tests/test_tools.py::test_color_variants -v
```

**Step 3: Implement the endpoint**

Reuse the tinting logic from `processing/app/tint.py`. The existing `tint_product()` requires a mask — for the standalone tool, use a simple approach: convert to grayscale, multiply by target color (treating the whole image as product).

```python
@app.post("/color-variants")
async def color_variants(
    image: UploadFile = File(...),
    colors: str = Form(...),  # Comma-separated hex colors: "#ff0000,#00ff00"
):
    """Generate color-tinted variants of an image. Returns ZIP of PNGs."""
    import zipfile

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
    """Tint entire image with a color using luminance preservation."""
    import cv2
    rgb = np.array(img).astype(np.float32)
    gray = cv2.cvtColor(rgb.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)
    lum = gray / 255.0

    r = int(hex_color[1:3], 16)
    g = int(hex_color[3:5], 16)
    b = int(hex_color[5:7], 16)

    tinted = np.zeros_like(rgb)
    tinted[:, :, 0] = lum * r
    tinted[:, :, 1] = lum * g
    tinted[:, :, 2] = lum * b

    return Image.fromarray(tinted.clip(0, 255).astype(np.uint8))
```

**Step 4: Run test to verify it passes**

```bash
cd processing && pytest tests/test_tools.py::test_color_variants -v
```

**Step 5: Commit**

```bash
git add processing/app/main.py processing/tests/test_tools.py
git commit -m "feat: add color variants endpoint to processing service"
```

---

### Task 13: Add Pattern Tile Endpoint

**Files:**
- Modify: `processing/app/main.py`
- Modify: `processing/tests/test_tools.py`

**Step 1: Write the failing test**

```python
# Add to processing/tests/test_tools.py

def test_pattern_tile_straight():
    """Straight repeat should produce a larger tiled image."""
    img = Image.new("RGB", (100, 100), color=(200, 100, 50))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    response = client.post(
        "/pattern-tile",
        files={"image": ("test.png", buf, "image/png")},
        data={"mode": "straight", "cols": "3", "rows": "3"},
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"

    result = Image.open(io.BytesIO(response.content))
    assert result.size == (300, 300)
```

**Step 2: Run test to verify it fails**

```bash
cd processing && pytest tests/test_tools.py::test_pattern_tile_straight -v
```

**Step 3: Implement the endpoint**

```python
@app.post("/pattern-tile")
async def pattern_tile(
    image: UploadFile = File(...),
    mode: str = Form("straight"),  # straight, half_drop, half_brick, mirror
    cols: int = Form(4),
    rows: int = Form(4),
    scale: float = Form(1.0),  # 0.25 to 2.0
):
    """Generate a tiled pattern from an image. Returns PNG."""
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
            # Crop tile if it extends beyond canvas
            paste_w = min(tile.width, canvas.width - x)
            paste_h = min(tile.height, canvas.height - y)
            if paste_w > 0 and paste_h > 0 and x >= 0 and y >= 0:
                cropped = tile.crop((0, 0, paste_w, paste_h))
                canvas.paste(cropped, (x, y), cropped)

    buf = io.BytesIO()
    canvas.save(buf, format="PNG")
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/png")
```

**Step 4: Run test to verify it passes**

```bash
cd processing && pytest tests/test_tools.py::test_pattern_tile_straight -v
```

**Step 5: Commit**

```bash
git add processing/app/main.py processing/tests/test_tools.py
git commit -m "feat: add pattern tile endpoint to processing service"
```

---

### Task 14: Add Watermark Endpoint

**Files:**
- Modify: `processing/app/main.py`
- Modify: `processing/tests/test_tools.py`

**Step 1: Write the failing test**

```python
# Add to processing/tests/test_tools.py

def test_watermark_text():
    """Text watermark should produce an image."""
    img = Image.new("RGB", (400, 300), color=(100, 150, 200))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    response = client.post(
        "/watermark",
        files={"image": ("test.png", buf, "image/png")},
        data={
            "text": "SAMPLE",
            "opacity": "50",
            "position": "center",
            "font_size": "24",
            "color": "#ffffff",
        },
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"

    result = Image.open(io.BytesIO(response.content))
    assert result.size == (400, 300)
```

**Step 2: Run test to verify it fails**

```bash
cd processing && pytest tests/test_tools.py::test_watermark_text -v
```

**Step 3: Implement the endpoint**

```python
from PIL import ImageDraw, ImageFont

@app.post("/watermark")
async def watermark(
    image: UploadFile = File(...),
    text: str = Form(None),
    watermark_image: UploadFile = File(None),
    opacity: int = Form(50),  # 0-100
    position: str = Form("center"),  # top-left, top-center, top-right, center-left, center, center-right, bottom-left, bottom-center, bottom-right, tiled
    font_size: int = Form(24),
    color: str = Form("#ffffff"),
):
    """Add text or image watermark. Returns PNG."""
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
    """Calculate x, y for watermark placement."""
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


def _create_text_watermark(
    size: tuple, text: str, font_size: int, color: str, alpha: int, position: str
) -> Image.Image:
    """Create a transparent layer with text watermark."""
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", font_size)
    except (OSError, IOError):
        font = ImageFont.load_default()

    r = int(color[1:3], 16)
    g = int(color[3:5], 16)
    b = int(color[5:7], 16)
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


def _create_image_watermark(
    size: tuple, wm: Image.Image, alpha: int, position: str
) -> Image.Image:
    """Create a transparent layer with image watermark."""
    # Scale watermark to max 30% of image width
    max_w = int(size[0] * 0.3)
    if wm.width > max_w:
        ratio = max_w / wm.width
        wm = wm.resize((max_w, int(wm.height * ratio)), Image.LANCZOS)

    # Apply alpha
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
```

**Step 4: Run test to verify it passes**

```bash
cd processing && pytest tests/test_tools.py::test_watermark_text -v
```

**Step 5: Commit**

```bash
git add processing/app/main.py processing/tests/test_tools.py
git commit -m "feat: add watermark endpoint to processing service"
```

---

## Phase 4: Login-Required Server-Side Tools

### Task 15: Add API Routes for Server-Side Tools

**Files:**
- Create: `frontend/src/app/api/tools/background-remove/route.ts`
- Create: `frontend/src/app/api/tools/color-variants/route.ts`
- Create: `frontend/src/app/api/tools/pattern-tile/route.ts`
- Create: `frontend/src/app/api/tools/watermark/route.ts`

**Step 1: Create the API routes**

Each route follows the same pattern: require auth, accept FormData, forward to processing service, stream the response back, log usage. Example for background-remove:

```typescript
// frontend/src/app/api/tools/background-remove/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/auth'
import { handleAuthError } from '@/lib/server/auth'
import { prisma } from '@/lib/server/prisma'

const PROCESSING_URL = process.env.PROCESSING_URL || 'http://processing:5000'

export async function POST(req: NextRequest) {
  let userId: string
  try {
    userId = await requireAuth()
  } catch (err) {
    return handleAuthError(err)
  }

  const formData = await req.formData()
  const image = formData.get('image') as File | null
  if (!image) {
    return NextResponse.json({ error: 'Image required' }, { status: 400 })
  }

  const proxyForm = new FormData()
  proxyForm.append('image', image)
  proxyForm.append('threshold', (formData.get('threshold') as string) || '240')
  proxyForm.append('mode', (formData.get('mode') as string) || 'white')

  const res = await fetch(`${PROCESSING_URL}/background-remove`, {
    method: 'POST',
    body: proxyForm,
  })

  if (!res.ok) {
    const error = await res.text()
    return NextResponse.json({ error }, { status: res.status })
  }

  // Log usage
  await prisma.toolUsage.create({ data: { tool: 'background-remover', userId } })

  const blob = await res.blob()
  return new NextResponse(blob, {
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'image/png',
    },
  })
}
```

Follow the same pattern for:
- `/api/tools/color-variants/route.ts` — forwards `image` + `colors` to `PROCESSING_URL/color-variants`, returns ZIP
- `/api/tools/pattern-tile/route.ts` — forwards `image` + `mode` + `cols` + `rows` + `scale` to `PROCESSING_URL/pattern-tile`, returns PNG
- `/api/tools/watermark/route.ts` — forwards `image` + `text`/`watermark_image` + options to `PROCESSING_URL/watermark`, returns PNG

**Step 2: Verify build**

```bash
cd frontend && npm run build
```

**Step 3: Commit**

```bash
git add frontend/src/app/api/tools/
git commit -m "feat: add API proxy routes for server-side tools"
```

---

### Task 16: Background Remover Page

**Files:**
- Create: `frontend/src/app/(tools)/tools/background-remover/page.tsx`

**Step 1: Create the page**

Key functionality:
- Upload image
- Mode toggle: "White Background" / "Contour Detection"
- Threshold slider (200-255, default 240)
- "Remove Background" button that POSTs to `/api/tools/background-remove`
- Shows result with checkerboard transparency background (CSS pattern)
- Download as PNG button
- Must be authenticated — if not logged in, show preview description + "Sign up free" CTA instead of the tool
- Check auth state via the `useAuth()` hook from `frontend/src/lib/auth-context.tsx`

Add SEO metadata for "Free Background Remover".

**Step 2: Verify build**

```bash
cd frontend && npm run build
```

**Step 3: Commit**

```bash
git add frontend/src/app/\(tools\)/tools/background-remover/
git commit -m "feat: add background remover tool page"
```

---

### Task 17: Color Variant Generator Page

**Files:**
- Create: `frontend/src/app/(tools)/tools/color-variants/page.tsx`

**Step 1: Create the page**

Key functionality:
- Upload product photo
- Color picker + hex input, "Add Color" button, list of selected colors (removable)
- "Generate Variants" button that POSTs to `/api/tools/color-variants`
- Shows grid of tinted variants
- Download as ZIP
- Auth-gated like background remover

Add SEO metadata for "Free Color Variant Generator".

**Step 2: Verify build**

```bash
cd frontend && npm run build
```

**Step 3: Commit**

```bash
git add frontend/src/app/\(tools\)/tools/color-variants/
git commit -m "feat: add color variant generator tool page"
```

---

### Task 18: Pattern Repeat Preview Page

**Files:**
- Create: `frontend/src/app/(tools)/tools/pattern-preview/page.tsx`

**Step 1: Create the page**

Key functionality:
- Upload pattern/design image
- Repeat mode buttons: Straight, Half-Drop, Half-Brick, Mirror
- Scale slider (0.25x to 2x)
- Grid size inputs: columns (1-10), rows (1-10)
- "Generate Preview" button that POSTs to `/api/tools/pattern-tile`
- Shows large tiled preview
- Download button
- Auth-gated

Add SEO metadata for "Free Pattern Repeat Preview for Fabric & Wallpaper".

**Step 2: Verify build**

```bash
cd frontend && npm run build
```

**Step 3: Commit**

```bash
git add frontend/src/app/\(tools\)/tools/pattern-preview/
git commit -m "feat: add pattern repeat preview tool page"
```

---

### Task 19: Batch Watermark Page

**Files:**
- Create: `frontend/src/app/(tools)/tools/watermark/page.tsx`

**Step 1: Create the page**

Key functionality:
- Upload one or more images
- Tab toggle: "Text Watermark" / "Image Watermark"
- Text mode: text input, font size slider (12-72), color picker, opacity slider (0-100)
- Image mode: watermark image upload, opacity slider
- Position: 9-button grid selector (3x3) + "Tiled" option
- Live preview on first image
- "Apply Watermark" button — for each image, POST to `/api/tools/watermark`
- Download individually or as ZIP (client-side zip using JSZip)
- Auth-gated

Add SEO metadata for "Free Batch Watermark Tool".

**Step 2: Verify build**

```bash
cd frontend && npm run build
```

**Step 3: Commit**

```bash
git add frontend/src/app/\(tools\)/tools/watermark/
git commit -m "feat: add batch watermark tool page"
```

---

## Phase 5: Navigation & SEO

### Task 20: Add Free Tools to Navigation

**Files:**
- Modify: `frontend/src/components/sidebar.tsx`
- Modify: `frontend/src/app/page.tsx`

**Step 1: Add to sidebar**

In `frontend/src/components/sidebar.tsx`, add to the `nav` array (after "Connections"):

```typescript
{ href: '/tools', label: 'Free Tools', icon: Wand2 },
```

Add import: `import { Wand2 } from 'lucide-react'` (add to existing lucide import).

**Step 2: Add to landing page**

In `frontend/src/app/page.tsx`, add a "Free Tools" link next to the existing CTA buttons in the hero section. Also add a new section between features and footer showcasing the tools:

```tsx
<Link
  href="/tools"
  className="text-blue-600 hover:text-blue-700 font-medium"
>
  Browse Free Tools →
</Link>
```

**Step 3: Verify build**

```bash
cd frontend && npm run build
```

**Step 4: Commit**

```bash
git add frontend/src/components/sidebar.tsx frontend/src/app/page.tsx
git commit -m "feat: add Free Tools links to sidebar and landing page"
```

---

### Task 21: Final Integration Test

**Step 1: Run all frontend tests**

```bash
cd frontend && npm run test
```

**Step 2: Run all processing tests**

```bash
cd processing && pytest
```

**Step 3: Build frontend to verify no compile errors**

```bash
cd frontend && npm run build
```

**Step 4: Start services and manually verify**

```bash
docker compose up --build
```

Check:
- `/tools` — index page renders, all 9 tools listed
- `/tools/resize` — upload works, presets work, download works
- `/tools/crop` — crop region works, aspect ratios work
- `/tools/convert` — format conversion works
- `/tools/compress` — compression works, shows savings
- `/tools/dpi` — DPI calculation works
- `/tools/background-remover` — redirects to login if not authed, works when authed
- `/tools/color-variants` — same auth behavior, generates variants
- `/tools/pattern-preview` — same, tiling works
- `/tools/watermark` — same, text and image watermarks work
- Sidebar shows "Free Tools" link
- Landing page shows "Free Tools" link
- Check `tool_usage` table has entries after using tools

**Step 5: Commit any fixes and final commit**

```bash
git add -A
git commit -m "feat: complete free tools suite — 9 tools for e-commerce sellers"
```
