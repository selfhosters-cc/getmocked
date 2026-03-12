# Remix Render Design

**Goal:** Let users modify a template's overlay settings and re-render a single mockup without leaving the current page.

## Remix Modal

A `<RemixModal>` component that embeds the existing `MockupCanvas` + `Toolbar` editor inside a modal overlay. Opened from any page that displays completed renders (batch detail, template renders, apply design).

### Props

- `renderId`, `templateId`, `setId`, `designId` — IDs to load data
- `overlayConfig` — current template overlay config
- `renderOptions` — current render options (tintColor, outputMode, outputColor)
- `batchId` — optional, to associate the new render with an existing batch
- `onClose` — dismiss modal
- `onRendered(newRender)` — callback when new render is ready; parent inserts into grid

### Layout

- Modal with dark backdrop, max-width ~5xl to fit canvas + toolbar
- Canvas in preview mode by default (shows composited design on template), toggleable to edit mode for corner adjustment
- Toolbar with all overlay settings: mode, displacement, transparency, curvature, curve axis
- Render options section below toolbar: output mode (original/transparent/solid), output color, tint color
- Footer: Cancel and Re-render buttons
- Loading/progress state while render processes

### Behavior

1. User clicks Remix on a completed render
2. Modal opens with current settings pre-loaded
3. User adjusts overlay config (corners, displacement, transparency, curvature) and/or render options (output mode, tint color)
4. User clicks "Re-render"
5. Modal PATCHes template overlayConfig via existing `PATCH /api/mockup-sets/{setId}/templates/{templateId}`
6. Modal POSTs to `POST /api/render/single` to create one render
7. Modal polls for completion, shows progress
8. On complete, calls `onRendered` with new render data
9. Parent page inserts new render into grid (no full page refresh)
10. Modal closes (or stays open for further iteration)

## API

### `POST /api/render/single`

Renders a single template + design combination.

```json
{
  "mockupTemplateId": "uuid",
  "designId": "uuid",
  "tintColor": "#ff0000",
  "outputMode": "transparent",
  "outputColor": null,
  "batchId": "uuid"
}
```

- `batchId` optional — if provided, new render is added to that batch
- Creates one `RenderedMockup` record with status "pending"
- Fires async processing (same `processRender` logic as batch)
- Returns `{ renderId, status: "pending" }`

### `GET /api/render/[id]/status`

Returns current status of a single render. Used for polling.

```json
{
  "id": "uuid",
  "status": "complete",
  "renderedImagePath": "...",
  "renderOptions": { ... },
  "mockupTemplate": { "name": "..." }
}
```

## UI Integration

### Remix button

Lucide `RefreshCw` icon button, same size/style as existing favorite and download buttons.

Appears in two contexts on each page:

1. **Render card** — icon button in the card footer alongside favorite/download, visible on completed renders only
2. **Lightbox** — in the bottom info bar alongside Download link

### Pages that get the Remix button

1. **Batch detail** (`renders/[batchId]/page.tsx`) — `batchId` known, new renders append to same batch, completion count updates
2. **Template renders** (`sets/[id]/templates/[templateId]/renders/page.tsx`) — uses render's existing `batchId` if present
3. **Apply design** (`sets/[id]/apply/page.tsx`) — `batchId` known from current session

### Parent page update

When `onRendered` fires, the parent inserts the new render into its local state array. The new render appears in the grid immediately. Batch completion counts update accordingly.

## No Schema Changes

Uses existing `RenderedMockup` and `MockupTemplate` models. The single-render endpoint reuses the same `processRender` function from batch rendering.
