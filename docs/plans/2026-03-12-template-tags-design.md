# Template Tags Design

## Overview

Add free-form tagging to template images on both the personal Library and site-wide Templates pages. Tags are shared globally across all users. Any user can create tags; admins can archive abusive tags.

## Data Model

### Tag table
- `id` UUID PK
- `name` String, unique, stored lowercased and trimmed
- `archivedAt` DateTime? — soft-delete hides from autocomplete/pills, keeps existing associations
- `createdAt` DateTime

### TemplateImageTag join table
- `templateImageId` FK → TemplateImage.id (cascade delete)
- `tagId` FK → Tag.id (cascade delete)
- Unique constraint on (templateImageId, tagId)

Tags are global — no userId. Names are lowercased on write to prevent duplicates.

## API Endpoints

### Tag management
- `GET /api/tags?search=` — list non-archived tags with usage counts, optional search filter for autocomplete
- `GET /api/tags/popular` — top 10 most-used non-archived tags (for pill display)
- `PATCH /api/tags/[id]` — admin only: rename (`name`) or archive (`archive: true`)

### Tagging template images
- `POST /api/template-images/[id]/tags` — body: `{ name: string }`. Creates Tag if new, adds join row. Auth required (owner check for personal, admin for site templates).
- `DELETE /api/template-images/[id]/tags/[tagId]` — remove tag from image. Same auth as above.

### Filtering
- `GET /api/template-images` — add `?tags=tag1,tag2` param. AND filter (images must have ALL specified tags).
- `GET /api/template-images/site` — same `?tags=` param.
- Both endpoints include `tags: [{id, name}]` on each image in the response.

## Frontend UI

### Image cards (both pages)
- Small tag pills below the star rating
- Click a tag pill on a card to add it to the active tag filter
- Small `+` button to add a tag — inline text input with autocomplete dropdown
- Tags on card show X to remove

### Filter bar (below sort pills, both pages)
- **Popular tag pills**: top 10 most-used tags as clickable rounded pills, active tags highlighted blue, multiple = AND filter
- **Tag search input**: small input with autocomplete dropdown showing matching tags with usage counts, selecting adds to active filters
- **Active filter chips**: selected tags shown as blue chips with X to remove, between filter bar and grid

### Library page additions
- Add search box (currently only Templates page has one) — name search and tag filter work together (AND)

### Admin moderation
- Admins see trash icon next to tags in the autocomplete dropdown
- Clicking archives the tag globally (hidden from suggestions, kept on existing images)

## Decisions
- Free-form tags, not predefined
- Shared tag pool across personal library and site templates
- Many-to-many join table (Approach A) for clean admin moderation
- AND logic for multi-tag filtering
- Archived tags hidden from UI but associations preserved
