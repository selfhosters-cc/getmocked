# Get Mocked — Design Document

## Overview

Web app for Etsy print-on-demand sellers to create reusable mockup templates and batch-apply designs. Sellers define printable areas on product photos with perspective warp and texture displacement, then apply any design to an entire set at once.

## Architecture

Three Dockerized services:

1. **Frontend** — Next.js (React). Interactive mockup editor using Canvas/WebGL. Client-side real-time preview rendering.
2. **Backend API** — Node.js/Express. Auth (Google SSO + email signup), mockup set CRUD, file storage orchestration, batch job management.
3. **Image Processing Service** — Python/FastAPI. Perspective transforms, auto texture detection, displacement mapping, batch high-res rendering. Uses Pillow, OpenCV, NumPy.

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────────┐
│   Next.js   │────▶│  Node.js API │────▶│  Python/FastAPI      │
│  Frontend   │     │  (Auth, CRUD │     │  (Image Processing)  │
│  (Canvas/   │     │   Storage)   │     │                      │
│   WebGL)    │     │              │     │                      │
└─────────────┘     └──────┬───────┘     └──────────────────────┘
                           │
                    ┌──────┴───────┐
                    │  Postgres    │
                    │  + Local FS  │
                    └──────────────┘
```

**Database:** Postgres (existing instance)
**File Storage:** Local filesystem with abstraction layer (swappable to S3 later)
**Deployment:** Docker Compose

## Data Model

**Users** — id, email, name, auth_provider (google/email), password_hash (nullable for SSO), created_at

**Mockup Sets** — id, user_id, name, description, created_at

**Mockup Templates** — id, mockup_set_id, name, original_image_path, overlay_config (JSON: 4 corner points, displacement intensity, detected texture data), sort_order

**Designs** — id, user_id, name, image_path, created_at

**Rendered Mockups** — id, mockup_template_id, design_id, rendered_image_path, created_at

Key relationship: one Mockup Set has many Templates. Each Template stores its overlay configuration. Applying a Design to a Set generates one Rendered Mockup per Template.

## Mockup Editor (Core UX)

### Editor Workspace
- Large canvas showing the product photo
- Overlay box with 4 draggable corner handles (perspective warp)
- Toolbar: undo/redo, reset, zoom, grid toggle

### Workflow
1. User uploads a product photo (e.g., blank t-shirt on model)
2. Default rectangular overlay appears centered on the image
3. User drags 4 corners to match the product surface
4. Auto-texture detection runs on the region (client-side edge detection, no paid APIs)
5. Preview panel shows sample design applied in real-time (Canvas 2D)
6. User adjusts displacement intensity with slider
7. User saves — overlay config stored to template

### Mode Toggle
- **Advanced mode** (default): 4-corner perspective warp + texture displacement
- **Basic mode** (fallback): rectangular selection with resize and rotation only

Real-time preview is client-side Canvas (fast, approximate). Final renders go through Python service.

## Batch Apply & Export

1. User selects a mockup set
2. Picks or uploads a design image
3. Frontend shows quick client-side previews
4. User clicks "Render All"
5. Backend sends each template + design to Python service as batch job
6. Python applies perspective transform + displacement at full resolution
7. Rendered mockups saved to storage, user notified on completion
8. Download individually or as ZIP

Job handling: async tasks in Python service, simple status polling (pending/processing/complete/failed).

## Authentication

- Google SSO via OAuth 2.0
- Email/password signup
- JWT tokens, session management via httpOnly cookies

## Pages

1. **Landing / Login** — sign up or sign in
2. **Dashboard** — mockup sets list, recent designs, quick actions
3. **Mockup Set Editor** — manage templates within a set (add/remove/reorder)
4. **Template Editor** — interactive canvas for overlay placement
5. **Apply Design** — pick set + design, preview all, trigger batch render
6. **Renders** — view/download completed mockups

Navigation: sidebar — Dashboard, My Sets, My Designs, Renders

## MVP Scope

- Single user focus
- No monetization or subscription tiers
- No sharing or collaboration
- Local file storage (abstracted for future migration)
