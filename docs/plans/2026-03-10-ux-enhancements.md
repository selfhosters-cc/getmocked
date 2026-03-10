# UX Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Six enhancements: inline set editing, apply page breadcrumbs, batch descriptions, mask editor bugfix, favourites system, and template renders view.

**Architecture:** All changes are in the Next.js frontend — Prisma schema additions for favourites + batch description, new API routes, and UI modifications. The mask editor fix is a path-handling bug in the mask proxy API route.

**Tech Stack:** Next.js 14 App Router, Prisma, React, Tailwind, lucide-react icons.

---

### Task 1: Inline Set Name/Description Editing

**Files:**
- Modify: `frontend/src/app/(app)/sets/[id]/page.tsx`

**Step 1: Add inline editing to set detail page header**

Replace the read-only header (current lines 188-192) with editable fields. Add state for editing and an auto-save function:

```typescript
// Add to imports:
import { Pencil, Check } from 'lucide-react'

// Add inside SetDetailPage component, after the existing state:
const [editingName, setEditingName] = useState(false)
const [editingDesc, setEditingDesc] = useState(false)
const [nameValue, setNameValue] = useState('')
const [descValue, setDescValue] = useState('')

// Add effect to sync from set data:
useEffect(() => {
  if (set) {
    setNameValue(set.name)
    setDescValue(set.description ?? '')
  }
}, [set])

const saveName = async () => {
  const trimmed = nameValue.trim()
  if (!trimmed || trimmed === set?.name) { setEditingName(false); return }
  await api.updateSet(id, { name: trimmed })
  setSet((prev) => prev ? { ...prev, name: trimmed } : prev)
  setEditingName(false)
}

const saveDesc = async () => {
  const val = descValue.trim()
  if (val === (set?.description ?? '')) { setEditingDesc(false); return }
  await api.updateSet(id, { description: val || undefined })
  setSet((prev) => prev ? { ...prev, description: val || undefined } : prev)
  setEditingDesc(false)
}
```

Replace the header JSX `<div>` containing the h1 and description with:

```tsx
<div>
  {editingName ? (
    <div className="flex items-center gap-2">
      <input value={nameValue} onChange={(e) => setNameValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }}
        className="text-2xl font-bold border-b-2 border-blue-500 outline-none bg-transparent w-full"
        autoFocus />
      <button onClick={saveName} className="text-green-600 hover:text-green-700"><Check size={20} /></button>
    </div>
  ) : (
    <h1 className="text-2xl font-bold group/name flex items-center gap-2 cursor-pointer" onClick={() => setEditingName(true)}>
      {set.name}
      <Pencil size={14} className="text-gray-300 opacity-0 group-hover/name:opacity-100 transition-opacity" />
    </h1>
  )}
  {editingDesc ? (
    <div className="flex items-center gap-2 mt-1">
      <input value={descValue} onChange={(e) => setDescValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') saveDesc(); if (e.key === 'Escape') setEditingDesc(false) }}
        onBlur={saveDesc}
        placeholder="Add a description..."
        className="text-gray-500 border-b border-blue-400 outline-none bg-transparent w-full text-sm"
        autoFocus />
    </div>
  ) : (
    <p className="text-gray-500 cursor-pointer hover:text-gray-700 text-sm mt-1" onClick={() => setEditingDesc(true)}>
      {set.description || 'Add a description...'}
    </p>
  )}
</div>
```

**Step 2: Commit**

```bash
git add frontend/src/app/\(app\)/sets/\[id\]/page.tsx
git commit -m "feat: inline editing for set name and description"
```

---

### Task 2: Apply Page Set Context + Breadcrumb

**Files:**
- Modify: `frontend/src/app/(app)/sets/[id]/apply/page.tsx`

**Step 1: Add breadcrumb and set context**

Add `Link` import (already in scope via next/link — add it if missing). Replace the generic `<h1>Apply Design</h1>` with a breadcrumb and set context:

```tsx
// Add to imports if not present:
import Link from 'next/link'
import { ChevronRight as ChevronRightIcon } from 'lucide-react'
// Note: ChevronRight is already imported — alias the breadcrumb one or reuse it.
// Since ChevronRight is already imported, just reuse it.

// Replace <h1 className="text-2xl font-bold mb-6">Apply Design</h1> with:
<nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-2">
  <Link href="/sets" className="hover:text-gray-700">My Sets</Link>
  <ChevronRight size={14} />
  <Link href={`/sets/${setId}`} className="hover:text-gray-700">{set?.name ?? '...'}</Link>
  <ChevronRight size={14} />
  <span className="text-gray-900 font-medium">Apply Design</span>
</nav>
<div className="mb-6">
  <h1 className="text-2xl font-bold">{set?.name ? `Apply Design to ${set.name}` : 'Apply Design'}</h1>
  {set && (
    <p className="text-sm text-gray-500 mt-1">
      {set.templates.length} template{set.templates.length !== 1 ? 's' : ''} in this set
    </p>
  )}
</div>
```

Also need to add `Link` import at the top if not already there.

**Step 2: Commit**

```bash
git add frontend/src/app/\(app\)/sets/\[id\]/apply/page.tsx
git commit -m "feat: breadcrumb and set context on apply design page"
```

---

### Task 3: Batch Description — Schema Migration

**Files:**
- Modify: `frontend/prisma/schema.prisma`

**Step 1: Add description field to RenderBatch**

Add after the `designId` field (line 68):

```prisma
  description String?
```

**Step 2: Add isFavorite fields (for Task 7)**

Add to `MockupTemplate` after `sortOrder` (line 44):

```prisma
  isFavorite       Boolean         @default(false) @map("is_favorite")
```

Add to `RenderedMockup` after `renderOptions` (line 85):

```prisma
  isFavorite        Boolean        @default(false) @map("is_favorite")
```

**Step 3: Run migration**

```bash
cd frontend && npx prisma migrate dev --name add_batch_desc_and_favorites
```

If no DB connection:
```bash
cd frontend && npx prisma db push
```

**Step 4: Generate client**

```bash
cd frontend && npx prisma generate
```

**Step 5: Commit**

```bash
git add frontend/prisma/
git commit -m "feat: add batch description and isFavorite fields to schema"
```

---

### Task 4: Batch Description — API + UI

**Files:**
- Modify: `frontend/src/app/api/render/batch/route.ts`
- Modify: `frontend/src/app/api/render/batches/route.ts`
- Modify: `frontend/src/app/api/render/batches/[batchId]/route.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/app/(app)/sets/[id]/apply/page.tsx`
- Modify: `frontend/src/app/(app)/renders/page.tsx`
- Modify: `frontend/src/app/(app)/renders/[batchId]/page.tsx`

**Step 1: Update batch creation API**

In `render/batch/route.ts`, extract `description` from request body (line 12):

```typescript
const { mockupSetId, designId, colorVariants, outputMode, outputColor, description } = await req.json()
```

Pass it when creating the batch (line 29):

```typescript
const batch = await prisma.renderBatch.create({
  data: { userId, mockupSetId, designId, description: description || null },
})
```

**Step 2: Update batch list API to return description**

In `render/batches/route.ts`, add `description` to the result mapping (around line 29):

```typescript
const result = batches.map((b) => ({
  id: b.id,
  createdAt: b.createdAt,
  description: b.description,
  // ... rest stays same
```

**Step 3: Add PATCH handler for batch description**

In `render/batches/[batchId]/route.ts`, add a PATCH handler:

```typescript
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  try {
    const userId = await requireAuth()
    const { batchId } = await params
    const { description } = await req.json()

    const result = await prisma.renderBatch.updateMany({
      where: { id: batchId, userId },
      data: { description: description ?? null },
    })
    if (result.count === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleAuthError(err)
  }
}
```

**Step 4: Update api.ts**

Update `batchRender` to accept `description`:

```typescript
batchRender: (
  mockupSetId: string,
  designId: string,
  colorVariants?: string[],
  outputMode?: string,
  outputColor?: string,
  description?: string,
) =>
  request('/api/render/batch', {
    method: 'POST',
    body: JSON.stringify({ mockupSetId, designId, colorVariants, outputMode, outputColor, description }),
  }),
```

Add batch update method:

```typescript
updateBatch: (batchId: string, data: { description?: string }) =>
  request(`/api/render/batches/${batchId}`, { method: 'PATCH', body: JSON.stringify(data) }),
```

**Step 5: Apply page — add batch note input**

In `apply/page.tsx`, add state:

```typescript
const [batchNote, setBatchNote] = useState('')
```

Add a text input before the render button in the "Render Mockups" section:

```tsx
<input
  value={batchNote}
  onChange={(e) => setBatchNote(e.target.value)}
  placeholder="Batch note (optional), e.g. &quot;Client review round 2&quot;"
  className="rounded-lg border px-3 py-2 text-sm w-full max-w-md"
/>
```

Update `handleRender` to pass it:

```typescript
const result = await api.batchRender(
  setId, selectedDesign, colors,
  outputMode !== 'original' ? outputMode : undefined,
  outputMode === 'solid' ? outputColor : undefined,
  batchNote.trim() || undefined
)
```

**Step 6: Renders list page — show description**

In `renders/page.tsx`, update `BatchSummary` interface to include `description?: string`. Show it under the set name in the card:

```tsx
{b.description && (
  <p className="text-xs text-gray-400 mt-0.5 truncate">{b.description}</p>
)}
```

**Step 7: Batch detail page — editable description**

In `renders/[batchId]/page.tsx`, update `BatchDetail` interface to include `description?: string | null`. Add inline editing state and UI below the existing header info:

```typescript
const [editingDesc, setEditingDesc] = useState(false)
const [descValue, setDescValue] = useState('')

useEffect(() => {
  if (batch) setDescValue(batch.description ?? '')
}, [batch])

const saveDesc = async () => {
  setEditingDesc(false)
  const val = descValue.trim()
  await api.updateBatch(batchId, { description: val || undefined })
  setBatch((prev) => prev ? { ...prev, description: val || undefined } : prev)
}
```

Add below the date line in the header:

```tsx
{editingDesc ? (
  <input value={descValue} onChange={(e) => setDescValue(e.target.value)}
    onKeyDown={(e) => { if (e.key === 'Enter') saveDesc(); if (e.key === 'Escape') setEditingDesc(false) }}
    onBlur={saveDesc}
    placeholder="Add a note..."
    className="text-sm text-gray-500 border-b border-blue-400 outline-none bg-transparent w-full mt-1"
    autoFocus />
) : (
  <p className="text-sm text-gray-400 mt-1 cursor-pointer hover:text-gray-600" onClick={() => setEditingDesc(true)}>
    {batch.description || 'Add a note...'}
  </p>
)}
```

**Step 8: Commit**

```bash
git add frontend/src/app/api/render/ frontend/src/lib/api.ts frontend/src/app/\(app\)/sets/\[id\]/apply/page.tsx frontend/src/app/\(app\)/renders/
git commit -m "feat: batch description - create, display, and edit"
```

---

### Task 5: Fix Mask Editor — Path Bug

**Files:**
- Modify: `frontend/src/app/api/mockup-sets/[id]/templates/[templateId]/mask/route.ts`
- Modify: `frontend/src/components/editor/mask-editor.tsx`

**Step 1: Fix mask path in POST handler**

The processing service returns `maskPath` as an absolute path like `/app/uploads/templates/abc/img_mask.png`. The frontend expects a relative path. In the mask route POST handler, convert to relative:

```typescript
// Add import at top:
import path from 'path'

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'

// After getting result from processing (line 31), convert path:
const result = await response.json()
// Convert absolute maskPath to relative (strip upload dir prefix)
if (result.maskPath) {
  const uploadDir = path.resolve(UPLOAD_DIR)
  const absPath = path.resolve(result.maskPath)
  result.maskPath = path.relative(uploadDir, absPath)
}
return NextResponse.json(result)
```

Do the same for the PATCH handler — convert the returned maskPath to relative:

```typescript
const result = await response.json()
if (result.maskPath) {
  const uploadDir = path.resolve(UPLOAD_DIR)
  const absPath = path.resolve(result.maskPath)
  result.maskPath = path.relative(uploadDir, absPath)
}
return NextResponse.json(result)
```

Also: the PATCH handler sends `maskPath` from the client (which is relative) to the processing service (which expects absolute). Convert it before sending:

```typescript
const { maskPath, strokes } = await req.json()
// Convert relative mask path to absolute for processing service
const absMaskPath = path.join(path.resolve(UPLOAD_DIR), maskPath)
const response = await fetch(`${PROCESSING_URL}/refine-mask`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ imagePath: getUploadPath(template.originalImagePath), maskPath: absMaskPath, strokes }),
})
```

**Step 2: Fix mask editor redraw issue**

In `mask-editor.tsx`, the `drawMaskOverlay` function is a dependency of `loadMask` via `useCallback`, but `drawMaskOverlay` itself depends on `strokes`. When `loadMask` is called, `drawMaskOverlay` may use a stale reference. Fix by calling `drawMaskOverlay` in a `useEffect` that triggers when `maskImageRef.current` changes.

Simpler fix: use a state variable for mask loaded instead of relying on callback chaining:

```typescript
// Add state:
const [maskLoaded, setMaskLoaded] = useState(0) // counter to trigger redraws

// In loadMask, after setting maskImageRef.current:
img.onload = () => {
  maskImageRef.current = img
  setMaskLoaded((n) => n + 1)
}

// Add maskLoaded to the drawMaskOverlay dependency and its useEffect:
const drawMaskOverlay = useCallback(() => {
  // ... existing body unchanged
}, [canvasSize, strokes, maskLoaded])  // add maskLoaded
```

Remove `drawMaskOverlay` from the `loadMask` dependency array (it creates a stale closure). The `loadMask` callback should only depend on stable values:

```typescript
const loadMask = useCallback((path: string) => {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    maskImageRef.current = img
    setMaskLoaded((n) => n + 1)
  }
  img.src = `/uploads/${path}?t=${Date.now()}`
}, []) // no dependencies needed - just sets ref and triggers state
```

**Step 3: Commit**

```bash
git add frontend/src/app/api/mockup-sets/\[id\]/templates/\[templateId\]/mask/route.ts frontend/src/components/editor/mask-editor.tsx
git commit -m "fix: mask editor path handling and overlay redraw"
```

---

### Task 6: Favourites — API Routes

**Files:**
- Modify: `frontend/src/app/api/mockup-sets/[id]/templates/[templateId]/route.ts`
- Create: `frontend/src/app/api/render/[id]/favorite/route.ts`
- Create: `frontend/src/app/api/favorites/route.ts`
- Modify: `frontend/src/lib/api.ts`

**Step 1: Extend template PATCH to accept isFavorite**

In `mockup-sets/[id]/templates/[templateId]/route.ts`, add to the PATCH body handling (after line 36):

```typescript
if (body.isFavorite !== undefined) data.isFavorite = !!body.isFavorite
```

**Step 2: Create render favourite toggle**

```typescript
// frontend/src/app/api/render/[id]/favorite/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, handleAuthError } from '@/lib/server/auth'

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireAuth()
    const { id } = await params

    // Find render and verify ownership via batch
    const render = await prisma.renderedMockup.findFirst({
      where: { id },
      include: { batch: { select: { userId: true } } },
    })
    if (!render || render.batch?.userId !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const updated = await prisma.renderedMockup.update({
      where: { id },
      data: { isFavorite: !render.isFavorite },
    })
    return NextResponse.json({ isFavorite: updated.isFavorite })
  } catch (err) {
    return handleAuthError(err)
  }
}
```

**Step 3: Create favourites list endpoint**

```typescript
// frontend/src/app/api/favorites/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, handleAuthError } from '@/lib/server/auth'

export async function GET() {
  try {
    const userId = await requireAuth()

    const [templates, renders] = await Promise.all([
      prisma.mockupTemplate.findMany({
        where: { isFavorite: true, mockupSet: { userId } },
        include: { mockupSet: { select: { id: true, name: true } } },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.renderedMockup.findMany({
        where: { isFavorite: true, batch: { userId } },
        include: {
          mockupTemplate: { select: { name: true } },
          design: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ])

    return NextResponse.json({ templates, renders })
  } catch (err) {
    return handleAuthError(err)
  }
}
```

**Step 4: Update api.ts**

Add to the api object:

```typescript
// Favorites
toggleTemplateFavorite: (setId: string, templateId: string, isFavorite: boolean) =>
  request(`/api/mockup-sets/${setId}/templates/${templateId}`, {
    method: 'PATCH',
    body: JSON.stringify({ isFavorite }),
  }),
toggleRenderFavorite: (renderId: string) =>
  request(`/api/render/${renderId}/favorite`, { method: 'PATCH' }),
getFavorites: () => request('/api/favorites'),
```

**Step 5: Commit**

```bash
git add frontend/src/app/api/mockup-sets/\[id\]/templates/\[templateId\]/route.ts frontend/src/app/api/render/\[id\]/favorite/route.ts frontend/src/app/api/favorites/route.ts frontend/src/lib/api.ts
git commit -m "feat: favourite toggle API for templates and renders"
```

---

### Task 7: Favourites — UI (Heart Icons + Page)

**Files:**
- Modify: `frontend/src/app/(app)/sets/[id]/page.tsx`
- Modify: `frontend/src/app/(app)/renders/[batchId]/page.tsx`
- Modify: `frontend/src/app/(app)/sets/[id]/apply/page.tsx`
- Create: `frontend/src/app/(app)/favourites/page.tsx`
- Modify: `frontend/src/components/sidebar.tsx`

**Step 1: Template card favourite toggle**

In `sets/[id]/page.tsx`, update the `Template` interface to include `isFavorite?: boolean`. Add `Heart` to lucide-react imports.

Update `TemplateCard` to accept an `onToggleFavorite` callback and add a heart button:

```tsx
// In the action buttons area (line 89-98), add before Settings link:
<button onClick={(e) => { e.stopPropagation(); onToggleFavorite() }}
  className="rounded-full bg-white p-2 shadow hover:bg-pink-50">
  <Heart size={14} className={t.isFavorite ? 'fill-pink-500 text-pink-500' : 'text-gray-400'} />
</button>
```

Add the handler in SetDetailPage:

```typescript
const handleToggleFavorite = async (templateId: string, current: boolean) => {
  await api.toggleTemplateFavorite(id, templateId, !current)
  api.getSet(id).then(setSet)
}
```

**Step 2: Render card favourite toggle**

In `renders/[batchId]/page.tsx` and `sets/[id]/apply/page.tsx`, add heart icon to render result cards. Add `Heart` to imports. In each render card, add beside the download button:

```tsx
<button onClick={() => toggleRenderFav(r.id)}
  className="shrink-0 p-1.5 rounded-full hover:bg-pink-50 text-gray-400">
  <Heart size={14} className={r.isFavorite ? 'fill-pink-500 text-pink-500' : ''} />
</button>
```

Add the handler:

```typescript
const toggleRenderFav = async (renderId: string) => {
  await api.toggleRenderFavorite(renderId)
  // Refresh data
}
```

Update the `Render`/`RenderStatus` interfaces to include `isFavorite?: boolean`.

In the batch GET API (`render/batches/[batchId]/route.ts`), ensure `isFavorite` is included in the render select. It already uses `include: { renders: { include: ... } }` which returns all fields.

**Step 3: Create favourites page**

```typescript
// frontend/src/app/(app)/favourites/page.tsx
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Heart, Download } from 'lucide-react'

interface FavTemplate {
  id: string
  name: string
  originalImagePath: string
  isFavorite: boolean
  mockupSet: { id: string; name: string }
}

interface FavRender {
  id: string
  isFavorite: boolean
  renderedImagePath: string
  status: string
  mockupTemplate: { name: string }
  design: { name: string }
}

export default function FavouritesPage() {
  const [templates, setTemplates] = useState<FavTemplate[]>([])
  const [renders, setRenders] = useState<FavRender[]>([])

  const load = () => api.getFavorites().then((data: { templates: FavTemplate[]; renders: FavRender[] }) => {
    setTemplates(data.templates)
    setRenders(data.renders)
  })

  useEffect(() => { load() }, [])

  const unfavTemplate = async (setId: string, templateId: string) => {
    await api.toggleTemplateFavorite(setId, templateId, false)
    load()
  }

  const unfavRender = async (renderId: string) => {
    await api.toggleRenderFavorite(renderId)
    load()
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Favourites</h1>

      <h2 className="text-lg font-semibold mb-3">Templates</h2>
      {templates.length === 0 ? (
        <p className="text-sm text-gray-400 mb-6">No favourite templates yet. Click the heart icon on any template to add it.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
          {templates.map((t) => (
            <div key={t.id} className="group relative rounded-xl border bg-white overflow-hidden">
              <Link href={`/sets/${t.mockupSet.id}/templates/${t.id}/edit`}>
                <img src={`/uploads/${t.originalImagePath}`} alt={t.name}
                  className="w-full aspect-square object-cover" />
              </Link>
              <div className="p-3">
                <p className="text-sm font-medium truncate">{t.name}</p>
                <p className="text-xs text-gray-400 truncate">{t.mockupSet.name}</p>
              </div>
              <button onClick={() => unfavTemplate(t.mockupSet.id, t.id)}
                className="absolute top-2 right-2 rounded-full bg-white p-2 shadow hover:bg-pink-50">
                <Heart size={14} className="fill-pink-500 text-pink-500" />
              </button>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-lg font-semibold mb-3">Renders</h2>
      {renders.length === 0 ? (
        <p className="text-sm text-gray-400">No favourite renders yet. Click the heart icon on any completed render to add it.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {renders.map((r) => (
            <div key={r.id} className="group relative rounded-xl border bg-white overflow-hidden">
              {r.status === 'complete' && (
                <img src={api.getDownloadUrl(r.id)} alt={r.mockupTemplate.name}
                  className="w-full aspect-square object-cover" />
              )}
              <div className="p-2">
                <p className="text-sm truncate">{r.mockupTemplate.name}</p>
                <p className="text-xs text-gray-400 truncate">Design: {r.design.name}</p>
              </div>
              <div className="absolute top-2 right-2 flex gap-1">
                <button onClick={() => unfavRender(r.id)}
                  className="rounded-full bg-white p-2 shadow hover:bg-pink-50">
                  <Heart size={14} className="fill-pink-500 text-pink-500" />
                </button>
                {r.status === 'complete' && (
                  <a href={api.getDownloadUrl(r.id)} download
                    className="rounded-full bg-white p-2 shadow hover:bg-gray-100">
                    <Download size={14} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 4: Add Favourites to sidebar**

In `sidebar.tsx`, add `Heart` to lucide-react imports. Add to the nav array after Designs:

```typescript
{ href: '/favourites', label: 'Favourites', icon: Heart },
```

**Step 5: Commit**

```bash
git add frontend/src/app/\(app\)/sets/\[id\]/page.tsx frontend/src/app/\(app\)/renders/\[batchId\]/page.tsx frontend/src/app/\(app\)/sets/\[id\]/apply/page.tsx frontend/src/app/\(app\)/favourites/page.tsx frontend/src/components/sidebar.tsx
git commit -m "feat: favourites UI with heart toggles and dedicated page"
```

---

### Task 8: Template Renders View

**Files:**
- Create: `frontend/src/app/api/mockup-sets/[id]/templates/[templateId]/renders/route.ts`
- Create: `frontend/src/app/(app)/sets/[id]/templates/[templateId]/renders/page.tsx`
- Modify: `frontend/src/app/(app)/sets/[id]/page.tsx`
- Modify: `frontend/src/lib/api.ts`

**Step 1: Create API route**

```typescript
// frontend/src/app/api/mockup-sets/[id]/templates/[templateId]/renders/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, handleAuthError } from '@/lib/server/auth'

type Params = { params: Promise<{ id: string; templateId: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = await requireAuth()
    const { id: setId, templateId } = await params
    const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10))
    const pageSize = 12

    const set = await prisma.mockupSet.findFirst({ where: { id: setId, userId } })
    if (!set) return NextResponse.json({ error: 'Set not found' }, { status: 404 })

    const [renders, total] = await Promise.all([
      prisma.renderedMockup.findMany({
        where: { mockupTemplateId: templateId },
        include: {
          design: { select: { id: true, name: true, imagePath: true } },
          batch: { select: { id: true, createdAt: true, description: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.renderedMockup.count({ where: { mockupTemplateId: templateId } }),
    ])

    return NextResponse.json({ renders, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
  } catch (err) {
    return handleAuthError(err)
  }
}
```

**Step 2: Create template renders page**

```typescript
// frontend/src/app/(app)/sets/[id]/templates/[templateId]/renders/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Download, ArrowLeft, ChevronLeft, ChevronRight, Heart } from 'lucide-react'

interface TemplateRender {
  id: string
  status: string
  renderedImagePath: string
  renderOptions?: { tintColor?: string }
  isFavorite?: boolean
  createdAt: string
  design: { id: string; name: string; imagePath: string }
  batch: { id: string; createdAt: string; description?: string } | null
}

export default function TemplateRendersPage() {
  const { id: setId, templateId } = useParams<{ id: string; templateId: string }>()
  const [renders, setRenders] = useState<TemplateRender[]>([])
  const [templateName, setTemplateName] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchPage = (p: number) => {
    api.getTemplateRenders(setId, templateId, p).then((data: { renders: TemplateRender[]; total: number; page: number; totalPages: number }) => {
      setRenders(data.renders)
      setTotal(data.total)
      setPage(data.page)
      setTotalPages(data.totalPages)
    })
  }

  useEffect(() => {
    fetchPage(1)
    api.getSet(setId).then((set: { templates: { id: string; name: string }[] }) => {
      const t = set.templates.find((t: { id: string }) => t.id === templateId)
      if (t) setTemplateName(t.name)
    })
  }, [setId, templateId])

  const toggleFav = async (renderId: string) => {
    await api.toggleRenderFavorite(renderId)
    fetchPage(page)
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })

  return (
    <div>
      <Link href={`/sets/${setId}`} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Back to set
      </Link>

      <h1 className="text-2xl font-bold mb-1">Renders: {templateName || '...'}</h1>
      <p className="text-sm text-gray-500 mb-6">{total} render{total !== 1 ? 's' : ''} across all batches</p>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {renders.map((r) => (
          <div key={r.id} className="rounded-xl border bg-white overflow-hidden group relative">
            {r.status === 'complete' ? (
              <img src={api.getDownloadUrl(r.id)} alt={templateName}
                className="w-full aspect-square object-cover" />
            ) : (
              <div className="w-full aspect-square flex items-center justify-center bg-gray-100 text-sm text-gray-400 capitalize">
                {r.status}
              </div>
            )}
            <div className="p-2">
              <div className="flex items-center gap-1.5">
                {r.renderOptions?.tintColor && (
                  <span className="w-3 h-3 rounded-full border border-gray-300 shrink-0"
                    style={{ backgroundColor: r.renderOptions.tintColor }} />
                )}
                <p className="text-sm truncate">{r.design.name}</p>
              </div>
              <p className="text-xs text-gray-400">{formatDate(r.createdAt)}</p>
              {r.batch?.description && (
                <p className="text-xs text-gray-400 truncate">{r.batch.description}</p>
              )}
            </div>
            <div className="absolute top-2 right-2 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              <button onClick={() => toggleFav(r.id)}
                className="rounded-full bg-white p-1.5 shadow hover:bg-pink-50">
                <Heart size={12} className={r.isFavorite ? 'fill-pink-500 text-pink-500' : 'text-gray-400'} />
              </button>
              {r.status === 'complete' && (
                <a href={api.getDownloadUrl(r.id)} download
                  className="rounded-full bg-white p-1.5 shadow hover:bg-gray-100">
                  <Download size={12} />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button onClick={() => fetchPage(page - 1)} disabled={page <= 1}
            className="flex items-center gap-1 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-30">
            <ChevronLeft size={16} /> Prev
          </button>
          <span className="text-sm text-gray-500">{page} / {totalPages}</span>
          <button onClick={() => fetchPage(page + 1)} disabled={page >= totalPages}
            className="flex items-center gap-1 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-30">
            Next <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
```

**Step 3: Add link from template card**

In `sets/[id]/page.tsx`, add `ImageDown` to lucide imports (already imported? check — if not, add). Add a new icon button in the TemplateCard action buttons:

```tsx
<Link href={`/sets/${setId}/templates/${t.id}/renders`}
  className="rounded-full bg-white p-2 shadow hover:bg-gray-100" title="View renders">
  <ImageDown size={14} />
</Link>
```

**Step 4: Add API client method**

In `api.ts`:

```typescript
getTemplateRenders: (setId: string, templateId: string, page = 1) =>
  request(`/api/mockup-sets/${setId}/templates/${templateId}/renders?page=${page}`),
```

**Step 5: Commit**

```bash
git add frontend/src/app/api/mockup-sets/\[id\]/templates/\[templateId\]/renders/ frontend/src/app/\(app\)/sets/\[id\]/templates/\[templateId\]/renders/ frontend/src/app/\(app\)/sets/\[id\]/page.tsx frontend/src/lib/api.ts
git commit -m "feat: template renders view with pagination"
```

---

### Task 9: Type Check + Final Verification

**Files:** All modified files

**Step 1: Type check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: Clean (0 errors). If there are errors, fix them.

**Step 2: Run Python tests**

```bash
cd processing && .venv/bin/python -m pytest tests/ -v
```

Expected: All pass.

**Step 3: Final commit and push**

```bash
git push
```

---

## Execution Order Summary

| Task | Component | Dependencies |
|------|-----------|-------------|
| 1 | Set name/description editing | None |
| 2 | Apply page breadcrumb | None |
| 3 | Schema migration (batch desc + favourites) | None |
| 4 | Batch description API + UI | 3 |
| 5 | Fix mask editor | None |
| 6 | Favourites API | 3 |
| 7 | Favourites UI + page | 6 |
| 8 | Template renders view | 6 (for isFavorite) |
| 9 | Type check + push | All |

Tasks 1, 2, 3, and 5 can run in parallel. Tasks 4 and 6 can run in parallel after 3. Tasks 7 and 8 can run in parallel after 6.
