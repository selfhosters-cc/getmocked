# Mobile-Friendly Editor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the template overlay editor, toolbar, and mask editor fully usable on mobile/touch devices.

**Architecture:** Add touch event handlers alongside existing mouse handlers, use ResizeObserver for responsive canvas sizing, restructure toolbar into a mobile-stacked layout with Tailwind responsive classes.

**Tech Stack:** React, Tailwind CSS, HTML5 Canvas, Touch Events API

---

### Task 1: MockupCanvas — Touch Events + Responsive Resize

**Files:**
- Modify: `frontend/src/components/editor/mockup-canvas.tsx`

**What to change:**

1. **Add touch event handlers** parallel to existing mouse handlers. Extract position logic into a shared helper that works with both `MouseEvent` and `TouchEvent`:

```tsx
const getEventPos = (e: React.MouseEvent | React.TouchEvent): Point => {
  const canvas = canvasRef.current!
  const rect = canvas.getBoundingClientRect()
  const clientX = 'touches' in e ? (e.touches[0]?.clientX ?? e.changedTouches[0].clientX) : e.clientX
  const clientY = 'touches' in e ? (e.touches[0]?.clientY ?? e.changedTouches[0].clientY) : e.clientY
  return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale }
}
```

2. **Add touch handlers** to the canvas element:
```tsx
onTouchStart={(e) => { e.preventDefault(); handlePointerDown(e) }}
onTouchMove={(e) => { e.preventDefault(); handlePointerMove(e) }}
onTouchEnd={(e) => { handlePointerUp() }}
```

3. **Add `touch-action: none`** style to the canvas to prevent browser scroll/zoom during drag.

4. **Use ResizeObserver** instead of one-shot clientWidth measurement:
```tsx
useEffect(() => {
  if (!image || !containerRef.current) return
  const ro = new ResizeObserver((entries) => {
    const width = entries[0].contentRect.width
    setScale(Math.min(1, width / image.width))
  })
  ro.observe(containerRef.current)
  return () => ro.disconnect()
}, [image])
```

5. **Increase corner handle hit area on touch**: Use 30px threshold instead of 20px when touch is detected. Can detect via `'ontouchstart' in window` or simply always use the larger threshold (30px is still fine for mouse).

**Verification:** Open in browser dev tools mobile emulation, drag corners with touch simulation.

---

### Task 2: MaskEditor — Touch Events + Responsive Canvas

**Files:**
- Modify: `frontend/src/components/editor/mask-editor.tsx`

**What to change:**

1. **Remove hardcoded `maxWidth = 800`**. Instead, use container width:
```tsx
useEffect(() => {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    const containerWidth = containerRef.current?.clientWidth ?? img.width
    const scale = Math.min(1, containerWidth / img.width)
    const w = Math.round(img.width * scale)
    const h = Math.round(img.height * scale)
    setCanvasSize({ width: w, height: h })
  }
  img.src = imageUrl
}, [imageUrl])
```

2. **Add ResizeObserver** to recalculate on resize (same pattern as Task 1).

3. **Change container from `inline-block` with fixed pixel width** to `w-full max-w-[800px]` with aspect-ratio or percentage-based height. The canvases inside should use `w-full h-full`:
```tsx
<div ref={containerRef}
  className="relative border rounded bg-gray-100 w-full max-w-[800px]"
  style={{ aspectRatio: `${canvasSize.width} / ${canvasSize.height}` }}>
  <canvas ... className="absolute inset-0 w-full h-full" />
  <canvas ... className="absolute inset-0 w-full h-full" />
</div>
```

4. **Add touch event handlers** — same pattern as Task 1, extracting a `getEventPos` helper from `getCanvasPoint`:
```tsx
const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent): StrokePoint => {
  const canvas = overlayCanvasRef.current!
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  const clientX = 'touches' in e ? (e.touches[0]?.clientX ?? e.changedTouches[0].clientX) : e.clientX
  const clientY = 'touches' in e ? (e.touches[0]?.clientY ?? e.changedTouches[0].clientY) : e.clientY
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  }
}
```

5. **Add `touch-action: none`** on the overlay canvas.

6. **Note:** `drawBrushPreview` is called on mouse move to show the cursor circle — skip this on touch (no hover on mobile). Only draw brush strokes during active drawing.

**Verification:** Open mask editor on mobile emulation, paint brush strokes with touch.

---

### Task 3: Toolbar — Mobile-Friendly Layout

**Files:**
- Modify: `frontend/src/components/editor/toolbar.tsx`

**What to change:**

Restructure the toolbar to stack on mobile and flow horizontally on desktop:

1. **Outer container**: Change from single flex-wrap row to a grid that stacks on mobile:
```tsx
<div className="rounded-lg border bg-white p-3 mb-4 space-y-3 sm:space-y-0 sm:flex sm:flex-wrap sm:items-center sm:gap-4">
```

2. **Mode selector**: Full width on mobile:
```tsx
<div className="flex items-center gap-2 w-full sm:w-auto">
```

3. **Sliders group**: Wrap in a container that uses 2-col grid on mobile, inline on desktop:
```tsx
<div className="grid grid-cols-2 gap-2 sm:contents">
  {/* Each slider div becomes a grid item on mobile */}
</div>
```

4. **Make sliders wider on mobile** — change `w-20 sm:w-28` to `w-full sm:w-28` within the grid cells, so they fill the available space.

5. **Axis buttons + Save/Reset**: Keep as flex row, full width on mobile:
```tsx
<div className="flex items-center justify-between gap-2 w-full sm:w-auto sm:ml-auto">
```

**Verification:** Resize browser to mobile width, confirm toolbar stacks cleanly.

---

### Task 4: Edit Page — Minor Mobile Polish

**Files:**
- Modify: `frontend/src/app/(app)/sets/[id]/templates/[templateId]/edit/page.tsx`

**What to change:**

1. **Design preview selector**: Already uses flex + gap, but wrap for mobile:
```tsx
<div className="flex flex-wrap items-center gap-3 mb-4">
```
(Already has `flex`, just needs `flex-wrap` added.)

2. **Page title**: Truncate on small screens:
```tsx
<h1 className="text-lg sm:text-xl font-bold mb-4 truncate">
```

3. **Details/mask section**: Add some bottom padding for mobile scroll:
```tsx
<details className="mt-6 mb-8 border rounded-lg">
```

**Verification:** Full editor page on mobile emulation looks clean.

---

### Task 5: Commit

```bash
git add frontend/src/components/editor/mockup-canvas.tsx \
       frontend/src/components/editor/mask-editor.tsx \
       frontend/src/components/editor/toolbar.tsx \
       frontend/src/app/\(app\)/sets/\[id\]/templates/\[templateId\]/edit/page.tsx
git commit -m "feat: make template editor and mask editor mobile friendly

Add touch event support for canvas interactions, responsive canvas
sizing with ResizeObserver, mobile-stacked toolbar layout, and
improved touch targets."
```
