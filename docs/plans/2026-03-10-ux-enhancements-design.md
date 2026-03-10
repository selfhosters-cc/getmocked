# UX Enhancements Design

**Goal:** Six enhancements to improve workflow, fix bugs, and add features: inline set editing, apply page context, batch descriptions, mask editor fix, favourites, and template renders view.

---

## 1. Set Name/Description Editing

Add inline editing to the set detail page header. Click name → editable input, click description → editable textarea. Auto-save on blur/Enter. Pencil icon hint.

**Files:** `frontend/src/app/(app)/sets/[id]/page.tsx`
**API:** Already exists — `PATCH /api/mockup-sets/{id}` accepts `name` and `description`.

---

## 2. Apply Page Set Context

Add breadcrumb at top: `My Sets > {Set Name} > Apply Design`. Set name links to `/sets/{id}`. Show template count: "Applying to N templates".

**Files:** `frontend/src/app/(app)/sets/[id]/apply/page.tsx`
**API:** Set data already fetched on this page.

---

## 3. Batch Description

Add optional description to render batches.

**Schema:** Add `description String? @map("description")` to `RenderBatch`.
**API changes:**
- `POST /api/render/batch` — accept optional `description` in body
- `GET /api/render/batches` — return description in batch list
- `GET /api/render/batches/{batchId}` — return description
- New: `PATCH /api/render/batches/{batchId}` — update description

**UI:**
- Apply page: optional "Batch note" input before render button
- Renders list: show description on batch cards
- Batch detail: show description, editable inline

**Files:** `frontend/prisma/schema.prisma`, `frontend/src/app/api/render/batch/route.ts`, `frontend/src/app/api/render/batches/route.ts`, `frontend/src/app/api/render/batches/[batchId]/route.ts`, `frontend/src/app/(app)/sets/[id]/apply/page.tsx`, `frontend/src/app/(app)/renders/page.tsx`, `frontend/src/app/(app)/renders/[batchId]/page.tsx`, `frontend/src/lib/api.ts`

---

## 4. Fix Mask Editor

**Root cause:** Processing service returns `maskPath` as absolute filesystem path. Frontend prepends `/uploads/` creating a broken URL.

**Fix:** In mask API route (`frontend/src/app/api/mockup-sets/[id]/templates/[templateId]/mask/route.ts`), convert absolute path to relative path by stripping the uploads base directory (same pattern as `batch/route.ts` line 88). Return relative path. Frontend `loadMask()` already prepends `/uploads/`.

Also verify brush stroke rendering works once the mask image loads correctly.

**Files:** `frontend/src/app/api/mockup-sets/[id]/templates/[templateId]/mask/route.ts`, possibly `frontend/src/components/editor/mask-editor.tsx`

---

## 5. Favourites

Star/heart toggle on templates and renders, with a dedicated Favourites page.

**Schema:** Add `isFavorite Boolean @default(false) @map("is_favorite")` to both `MockupTemplate` and `RenderedMockup`.

**API:**
- Extend existing `PATCH /api/mockup-sets/{id}/templates/{templateId}` to accept `isFavorite`
- New: `PATCH /api/render/{renderId}/favorite` — toggle favourite on render
- New: `GET /api/favorites` — returns `{ templates: [...], renders: [...] }` of all favourited items

**UI:**
- Heart icon on template cards (set detail page) — toggle on click
- Heart icon on render cards (apply page results, renders page, batch detail)
- New "Favourites" sidebar nav item (between Designs and Renders)
- New page `/favourites` with two sections: Favourited Templates grid and Favourited Renders grid

**Files:** `frontend/prisma/schema.prisma`, `frontend/src/app/api/mockup-sets/[id]/templates/[templateId]/route.ts`, `frontend/src/app/api/render/[renderId]/favorite/route.ts` (new), `frontend/src/app/api/favorites/route.ts` (new), `frontend/src/app/(app)/favourites/page.tsx` (new), `frontend/src/app/(app)/sets/[id]/page.tsx`, `frontend/src/app/(app)/sets/[id]/apply/page.tsx`, `frontend/src/app/(app)/renders/page.tsx`, `frontend/src/app/(app)/renders/[batchId]/page.tsx`, `frontend/src/components/sidebar.tsx`, `frontend/src/lib/api.ts`

---

## 6. Template Renders View

New page showing all renders created from a specific template across all batches.

**API:** New `GET /api/mockup-sets/{id}/templates/{templateId}/renders` — queries RenderedMockup by mockupTemplateId, includes design and batch info, paginated.

**UI:**
- Grid of render cards with design name, batch date, color variant dot, status, download link
- Link from template card on set detail page (new icon button)

**Files:** `frontend/src/app/api/mockup-sets/[id]/templates/[templateId]/renders/route.ts` (new), `frontend/src/app/(app)/sets/[id]/templates/[templateId]/renders/page.tsx` (new), `frontend/src/app/(app)/sets/[id]/page.tsx`, `frontend/src/lib/api.ts`
