# Remix Render Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Remix" button on completed renders that opens a modal with the full template editor, saves updated overlay settings, re-renders a single mockup, and inserts the new render into the current page.

**Architecture:** A new `RemixModal` component embeds the existing `MockupCanvas` and `Toolbar` editor components inside a modal. A new `POST /api/render/single` endpoint handles single-template rendering (extracts `processRender` from batch route into shared utility). The modal saves the template's overlayConfig, triggers a single render, polls for completion, and calls back to the parent page to insert the new render.

**Tech Stack:** Next.js 14 App Router, React, Prisma, Tailwind CSS, lucide-react icons

---

### Task 1: Extract `processRender` into shared utility

The batch render route contains a `processRender` function that we need to reuse for single renders. Extract it into a shared module.

**Files:**
- Create: `frontend/src/lib/server/process-render.ts`
- Modify: `frontend/src/app/api/render/batch/route.ts`

**Step 1: Create the shared module**

Create `frontend/src/lib/server/process-render.ts`:

```typescript
import { prisma } from '@/lib/server/prisma'
import { getUploadPath, getRenderPath } from '@/lib/server/storage'
import path from 'path'

const PROCESSING_URL = process.env.PROCESSING_URL || 'http://localhost:5000'

export interface RenderOptions {
  tintColor: string | null
  outputMode: string | null
  outputColor: string | null
}

export interface RenderTemplate {
  id: string
  overlayConfig: unknown
  templateImage?: {
    id: string
    imagePath: string
    defaultMaskPath: string | null
  } | null
}

export interface RenderDesign {
  id: string
  imagePath: string
}

export async function processRender(
  template: RenderTemplate,
  design: RenderDesign,
  renderId: string,
  renderOptions?: RenderOptions
) {
  await prisma.renderedMockup.update({ where: { id: renderId }, data: { status: 'processing' } })

  const imagePath = template.templateImage?.imagePath
  if (!imagePath) throw new Error('No image path available for template')

  const overlayConfig = { ...(template.overlayConfig as Record<string, unknown>) }
  if (renderOptions?.tintColor) {
    overlayConfig.tintColor = renderOptions.tintColor
    const maskPath = template.templateImage?.defaultMaskPath
      ? getUploadPath(template.templateImage.defaultMaskPath)
      : getUploadPath(imagePath).replace(/\.[^.]+$/, '_mask.png')
    overlayConfig.maskPath = maskPath
  }
  if (renderOptions?.outputMode) {
    overlayConfig.outputMode = renderOptions.outputMode
  }
  if (renderOptions?.outputColor) {
    overlayConfig.outputColor = renderOptions.outputColor
  }

  const response = await fetch(`${PROCESSING_URL}/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      templateImagePath: getUploadPath(imagePath),
      designImagePath: getUploadPath(design.imagePath),
      overlayConfig,
      outputDir: getRenderPath(`${design.id}`),
      renderId,
    }),
  })

  if (!response.ok) throw new Error(`Processing service returned ${response.status}`)

  const result = (await response.json()) as { outputPath: string }
  const relativePath = path.relative(process.env.RENDER_DIR || './rendered', result.outputPath)
  await prisma.renderedMockup.update({
    where: { id: renderId },
    data: { status: 'complete', renderedImagePath: relativePath },
  })
}
```

**Step 2: Update batch route to import from shared module**

In `frontend/src/app/api/render/batch/route.ts`:
- Remove the `processRender` function (lines 83-130)
- Remove the now-unused imports: `getUploadPath`, `getRenderPath`, `path`
- Add import: `import { processRender } from '@/lib/server/process-render'`
- Keep the `PROCESSING_URL` removal (it's only used in processRender)

The batch route's `POST` handler references `processRender` on line 65 — that call stays the same, it just imports from the shared module now.

**Step 3: Verify the app still builds**

Run: `cd frontend && npx next build 2>&1 | head -50`
Expected: Build succeeds (or at least no errors in render routes)

**Step 4: Commit**

```bash
git add frontend/src/lib/server/process-render.ts frontend/src/app/api/render/batch/route.ts
git commit -m "refactor: extract processRender into shared utility"
```

---

### Task 2: Create `POST /api/render/single` endpoint

**Files:**
- Create: `frontend/src/app/api/render/single/route.ts`

**Step 1: Create the single render endpoint**

Create `frontend/src/app/api/render/single/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, handleAuthError } from '@/lib/server/auth'
import { processRender } from '@/lib/server/process-render'

export async function POST(req: NextRequest) {
  try {
    const userId = await requireAuth()
    const { mockupTemplateId, designId, tintColor, outputMode, outputColor, batchId } = await req.json()

    if (!mockupTemplateId || !designId) {
      return NextResponse.json({ error: 'mockupTemplateId and designId are required' }, { status: 400 })
    }

    // Verify template belongs to user's set
    const template = await prisma.mockupTemplate.findFirst({
      where: {
        id: mockupTemplateId,
        archivedAt: null,
        mockupSet: { userId },
      },
      include: { templateImage: true },
    })
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Verify design belongs to user
    const design = await prisma.design.findFirst({ where: { id: designId, userId } })
    if (!design) {
      return NextResponse.json({ error: 'Design not found' }, { status: 404 })
    }

    // If batchId provided, verify it belongs to user
    if (batchId) {
      const batch = await prisma.renderBatch.findFirst({ where: { id: batchId, userId } })
      if (!batch) {
        return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
      }
    }

    const renderOptions = {
      tintColor: tintColor || null,
      outputMode: outputMode || null,
      outputColor: outputColor || null,
    }

    const render = await prisma.renderedMockup.create({
      data: {
        mockupTemplateId: template.id,
        designId: design.id,
        batchId: batchId || null,
        renderedImagePath: '',
        status: 'pending',
        renderOptions,
      },
    })

    // Fire async processing
    processRender(template, design, render.id, renderOptions).catch(async (err) => {
      console.error(`Single render failed for ${render.id}:`, err)
      await prisma.renderedMockup.update({
        where: { id: render.id },
        data: { status: 'failed' },
      })
    })

    return NextResponse.json({ renderId: render.id, status: 'pending' }, { status: 202 })
  } catch (err) {
    return handleAuthError(err)
  }
}
```

**Step 2: Commit**

```bash
git add frontend/src/app/api/render/single/route.ts
git commit -m "feat: add POST /api/render/single endpoint for single-template rendering"
```

---

### Task 3: Create `GET /api/render/[id]/status` endpoint

**Files:**
- Create: `frontend/src/app/api/render/[id]/status/route.ts`

**Step 1: Create the status endpoint**

Create `frontend/src/app/api/render/[id]/status/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, handleAuthError } from '@/lib/server/auth'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireAuth()
    const { id } = await params

    const render = await prisma.renderedMockup.findFirst({
      where: {
        id,
        mockupTemplate: { mockupSet: { userId } },
      },
      include: {
        mockupTemplate: { select: { id: true, name: true, overlayConfig: true } },
        design: { select: { id: true, name: true, imagePath: true } },
      },
    })

    if (!render) {
      return NextResponse.json({ error: 'Render not found' }, { status: 404 })
    }

    return NextResponse.json(render)
  } catch (err) {
    return handleAuthError(err)
  }
}
```

**Step 2: Commit**

```bash
git add frontend/src/app/api/render/[id]/status/route.ts
git commit -m "feat: add GET /api/render/[id]/status endpoint"
```

---

### Task 4: Add API client methods

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Step 1: Add `singleRender` and `getRenderStatus` methods**

Add these methods to the `api` object in `frontend/src/lib/api.ts`, in the Render section (after the existing `getRenderStatus` method around line 78):

```typescript
  // Single Render (remix)
  singleRender: (data: {
    mockupTemplateId: string
    designId: string
    tintColor?: string
    outputMode?: string
    outputColor?: string
    batchId?: string
  }) => request('/api/render/single', { method: 'POST', body: JSON.stringify(data) }),
  getRender: (id: string) => request(`/api/render/${id}/status`),
```

**Step 2: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: add singleRender and getRender API client methods"
```

---

### Task 5: Create RemixModal component

This is the main component. It embeds the existing editor inside a modal with render options and a re-render button.

**Files:**
- Create: `frontend/src/components/remix-modal.tsx`

**Step 1: Create the RemixModal component**

Create `frontend/src/components/remix-modal.tsx`:

```typescript
'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { api } from '@/lib/api'
import { MockupCanvas } from '@/components/editor/mockup-canvas'
import { Toolbar } from '@/components/editor/toolbar'
import { OverlayConfig, CurveAxis } from '@/lib/canvas-utils'
import { X, Loader2, Image as ImageIcon } from 'lucide-react'

interface RemixRender {
  id: string
  status: string
  renderedImagePath: string
  renderOptions?: { tintColor?: string; outputMode?: string; outputColor?: string }
  isFavorite?: boolean
  createdAt: string
  mockupTemplate: { id: string; name: string; overlayConfig?: OverlayConfig | null }
  design?: { id: string; name: string; imagePath: string }
}

interface RemixModalProps {
  render: RemixRender
  setId: string
  designId: string
  designImagePath: string
  batchId?: string
  onClose: () => void
  onRendered: (newRender: RemixRender) => void
}

export function RemixModal({
  render, setId, designId, designImagePath, batchId, onClose, onRendered,
}: RemixModalProps) {
  const [templateImageUrl, setTemplateImageUrl] = useState<string>('')
  const [config, setConfig] = useState<OverlayConfig | null>(null)
  const [mode, setMode] = useState<'advanced' | 'basic'>('advanced')
  const [displacement, setDisplacement] = useState(0.5)
  const [transparency, setTransparency] = useState(0.0)
  const [curvature, setCurvature] = useState(0.0)
  const [curveAxis, setCurveAxis] = useState<CurveAxis>('auto')

  const [outputMode, setOutputMode] = useState<'original' | 'transparent' | 'solid'>('original')
  const [outputColor, setOutputColor] = useState('#ffffff')
  const [tintColor, setTintColor] = useState<string>('')

  const [rendering, setRendering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval>>()

  const templateId = render.mockupTemplate.id

  // Load template data for the canvas
  useEffect(() => {
    api.getSet(setId).then((set: { templates: { id: string; templateImage?: { imagePath: string } | null; overlayConfig: OverlayConfig | null }[] }) => {
      const t = set.templates.find((t) => t.id === templateId)
      if (t) {
        if (t.templateImage) {
          setTemplateImageUrl(`/uploads/${t.templateImage.imagePath}`)
        }
        if (t.overlayConfig) {
          setConfig(t.overlayConfig)
          setMode(t.overlayConfig.mode || 'advanced')
          setDisplacement(t.overlayConfig.displacementIntensity ?? 0.5)
          setTransparency(t.overlayConfig.transparency ?? 0.0)
          setCurvature(t.overlayConfig.curvature ?? 0.0)
          setCurveAxis(t.overlayConfig.curveAxis ?? 'auto')
        }
      }
    })
  }, [setId, templateId])

  // Initialize render options from current render
  useEffect(() => {
    const opts = render.renderOptions
    if (opts?.outputMode === 'transparent') setOutputMode('transparent')
    else if (opts?.outputMode === 'solid') setOutputMode('solid')
    if (opts?.outputColor) setOutputColor(opts.outputColor)
    if (opts?.tintColor) setTintColor(opts.tintColor)
  }, [render.renderOptions])

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const buildOverlayConfig = useCallback((): OverlayConfig | null => {
    if (!config) return null
    return {
      ...config,
      displacementIntensity: displacement,
      transparency,
      curvature,
      curveAxis,
      mode,
    }
  }, [config, displacement, transparency, curvature, curveAxis, mode])

  const handleRerender = async () => {
    setRendering(true)
    setError(null)
    try {
      // 1. Save overlay config to template
      const overlayConfig = buildOverlayConfig()
      if (overlayConfig) {
        await api.updateTemplate(setId, templateId, { overlayConfig })
      }

      // 2. Trigger single render
      const result = await api.singleRender({
        mockupTemplateId: templateId,
        designId,
        tintColor: tintColor || undefined,
        outputMode: outputMode !== 'original' ? outputMode : undefined,
        outputColor: outputMode === 'solid' ? outputColor : undefined,
        batchId,
      })

      // 3. Poll for completion
      pollRef.current = setInterval(async () => {
        try {
          const updated = await api.getRender(result.renderId)
          if (updated.status === 'complete' || updated.status === 'failed') {
            clearInterval(pollRef.current)
            setRendering(false)
            if (updated.status === 'complete') {
              onRendered(updated)
              onClose()
            } else {
              setError('Render failed. Please try again.')
            }
          }
        } catch {
          clearInterval(pollRef.current)
          setRendering(false)
          setError('Failed to check render status.')
        }
      }, 1500)
    } catch (err) {
      setRendering(false)
      setError(err instanceof Error ? err.message : 'Render failed')
    }
  }

  const handleReset = () => {
    setConfig(null)
    setCurvature(0.0)
    setCurveAxis('auto')
  }

  const designPreviewUrl = `/uploads/${designImagePath}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[95vh] flex flex-col m-4"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <div>
            <h2 className="text-lg font-bold">Remix: {render.mockupTemplate.name}</h2>
            <p className="text-xs text-gray-500">Adjust settings and re-render. A new render will be created.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {/* Toolbar */}
        <div className="px-4 pt-3 shrink-0">
          <Toolbar
            mode={mode}
            displacementIntensity={displacement}
            transparency={transparency}
            curvature={curvature}
            curveAxis={curveAxis}
            onModeChange={setMode}
            onDisplacementChange={setDisplacement}
            onTransparencyChange={setTransparency}
            onCurvatureChange={setCurvature}
            onCurveAxisChange={setCurveAxis}
            onReset={handleReset}
            onSave={handleRerender}
            saving={rendering}
          />
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-auto px-4 min-h-0">
          {templateImageUrl ? (
            <MockupCanvas
              imageUrl={templateImageUrl}
              overlayConfig={config}
              previewDesignUrl={designPreviewUrl}
              transparency={transparency}
              displacement={displacement}
              curvature={curvature}
              curveAxis={curveAxis}
              onConfigChange={setConfig}
              mode={mode}
            />
          ) : (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <Loader2 className="animate-spin" size={24} />
            </div>
          )}
        </div>

        {/* Render Options + Actions */}
        <div className="p-4 border-t shrink-0">
          <div className="flex flex-wrap items-center gap-4 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Output:</span>
              {(['original', 'transparent', 'solid'] as const).map((opt) => (
                <button key={opt} onClick={() => setOutputMode(opt)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    outputMode === opt
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}>
                  {opt === 'original' ? 'Original' : opt === 'transparent' ? 'Transparent' : 'Solid'}
                </button>
              ))}
              {outputMode === 'solid' && (
                <input type="color" value={outputColor} onChange={(e) => setOutputColor(e.target.value)}
                  className="w-6 h-6 rounded border border-gray-300 cursor-pointer" />
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Tint:</span>
              <input type="color" value={tintColor || '#000000'}
                onChange={(e) => setTintColor(e.target.value)}
                className="w-6 h-6 rounded border border-gray-300 cursor-pointer" />
              {tintColor && (
                <button onClick={() => setTintColor('')}
                  className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-red-500 mb-2">{error}</p>}

          <div className="flex items-center justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200">
              Cancel
            </button>
            <button onClick={handleRerender} disabled={rendering}
              className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
              {rendering ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
              {rendering ? 'Rendering...' : 'Re-render'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/remix-modal.tsx
git commit -m "feat: create RemixModal component with editor and single render"
```

---

### Task 6: Add Remix button to batch detail page

**Files:**
- Modify: `frontend/src/app/(app)/renders/[batchId]/page.tsx`

**Step 1: Add remix state, import, and button to render cards + lightbox**

Changes to `frontend/src/app/(app)/renders/[batchId]/page.tsx`:

1. Add import for `RefreshCw` icon and `RemixModal`:
```typescript
import { Loader2, Download, X, ChevronLeft, ChevronRight, ArrowLeft, Heart, RefreshCw } from 'lucide-react'
import { RemixModal } from '@/components/remix-modal'
```

2. Add state for remix modal (after `editingDesc` state):
```typescript
const [remixRender, setRemixRender] = useState<Render | null>(null)
```

3. The `Render` interface needs to include `mockupTemplate.id` and render `renderOptions`. Update the interface:
```typescript
interface Render {
  id: string
  status: string
  isFavorite?: boolean
  renderOptions?: { tintColor?: string; outputMode?: string; outputColor?: string }
  mockupTemplate: { id: string; name: string; overlayConfig?: OverlaySettings | null }
}
```

4. Add Remix button on each completed render card — in the card footer `div` alongside the existing favorite and download buttons, add:
```typescript
{r.status === 'complete' && (
  <button onClick={() => setRemixRender(r)}
    className="shrink-0 ml-1 p-1.5 rounded-full hover:bg-blue-50 text-gray-500 hover:text-blue-600"
    title="Remix">
    <RefreshCw size={14} />
  </button>
)}
```

5. Add Remix button in lightbox bottom bar — after the Download link inside the bottom bar `div`:
```typescript
<button onClick={(e) => { e.stopPropagation(); setRemixRender(completedRenders[lightboxIndex]); closeLightbox() }}
  className="text-blue-400 hover:text-blue-300 flex items-center gap-1">
  <RefreshCw size={14} /> Remix
</button>
```

6. Add the `onRendered` handler that inserts the new render and refreshes the batch data:
```typescript
const handleRemixRendered = () => {
  api.getBatch(batchId).then((b) => { setBatch(b); setDescValue(b.description ?? '') })
}
```

7. Add `RemixModal` render at the bottom of the component (before the closing `</div>`):
```typescript
{remixRender && batch && (
  <RemixModal
    render={remixRender}
    setId={batch.mockupSet.id}
    designId={batch.design.id}
    designImagePath={batch.design.imagePath}
    batchId={batch.id}
    onClose={() => setRemixRender(null)}
    onRendered={handleRemixRendered}
  />
)}
```

**Step 2: Commit**

```bash
git add frontend/src/app/(app)/renders/[batchId]/page.tsx
git commit -m "feat: add Remix button to batch detail page cards and lightbox"
```

---

### Task 7: Add Remix button to template renders page

**Files:**
- Modify: `frontend/src/app/(app)/sets/[id]/templates/[templateId]/renders/page.tsx`

**Step 1: Add remix functionality**

Changes to `frontend/src/app/(app)/sets/[id]/templates/[templateId]/renders/page.tsx`:

1. Add imports:
```typescript
import { Download, ArrowLeft, ChevronLeft, ChevronRight, Heart, X, RefreshCw } from 'lucide-react'
import { RemixModal } from '@/components/remix-modal'
```

2. Update the `TemplateRender` interface to include `mockupTemplate`:
```typescript
interface TemplateRender {
  id: string
  status: string
  renderedImagePath: string
  renderOptions?: { tintColor?: string; outputMode?: string; outputColor?: string }
  isFavorite?: boolean
  createdAt: string
  design: { id: string; name: string; imagePath: string }
  batch: { id: string; createdAt: string; description?: string } | null
  mockupTemplate: { id: string; name: string; overlayConfig?: { displacementIntensity?: number; transparency?: number } | null }
}
```

3. Add state:
```typescript
const [remixRender, setRemixRender] = useState<TemplateRender | null>(null)
```

4. Add Remix button on render cards — in the `absolute top-2 right-2` overlay div, add before the download button:
```typescript
{r.status === 'complete' && (
  <button onClick={() => setRemixRender(r)}
    className="rounded-full bg-white p-1.5 shadow hover:bg-blue-50">
    <RefreshCw size={12} className="text-gray-400 hover:text-blue-600" />
  </button>
)}
```

5. Add Remix in lightbox bottom bar — after the tint color span and before the Download link:
```typescript
<button onClick={(e) => { e.stopPropagation(); setRemixRender(completedRenders[lightboxIndex]); closeLightbox() }}
  className="text-blue-400 hover:text-blue-300 flex items-center gap-1">
  <RefreshCw size={14} /> Remix
</button>
```

6. Add handler and modal at bottom:
```typescript
const handleRemixRendered = () => {
  fetchPage(page)
}
```

```typescript
{remixRender && (
  <RemixModal
    render={remixRender}
    setId={setId}
    designId={remixRender.design.id}
    designImagePath={remixRender.design.imagePath}
    batchId={remixRender.batch?.id}
    onClose={() => setRemixRender(null)}
    onRendered={handleRemixRendered}
  />
)}
```

**Step 2: Update the template renders API to include mockupTemplate in the response**

Check `frontend/src/app/api/mockup-sets/[id]/templates/[templateId]/renders/route.ts` — the query needs to include `mockupTemplate: { select: { id: true, name: true, overlayConfig: true } }` in the render include. This may already be present; if not, add it.

**Step 3: Commit**

```bash
git add frontend/src/app/(app)/sets/[id]/templates/[templateId]/renders/page.tsx
git commit -m "feat: add Remix button to template renders page"
```

---

### Task 8: Add Remix button to apply design page

**Files:**
- Modify: `frontend/src/app/(app)/sets/[id]/apply/page.tsx`

**Step 1: Add remix functionality**

Changes to `frontend/src/app/(app)/sets/[id]/apply/page.tsx`:

1. Add imports:
```typescript
import { Upload, Download, Loader2, Image as ImageIcon, X, ChevronLeft, ChevronRight, Clock, Heart, RefreshCw } from 'lucide-react'
import { RemixModal } from '@/components/remix-modal'
```

2. The `RenderStatus` interface already has `mockupTemplate` with `name` and `overlayConfig`. Add `id`:
```typescript
mockupTemplate: { id: string; name: string; overlayConfig?: OverlaySettings | null }
```

3. Add state:
```typescript
const [remixRender, setRemixRender] = useState<RenderStatus | null>(null)
```

4. Add Remix button on completed render cards — in the card footer alongside favorite/download:
```typescript
{r.status === 'complete' && (
  <button onClick={() => setRemixRender(r)}
    className="shrink-0 ml-1 p-1.5 rounded-full hover:bg-blue-50 text-gray-500 hover:text-blue-600"
    title="Remix">
    <RefreshCw size={14} />
  </button>
)}
```

5. Add Remix button in lightbox bottom bar:
```typescript
<button onClick={(e) => { e.stopPropagation(); setRemixRender(completedRenders[lightboxIndex]); closeLightbox() }}
  className="text-blue-400 hover:text-blue-300 flex items-center gap-1">
  <RefreshCw size={14} /> Remix
</button>
```

6. Add handler:
```typescript
const handleRemixRendered = () => {
  if (batchId) {
    api.getBatch(batchId).then((updated) => setRenders(updated.renders))
  }
}
```

7. Add modal at bottom (needs `selectedDesign` to get design imagePath):
```typescript
{remixRender && selectedDesign && (
  <RemixModal
    render={remixRender}
    setId={setId}
    designId={selectedDesign}
    designImagePath={designs.find((d) => d.id === selectedDesign)?.imagePath ?? ''}
    batchId={batchId ?? undefined}
    onClose={() => setRemixRender(null)}
    onRendered={handleRemixRendered}
  />
)}
```

**Step 2: Update the batch API response to include `mockupTemplate.id`**

In `frontend/src/app/api/render/batches/[batchId]/route.ts`, the render include has:
```typescript
mockupTemplate: { select: { name: true, overlayConfig: true } }
```
Add `id: true` to the select.

**Step 3: Commit**

```bash
git add frontend/src/app/(app)/sets/[id]/apply/page.tsx frontend/src/app/api/render/batches/[batchId]/route.ts
git commit -m "feat: add Remix button to apply design page, include template id in batch API"
```

---

### Task 9: Verify and fix template renders API

**Files:**
- Modify: `frontend/src/app/api/mockup-sets/[id]/templates/[templateId]/renders/route.ts` (if needed)

**Step 1: Check the template renders API includes mockupTemplate in render results**

Read the file and verify the Prisma query includes `mockupTemplate: { select: { id: true, name: true, overlayConfig: true } }` in the render results. If not, add it.

**Step 2: Build check**

Run: `cd frontend && npx next build 2>&1 | tail -30`
Expected: Build succeeds

**Step 3: Commit (if changes made)**

```bash
git add frontend/src/app/api/mockup-sets/[id]/templates/[templateId]/renders/route.ts
git commit -m "fix: include mockupTemplate in template renders API response"
```
