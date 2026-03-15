# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Get Mocked** is a mockup generator for Etsy print-on-demand sellers. Users create reusable mockup templates by placing perspective-warped overlay regions on product photos, then batch-apply designs to generate finished mockups.

## Architecture

Two services + Postgres:

```
Frontend + API (Next.js 14, :3335) → Processing (FastAPI, :5000)
              ↓
         Postgres (192.168.5.3:5432)
```

- **Frontend + API**: Next.js 14 App Router with API routes (`app/api/`), Prisma ORM, JWT auth, Tailwind, Canvas 2D for interactive editor
- **Processing**: Python FastAPI, OpenCV perspective transforms, Pillow compositing
- **Shared volumes**: `/app/uploads` (user files) and `/app/rendered` (output mockups) mounted in both frontend and processing containers

## Commands

```bash
# Start all services (Docker)
docker compose up --build

# Start all services (local, no Docker)
./scripts/dev-local.sh

# Frontend tests (vitest)
cd frontend && npm run test

# Processing tests (pytest)
cd processing && pytest

# Database migrations
cd frontend && npx prisma migrate dev --name <name>
cd frontend && npx prisma db push

# Generate Prisma client after schema changes
cd frontend && npx prisma generate
```

## Key Conventions

- **Database column mapping**: Prisma uses camelCase fields mapped to snake_case columns via `@map()`
- **Auth**: JWT in httpOnly cookies; `requireAuth()` helper in `frontend/src/lib/server/auth.ts` returns userId
- **Google OAuth**: Custom implementation (no Passport) in `frontend/src/app/api/auth/google/` — exchanges code directly with Google APIs
- **File storage**: Uploads stored with relative paths (`templates/{setId}/{uuid}.ext`); resolved via `getUploadPath()` / `getRenderPath()` in `frontend/src/lib/server/storage.ts`
- **File uploads**: Next.js API routes parse FormData natively (no multer); `saveUpload()` accepts Web `File` objects
- **Frontend route groups**: `(auth)` for public pages, `(app)` for authenticated pages with sidebar layout
- **API client**: All API calls go through `frontend/src/lib/api.ts` using relative URLs; file uploads use FormData, JSON calls use a `request()` wrapper with `credentials: 'include'`
- **Server-side libs**: All server-only code lives in `frontend/src/lib/server/` (prisma, jwt, auth-utils, storage, auth)
- **Static files**: `/uploads/*` and `/rendered/*` served via catch-all route handlers with path traversal protection

## Service Communication

API routes call the processing service at `PROCESSING_URL` (default `http://processing:5000` in Docker):
- `POST /render` — accepts template/design image paths (absolute container paths), overlay config, returns output path
- `POST /detect-texture` — accepts image path + corner points, returns edge density and direction

Batch render flow: API creates `RenderedMockup` records as "pending", fires async requests to processing, updates status on completion/failure. Frontend polls `GET /api/render/status` every 2 seconds.

## Data Model (Prisma)

Schema at `frontend/prisma/schema.prisma`.

`User` → has many `MockupSet` → has many `MockupTemplate` (cascade delete)
`User` → has many `Design`
`User` → has many `EtsyConnection` (multiple Etsy shops per user)
`MockupTemplate` + `Design` → produces `RenderedMockup` (cascade on template delete)
`EtsyConnection` + `RenderedMockup` → produces `EtsyUpload` (tracks pushed images)

The `overlayConfig` JSON on `MockupTemplate` stores: 4 corner points, displacement intensity, texture data, mode (advanced/basic).

## Etsy Integration

OAuth 2.0 with PKCE for Etsy Open API v3. Multi-shop support — users can connect multiple Etsy shops.

**Environment variables required:**
- `ETSY_API_KEY` — Etsy app API key (keystring)
- `ETSY_REDIRECT_URI` — OAuth callback URL (e.g., `http://localhost:3335/api/etsy/callback`)

**Key files:**
- `frontend/src/lib/server/etsy.ts` — Etsy API client (auth, listings, image upload)
- `frontend/src/lib/server/etsy-connection.ts` — Token refresh helper with auto-refresh and stale detection
- `frontend/src/app/api/etsy/` — API routes (connect, callback, connections, listings, upload, uploads)
- `frontend/src/components/send-to-shop-modal.tsx` — Multi-step upload modal (shop → listing → confirm → upload → results)
- `frontend/src/app/(app)/connections/page.tsx` — Connection management page

**Upload flow:** Frontend sends one image at a time via `POST /api/etsy/upload`, updating UI per-image for real-time progress. Pre-checks listing slot availability (max 10), detects duplicate uploads, continues past failures with retry support.
