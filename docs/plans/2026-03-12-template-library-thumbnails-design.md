# Template Library & Thumbnails Design

**Goal:** Restructure templates from set-owned to a shared library model (personal + site-wide), with thumbnails for performance.

**Architecture:** New `TemplateImage` model represents the library item (image + default config). `MockupTemplate` becomes a per-set link to a `TemplateImage` with its own overlay config. Thumbnails generated on upload via `sharp`, with lazy fallback for existing images.

---

## Data Model

### New: `TemplateImage`

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| userId | uuid? | null = site-wide admin template |
| name | string | editable display name |
| imagePath | string | relative path to original |
| thumbnailPath | string? | relative path to `_thumb` variant |
| defaultOverlayConfig | json? | default corner/displacement/curvature config |
| defaultMaskPath | string? | default product mask for color tinting |
| archivedAt | datetime? | soft delete |
| createdAt | datetime | |

### Modified: `MockupTemplate`

| Field | Change |
|-------|--------|
| templateImageId | **ADD** — FK → TemplateImage |
| originalImagePath | **REMOVE** — now on TemplateImage |
| archivedAt | **ADD** — soft delete, preserves renders |

All other fields (mockupSetId, name, overlayConfig, sortOrder, isFavorite) remain.

### Modified: `User`

| Field | Change |
|-------|--------|
| isAdmin | **ADD** — boolean, default false |

### Unchanged: `RenderedMockup`

Still references `MockupTemplate`. Archived templates keep their renders intact.

## Archive Behavior

- **No hard deletes** for templates or set memberships.
- Removing a template from a set = archive the MockupTemplate (set `archivedAt`).
- Removing from library = archive the TemplateImage + archive all its MockupTemplates.
- All queries filter `WHERE archivedAt IS NULL`.
- Renders still join to archived MockupTemplates to display template name/thumbnail.

## Thumbnails

- **Size:** 400px on longest side.
- **Format:** Same as original (JPEG/PNG).
- **Storage:** Next to original with `_thumb` suffix (`abc123.jpg` → `abc123_thumb.jpg`).
- **Generation:** On upload via `sharp` (Node.js). Lazy fallback via `/api/thumbnails/[...path]` route for existing images.
- **Usage:** All grid views (sets, library, renders, apply page). Full images only in overlay editor and processing.

## Pages

### New: `/templates`
Site-wide template library. All users can browse and add to sets. Admin users see upload/rename/archive controls. Grid of thumbnails with name, set count, render count.

### New: `/library`
Personal template library. User's own uploads only. Full management: upload, rename, archive, add to set, duplicate. Grid with same stats.

### New: `/library/[id]`
Template image detail. Full-size image, list of sets it's in, renders across sets. Edit name, set/edit default overlay config.

### Modified: `/sets/[id]`
"Add Templates" button opens picker modal browsing personal library + site-wide library. Direct upload still works (creates TemplateImage + MockupTemplate in one step). Template cards use thumbnails.

### Modified: `/sets/[id]/templates/[templateId]/edit`
Reads image from TemplateImage via join. "Save as default" button copies current overlay config to TemplateImage.defaultOverlayConfig.

### New: `/admin/templates` → actually `/templates`
Admin upload/management is on the same `/templates` page, gated by `isAdmin` flag.

### Navigation
- "Library" added to sidebar (personal library).
- "Templates" added to sidebar (site-wide catalog).

## API Routes

### New

| Route | Method | Description |
|-------|--------|-------------|
| `GET /api/template-images` | GET | Personal library (paginated), includes setCount + renderCount |
| `POST /api/template-images` | POST | Upload to personal library (FormData) |
| `GET /api/template-images/[id]` | GET | Single template image with stats |
| `PATCH /api/template-images/[id]` | PATCH | Update name, defaultOverlayConfig, defaultMaskPath |
| `DELETE /api/template-images/[id]` | DELETE | Archive (set archivedAt) |
| `GET /api/template-images/site` | GET | Site-wide templates (paginated, all users) |
| `POST /api/template-images/site` | POST | Upload site-wide (admin only) |
| `PATCH /api/template-images/site/[id]` | PATCH | Update site-wide (admin only) |
| `DELETE /api/template-images/site/[id]` | DELETE | Archive site-wide (admin only) |
| `GET /api/thumbnails/[...path]` | GET | Serve thumbnail, lazy generate if missing |

### Modified

| Route | Change |
|-------|--------|
| `POST /api/mockup-sets/[id]/templates` | Accepts `templateImageId` to link existing library image. Also accepts FormData for quick-upload (creates TemplateImage + MockupTemplate). |
| `DELETE /api/mockup-sets/[id]/templates/[id]` | Archives instead of hard delete. |
| `GET /api/mockup-sets/[id]` | Includes TemplateImage data (thumbnailPath, imagePath) via join. |

## Adding Templates to Sets

Two flows, same result:

1. **From set page** — "Add Templates" opens modal browsing library + site-wide. Selecting creates MockupTemplate with defaultOverlayConfig copied from TemplateImage.
2. **From library page** — select templates → "Add to Set" → pick target set(s). Same creation logic.

Quick-upload from set page still works: creates TemplateImage in personal library + MockupTemplate in one step.

## Duplication

Duplicating a template = creating a new MockupTemplate pointing to the same TemplateImage. New entry gets its own name and overlay config (copied from source). No image file duplication.

## Migration Strategy

1. **Schema changes:** Create TemplateImage, add nullable `templateImageId` and `archivedAt` to MockupTemplate, add `isAdmin` to User.
2. **Data migration:** For each existing MockupTemplate, create TemplateImage (userId from owning set, name/imagePath/overlayConfig copied). Deduplicate by imagePath within same user. Set templateImageId.
3. **Thumbnail generation:** Script iterates all TemplateImages, generates `_thumb` variants via sharp, updates thumbnailPath.
4. **Tighten constraints:** Make templateImageId NOT NULL, drop originalImagePath from MockupTemplate.
