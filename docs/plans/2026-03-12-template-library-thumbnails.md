# Template Library & Thumbnails Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure templates from set-owned to a shared library model (personal + site-wide) with thumbnail generation for faster page loads.

**Architecture:** New `TemplateImage` model is the library item (image + default config). `MockupTemplate` becomes a per-set link with its own overlay config. Thumbnails generated on upload via `sharp`, lazy fallback for existing images. Archive (soft-delete) instead of hard delete to preserve renders.

**Tech Stack:** Next.js 14 App Router, Prisma ORM (Postgres), sharp (thumbnails), Tailwind CSS, TypeScript

**Design doc:** `docs/plans/2026-03-12-template-library-thumbnails-design.md`

---

### Task 1: Prisma Schema — Add TemplateImage Model and Modify MockupTemplate

**Files:**
- Modify: `frontend/prisma/schema.prisma`

**Context:** Current `MockupTemplate` has `originalImagePath` directly on it, belongs to one set. We're adding `TemplateImage` as the library item and making `MockupTemplate` a per-set link. Also adding `isAdmin` to `User`.

**Step 1: Update the Prisma schema**

Add the new `TemplateImage` model and modify existing models:

```prisma
model User {
  id             String          @id @default(uuid())
  email          String          @unique
  name           String?
  passwordHash   String?         @map("password_hash")
  authProvider   String          @default("email") @map("auth_provider")
  isAdmin        Boolean         @default(false) @map("is_admin")
  createdAt      DateTime        @default(now()) @map("created_at")
  mockupSets     MockupSet[]
  designs        Design[]
  renderBatches  RenderBatch[]
  templateImages TemplateImage[]

  @@map("users")
}

model TemplateImage {
  id                   String           @id @default(uuid())
  userId               String?          @map("user_id")
  name                 String
  imagePath            String           @map("image_path")
  thumbnailPath        String?          @map("thumbnail_path")
  defaultOverlayConfig Json?            @map("default_overlay_config")
  defaultMaskPath      String?          @map("default_mask_path")
  archivedAt           DateTime?        @map("archived_at")
  createdAt            DateTime         @default(now()) @map("created_at")
  user                 User?            @relation(fields: [userId], references: [id])
  templates            MockupTemplate[]

  @@map("template_images")
}

model MockupTemplate {
  id              String          @id @default(uuid())
  mockupSetId     String          @map("mockup_set_id")
  templateImageId String?         @map("template_image_id")
  name            String
  originalImagePath String?       @map("original_image_path")
  overlayConfig   Json?           @map("overlay_config")
  sortOrder       Int             @default(0) @map("sort_order")
  isFavorite      Boolean         @default(false) @map("is_favorite")
  archivedAt      DateTime?       @map("archived_at")
  mockupSet       MockupSet       @relation(fields: [mockupSetId], references: [id], onDelete: Cascade)
  templateImage   TemplateImage?  @relation(fields: [templateImageId], references: [id])
  renderedMockups RenderedMockup[]

  @@map("mockup_templates")
}
```

Note: `templateImageId` is nullable and `originalImagePath` is kept (nullable) during migration. They'll be tightened in a later task.

**Step 2: Generate and run the migration**

Run:
```bash
cd frontend && npx prisma migrate dev --name add_template_image_library
```

Expected: Migration creates `template_images` table, adds `template_image_id`, `archived_at` to `mockup_templates`, adds `is_admin` to `users`.

**Step 3: Generate Prisma client**

Run:
```bash
cd frontend && npx prisma generate
```

**Step 4: Commit**

```bash
git add frontend/prisma/
git commit -m "feat: add TemplateImage model and library schema changes"
```

---

### Task 2: Sharp Dependency and Thumbnail Utility

**Files:**
- Modify: `frontend/package.json` (via npm install)
- Create: `frontend/src/lib/server/thumbnails.ts`

**Context:** Thumbnails are 400px on longest side, saved next to original with `_thumb` suffix. Need `sharp` for image processing.

**Step 1: Install sharp**

Run:
```bash
cd frontend && npm install sharp && npm install -D @types/sharp
```

**Step 2: Create thumbnail utility**

Create `frontend/src/lib/server/thumbnails.ts`:

```typescript
import sharp from 'sharp'
import path from 'path'
import fs from 'fs/promises'

const THUMB_SIZE = 400

function getThumbPath(originalPath: string): string {
  const ext = path.extname(originalPath)
  const base = originalPath.slice(0, -ext.length)
  return `${base}_thumb${ext}`
}

export async function generateThumbnail(
  uploadDir: string,
  relativePath: string
): Promise<string> {
  const absoluteOriginal = path.join(uploadDir, relativePath)
  const thumbRelative = getThumbPath(relativePath)
  const absoluteThumb = path.join(uploadDir, thumbRelative)

  // Skip if thumbnail already exists
  try {
    await fs.access(absoluteThumb)
    return thumbRelative
  } catch {
    // Doesn't exist, generate it
  }

  await sharp(absoluteOriginal)
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'inside', withoutEnlargement: true })
    .toFile(absoluteThumb)

  return thumbRelative
}

export async function ensureThumbnail(
  uploadDir: string,
  relativePath: string
): Promise<string> {
  return generateThumbnail(uploadDir, relativePath)
}

export { getThumbPath }
```

**Step 3: Verify it compiles**

Run:
```bash
cd frontend && npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/lib/server/thumbnails.ts
git commit -m "feat: add sharp and thumbnail generation utility"
```

---

### Task 3: Data Migration Script

**Files:**
- Create: `scripts/migrate-template-images.ts`

**Context:** Existing `MockupTemplate` rows each have `originalImagePath`. We need to create `TemplateImage` records and link them. Deduplicate by (userId, imagePath). Also generate thumbnails for all existing images.

**Step 1: Create the migration script**

Create `scripts/migrate-template-images.ts`:

```typescript
import { PrismaClient } from '@prisma/client'
import { generateThumbnail } from '../frontend/src/lib/server/thumbnails'

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'

async function main() {
  const prisma = new PrismaClient()

  try {
    // Get all existing templates with their set's userId
    const templates = await prisma.mockupTemplate.findMany({
      where: { templateImageId: null },
      include: { mockupSet: { select: { userId: true } } },
    })

    console.log(`Found ${templates.length} templates to migrate`)

    // Group by (userId, imagePath) for deduplication
    const imageMap = new Map<string, {
      userId: string
      imagePath: string
      name: string
      overlayConfig: unknown
      templateIds: string[]
    }>()

    for (const t of templates) {
      const key = `${t.mockupSet.userId}::${t.originalImagePath}`
      const existing = imageMap.get(key)
      if (existing) {
        existing.templateIds.push(t.id)
      } else {
        imageMap.set(key, {
          userId: t.mockupSet.userId,
          imagePath: t.originalImagePath!,
          name: t.name,
          overlayConfig: t.overlayConfig,
          templateIds: [t.id],
        })
      }
    }

    console.log(`Creating ${imageMap.size} TemplateImage records (${templates.length - imageMap.size} deduped)`)

    for (const [, data] of imageMap) {
      // Generate thumbnail
      let thumbnailPath: string | null = null
      try {
        thumbnailPath = await generateThumbnail(UPLOAD_DIR, data.imagePath)
        console.log(`  Thumbnail: ${thumbnailPath}`)
      } catch (err) {
        console.warn(`  Thumbnail failed for ${data.imagePath}:`, err)
      }

      // Create TemplateImage
      const templateImage = await prisma.templateImage.create({
        data: {
          userId: data.userId,
          name: data.name,
          imagePath: data.imagePath,
          thumbnailPath,
          defaultOverlayConfig: data.overlayConfig as any,
        },
      })

      // Link all MockupTemplates that share this image
      await prisma.mockupTemplate.updateMany({
        where: { id: { in: data.templateIds } },
        data: { templateImageId: templateImage.id },
      })

      console.log(`  Created TemplateImage ${templateImage.id} -> ${data.templateIds.length} templates`)
    }

    console.log('Migration complete!')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(console.error)
```

**Step 2: Run the migration**

Run:
```bash
cd frontend && npx tsx ../scripts/migrate-template-images.ts
```

Expected: Creates TemplateImage records, generates thumbnails, links existing templates.

**Step 3: Verify**

Run:
```bash
cd frontend && npx prisma studio
```

Check that `template_images` table has records and `mockup_templates.template_image_id` is populated.

**Step 4: Commit**

```bash
git add scripts/migrate-template-images.ts
git commit -m "feat: data migration script for template images"
```

---

### Task 4: Template Image API Routes (Personal Library)

**Files:**
- Create: `frontend/src/app/api/template-images/route.ts`
- Create: `frontend/src/app/api/template-images/[id]/route.ts`

**Context:** Personal library CRUD. GET returns paginated list with set count and render count. POST uploads a new image. PATCH updates name/config. DELETE archives (soft delete).

**Step 1: Create the list/upload route**

Create `frontend/src/app/api/template-images/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, handleAuthError } from '@/lib/server/auth'
import { saveUpload } from '@/lib/server/storage'
import { generateThumbnail } from '@/lib/server/thumbnails'

const PAGE_SIZE = 24

export async function GET(req: NextRequest) {
  try {
    const userId = await requireAuth()
    const page = parseInt(req.nextUrl.searchParams.get('page') || '1')
    const offset = (page - 1) * PAGE_SIZE

    const [images, total] = await Promise.all([
      prisma.templateImage.findMany({
        where: { userId, archivedAt: null },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: PAGE_SIZE,
        include: {
          _count: {
            select: {
              templates: { where: { archivedAt: null } },
            },
          },
        },
      }),
      prisma.templateImage.count({ where: { userId, archivedAt: null } }),
    ])

    // Get render counts in bulk
    const imageIds = images.map((i) => i.id)
    const renderCounts = await prisma.renderedMockup.groupBy({
      by: ['mockupTemplateId'],
      where: {
        mockupTemplate: { templateImageId: { in: imageIds } },
      },
      _count: true,
    })

    // Map template -> image for render counting
    const templateToImage = new Map<string, string>()
    const templatesForImages = await prisma.mockupTemplate.findMany({
      where: { templateImageId: { in: imageIds } },
      select: { id: true, templateImageId: true },
    })
    for (const t of templatesForImages) {
      if (t.templateImageId) templateToImage.set(t.id, t.templateImageId)
    }

    const renderCountByImage = new Map<string, number>()
    for (const rc of renderCounts) {
      const imageId = templateToImage.get(rc.mockupTemplateId)
      if (imageId) {
        renderCountByImage.set(imageId, (renderCountByImage.get(imageId) || 0) + rc._count)
      }
    }

    const result = images.map((img) => ({
      ...img,
      setCount: img._count.templates,
      renderCount: renderCountByImage.get(img.id) || 0,
    }))

    return NextResponse.json({ images: result, total, page, pageSize: PAGE_SIZE })
  } catch (err) {
    return handleAuthError(err)
  }
}

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'

export async function POST(req: NextRequest) {
  try {
    const userId = await requireAuth()
    const formData = await req.formData()
    const file = formData.get('image') as File | null
    if (!file) {
      return NextResponse.json({ error: 'Image file required' }, { status: 400 })
    }

    const imagePath = await saveUpload(file, 'templates/library')
    let thumbnailPath: string | null = null
    try {
      thumbnailPath = await generateThumbnail(UPLOAD_DIR, imagePath)
    } catch {
      // Thumbnail will be generated lazily
    }

    const image = await prisma.templateImage.create({
      data: {
        userId,
        name: (formData.get('name') as string) || file.name.replace(/\.[^.]+$/, ''),
        imagePath,
        thumbnailPath,
      },
    })

    return NextResponse.json(image, { status: 201 })
  } catch (err) {
    return handleAuthError(err)
  }
}
```

**Step 2: Create the single-item route**

Create `frontend/src/app/api/template-images/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, handleAuthError } from '@/lib/server/auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = await requireAuth()
    const { id } = await params

    const image = await prisma.templateImage.findFirst({
      where: {
        id,
        archivedAt: null,
        OR: [{ userId }, { userId: null }],
      },
      include: {
        templates: {
          where: { archivedAt: null },
          include: {
            mockupSet: { select: { id: true, name: true } },
            _count: { select: { renderedMockups: true } },
          },
        },
      },
    })

    if (!image) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const renderCount = image.templates.reduce((sum, t) => sum + t._count.renderedMockups, 0)

    return NextResponse.json({
      ...image,
      setCount: image.templates.length,
      renderCount,
      sets: image.templates.map((t) => ({
        id: t.mockupSet.id,
        name: t.mockupSet.name,
        templateId: t.id,
        renderCount: t._count.renderedMockups,
      })),
    })
  } catch (err) {
    return handleAuthError(err)
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const userId = await requireAuth()
    const { id } = await params

    const image = await prisma.templateImage.findFirst({
      where: { id, userId, archivedAt: null },
    })
    if (!image) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await req.json()
    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = body.name
    if (body.defaultOverlayConfig !== undefined) data.defaultOverlayConfig = body.defaultOverlayConfig
    if (body.defaultMaskPath !== undefined) data.defaultMaskPath = body.defaultMaskPath

    const updated = await prisma.templateImage.update({ where: { id }, data })
    return NextResponse.json(updated)
  } catch (err) {
    return handleAuthError(err)
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const userId = await requireAuth()
    const { id } = await params

    const image = await prisma.templateImage.findFirst({
      where: { id, userId, archivedAt: null },
    })
    if (!image) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const now = new Date()

    // Archive the template image and all its set memberships
    await prisma.$transaction([
      prisma.templateImage.update({
        where: { id },
        data: { archivedAt: now },
      }),
      prisma.mockupTemplate.updateMany({
        where: { templateImageId: id, archivedAt: null },
        data: { archivedAt: now },
      }),
    ])

    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleAuthError(err)
  }
}
```

**Step 3: Verify compilation**

Run:
```bash
cd frontend && npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add frontend/src/app/api/template-images/
git commit -m "feat: template image API routes for personal library"
```

---

### Task 5: Site-Wide Template API Routes

**Files:**
- Create: `frontend/src/app/api/template-images/site/route.ts`
- Create: `frontend/src/app/api/template-images/site/[id]/route.ts`

**Context:** Site-wide templates have `userId = null`. All users can GET; only admins can POST/PATCH/DELETE.

**Step 1: Create admin auth helper**

Add to `frontend/src/lib/server/auth.ts`:

```typescript
export async function requireAdmin(): Promise<string> {
  const userId = await requireAuth()
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } })
  if (!user?.isAdmin) {
    throw new AuthError()
  }
  return userId
}
```

Note: You'll need to add the prisma import at the top of auth.ts if not already there.

**Step 2: Create the site list/upload route**

Create `frontend/src/app/api/template-images/site/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, requireAdmin, handleAuthError } from '@/lib/server/auth'
import { saveUpload } from '@/lib/server/storage'
import { generateThumbnail } from '@/lib/server/thumbnails'

const PAGE_SIZE = 24

export async function GET(req: NextRequest) {
  try {
    await requireAuth()
    const page = parseInt(req.nextUrl.searchParams.get('page') || '1')
    const search = req.nextUrl.searchParams.get('search') || ''
    const offset = (page - 1) * PAGE_SIZE

    const where = {
      userId: null as string | null,
      archivedAt: null as Date | null,
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
    }

    const [images, total] = await Promise.all([
      prisma.templateImage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: PAGE_SIZE,
        include: {
          _count: {
            select: { templates: { where: { archivedAt: null } } },
          },
        },
      }),
      prisma.templateImage.count({ where }),
    ])

    const result = images.map((img) => ({
      ...img,
      setCount: img._count.templates,
    }))

    return NextResponse.json({ images: result, total, page, pageSize: PAGE_SIZE })
  } catch (err) {
    return handleAuthError(err)
  }
}

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const formData = await req.formData()
    const file = formData.get('image') as File | null
    if (!file) {
      return NextResponse.json({ error: 'Image file required' }, { status: 400 })
    }

    const imagePath = await saveUpload(file, 'templates/site')
    let thumbnailPath: string | null = null
    try {
      thumbnailPath = await generateThumbnail(UPLOAD_DIR, imagePath)
    } catch {
      // Lazy fallback
    }

    const image = await prisma.templateImage.create({
      data: {
        userId: null,
        name: (formData.get('name') as string) || file.name.replace(/\.[^.]+$/, ''),
        imagePath,
        thumbnailPath,
        defaultOverlayConfig: null,
      },
    })

    return NextResponse.json(image, { status: 201 })
  } catch (err) {
    return handleAuthError(err)
  }
}
```

**Step 3: Create the site single-item route**

Create `frontend/src/app/api/template-images/site/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { requireAdmin, handleAuthError } from '@/lib/server/auth'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireAdmin()
    const { id } = await params

    const image = await prisma.templateImage.findFirst({
      where: { id, userId: null, archivedAt: null },
    })
    if (!image) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await req.json()
    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = body.name
    if (body.defaultOverlayConfig !== undefined) data.defaultOverlayConfig = body.defaultOverlayConfig
    if (body.defaultMaskPath !== undefined) data.defaultMaskPath = body.defaultMaskPath

    const updated = await prisma.templateImage.update({ where: { id }, data })
    return NextResponse.json(updated)
  } catch (err) {
    return handleAuthError(err)
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    await requireAdmin()
    const { id } = await params

    const image = await prisma.templateImage.findFirst({
      where: { id, userId: null, archivedAt: null },
    })
    if (!image) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const now = new Date()
    await prisma.$transaction([
      prisma.templateImage.update({ where: { id }, data: { archivedAt: now } }),
      prisma.mockupTemplate.updateMany({
        where: { templateImageId: id, archivedAt: null },
        data: { archivedAt: now },
      }),
    ])

    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleAuthError(err)
  }
}
```

**Step 4: Verify and commit**

Run:
```bash
cd frontend && npx tsc --noEmit
```

```bash
git add frontend/src/app/api/template-images/site/ frontend/src/lib/server/auth.ts
git commit -m "feat: site-wide template API routes with admin auth"
```

---

### Task 6: Thumbnail Serving Route

**Files:**
- Create: `frontend/src/app/api/thumbnails/[...path]/route.ts`

**Context:** Serves thumbnails with lazy generation. If thumbnail doesn't exist yet, generates it on-the-fly, saves to disk, updates DB, then serves. Falls back to original if generation fails.

**Step 1: Create the route**

Create `frontend/src/app/api/thumbnails/[...path]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { ensureThumbnail, getThumbPath } from '@/lib/server/thumbnails'
import { prisma } from '@/lib/server/prisma'

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const segments = (await params).path
  const relativePath = segments.join('/')

  // Path traversal protection
  const absolutePath = path.resolve(UPLOAD_DIR, relativePath)
  if (!absolutePath.startsWith(path.resolve(UPLOAD_DIR))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Check if the original file exists
  try {
    await fs.access(absolutePath)
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Generate thumbnail if needed
  let thumbRelative: string
  try {
    thumbRelative = await ensureThumbnail(UPLOAD_DIR, relativePath)
  } catch {
    // Fall back to original
    thumbRelative = relativePath
  }

  const thumbAbsolute = path.join(UPLOAD_DIR, thumbRelative)

  // Update DB record if we generated a new thumbnail
  if (thumbRelative !== relativePath) {
    await prisma.templateImage.updateMany({
      where: { imagePath: relativePath, thumbnailPath: null },
      data: { thumbnailPath: thumbRelative },
    }).catch(() => {
      // Non-critical, ignore
    })
  }

  const ext = path.extname(thumbAbsolute).toLowerCase()
  const contentType = MIME_TYPES[ext] || 'application/octet-stream'

  const buffer = await fs.readFile(thumbAbsolute)
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
```

**Step 2: Verify and commit**

Run:
```bash
cd frontend && npx tsc --noEmit
```

```bash
git add frontend/src/app/api/thumbnails/
git commit -m "feat: thumbnail serving route with lazy generation"
```

---

### Task 7: Modify Set Template Routes for Library Integration

**Files:**
- Modify: `frontend/src/app/api/mockup-sets/[id]/templates/route.ts`
- Modify: `frontend/src/app/api/mockup-sets/[id]/templates/[templateId]/route.ts`
- Modify: `frontend/src/app/api/mockup-sets/[id]/route.ts`

**Context:** The template upload route needs to support two modes: (1) linking an existing TemplateImage via `templateImageId`, and (2) quick-upload that creates a TemplateImage + MockupTemplate in one step. The set GET route needs to include TemplateImage data. Delete becomes archive.

**Step 1: Update the template creation route**

Modify `frontend/src/app/api/mockup-sets/[id]/templates/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, handleAuthError } from '@/lib/server/auth'
import { saveUpload } from '@/lib/server/storage'
import { generateThumbnail } from '@/lib/server/thumbnails'

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireAuth()
    const { id: setId } = await params

    const set = await prisma.mockupSet.findFirst({ where: { id: setId, userId } })
    if (!set) {
      return NextResponse.json({ error: 'Set not found' }, { status: 404 })
    }

    const contentType = req.headers.get('content-type') || ''
    const count = await prisma.mockupTemplate.count({
      where: { mockupSetId: set.id, archivedAt: null },
    })

    if (contentType.includes('application/json')) {
      // Mode 1: Link existing TemplateImage
      const body = await req.json()
      const { templateImageId } = body

      const templateImage = await prisma.templateImage.findFirst({
        where: {
          id: templateImageId,
          archivedAt: null,
          OR: [{ userId }, { userId: null }],
        },
      })
      if (!templateImage) {
        return NextResponse.json({ error: 'Template image not found' }, { status: 404 })
      }

      const template = await prisma.mockupTemplate.create({
        data: {
          mockupSetId: set.id,
          templateImageId: templateImage.id,
          name: body.name || templateImage.name,
          overlayConfig: templateImage.defaultOverlayConfig ?? undefined,
          sortOrder: count,
        },
        include: { templateImage: true },
      })
      return NextResponse.json(template, { status: 201 })
    }

    // Mode 2: Quick upload — create TemplateImage + MockupTemplate
    const formData = await req.formData()
    const file = formData.get('image') as File | null
    if (!file) {
      return NextResponse.json({ error: 'Image file required' }, { status: 400 })
    }

    const imagePath = await saveUpload(file, `templates/${set.id}`)
    let thumbnailPath: string | null = null
    try {
      thumbnailPath = await generateThumbnail(UPLOAD_DIR, imagePath)
    } catch { /* lazy fallback */ }

    const name = (formData.get('name') as string) || file.name.replace(/\.[^.]+$/, '')

    const templateImage = await prisma.templateImage.create({
      data: { userId, name, imagePath, thumbnailPath },
    })

    const template = await prisma.mockupTemplate.create({
      data: {
        mockupSetId: set.id,
        templateImageId: templateImage.id,
        name,
        originalImagePath: imagePath,
        sortOrder: count,
      },
      include: { templateImage: true },
    })
    return NextResponse.json(template, { status: 201 })
  } catch (err) {
    return handleAuthError(err)
  }
}
```

**Step 2: Update template PATCH/DELETE**

Modify `frontend/src/app/api/mockup-sets/[id]/templates/[templateId]/route.ts`:

Change the DELETE handler to archive instead of hard delete:

```typescript
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const userId = await requireAuth()
    const { id: setId, templateId } = await params

    const set = await prisma.mockupSet.findFirst({ where: { id: setId, userId } })
    if (!set) {
      return NextResponse.json({ error: 'Set not found' }, { status: 404 })
    }

    const result = await prisma.mockupTemplate.updateMany({
      where: { id: templateId, mockupSetId: set.id, archivedAt: null },
      data: { archivedAt: new Date() },
    })

    if (result.count === 0) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleAuthError(err)
  }
}
```

Remove the `deleteFile` import and call from the DELETE handler (we no longer delete files).

**Step 3: Update set GET route to include TemplateImage**

In `frontend/src/app/api/mockup-sets/[id]/route.ts`, update the GET handler's include:

```typescript
const set = await prisma.mockupSet.findFirst({
  where: { id, userId },
  include: {
    templates: {
      where: { archivedAt: null },
      orderBy: { sortOrder: 'asc' },
      include: { templateImage: true },
    },
  },
})
```

**Step 4: Verify and commit**

Run:
```bash
cd frontend && npx tsc --noEmit
```

```bash
git add frontend/src/app/api/mockup-sets/
git commit -m "feat: set template routes support library linking and archive"
```

---

### Task 8: Update Batch Render Route

**Files:**
- Modify: `frontend/src/app/api/render/batch/route.ts`

**Context:** The batch render route currently reads `template.originalImagePath`. It needs to fall back to `template.templateImage.imagePath` (and eventually only use that). Also needs to include templateImage in the query.

**Step 1: Update the batch render query and processRender**

In the set query, add the templateImage include:

```typescript
const set = await prisma.mockupSet.findFirst({
  where: { id: mockupSetId, userId },
  include: {
    templates: {
      where: { archivedAt: null },
      orderBy: { sortOrder: 'asc' },
      include: { templateImage: true },
    },
  },
})
```

In the `processRender` function, update the image path resolution to prefer templateImage:

```typescript
const imagePath = template.templateImage?.imagePath || template.originalImagePath
const templateImagePath = getUploadPath(imagePath!)
```

Also update the mask path logic similarly:

```typescript
const maskPath = template.templateImage?.defaultMaskPath || imagePath!.replace(/\.[^.]+$/, '_mask.png')
```

**Step 2: Verify and commit**

Run:
```bash
cd frontend && npx tsc --noEmit
```

```bash
git add frontend/src/app/api/render/batch/route.ts
git commit -m "feat: batch render reads image path from TemplateImage"
```

---

### Task 9: Update Frontend API Client

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Context:** Add new API methods for template image library operations.

**Step 1: Add template image methods to the API client**

Add to `frontend/src/lib/api.ts`:

```typescript
  // Template Image Library
  getTemplateImages: (page = 1) => request(`/api/template-images?page=${page}`),
  uploadTemplateImage: (file: File, name?: string) => {
    const form = new FormData()
    form.append('image', file)
    if (name) form.append('name', name)
    return fetch('/api/template-images', {
      method: 'POST',
      credentials: 'include',
      body: form,
    }).then((r) => r.json())
  },
  getTemplateImage: (id: string) => request(`/api/template-images/${id}`),
  updateTemplateImage: (id: string, data: { name?: string; defaultOverlayConfig?: unknown; defaultMaskPath?: string }) =>
    request(`/api/template-images/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  archiveTemplateImage: (id: string) =>
    request(`/api/template-images/${id}`, { method: 'DELETE' }),

  // Site-wide Templates
  getSiteTemplates: (page = 1, search?: string) =>
    request(`/api/template-images/site?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  uploadSiteTemplate: (file: File, name?: string) => {
    const form = new FormData()
    form.append('image', file)
    if (name) form.append('name', name)
    return fetch('/api/template-images/site', {
      method: 'POST',
      credentials: 'include',
      body: form,
    }).then((r) => r.json())
  },
  updateSiteTemplate: (id: string, data: { name?: string; defaultOverlayConfig?: unknown }) =>
    request(`/api/template-images/site/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  archiveSiteTemplate: (id: string) =>
    request(`/api/template-images/site/${id}`, { method: 'DELETE' }),

  // Add template to set from library
  addTemplateToSet: (setId: string, templateImageId: string, name?: string) =>
    request(`/api/mockup-sets/${setId}/templates`, {
      method: 'POST',
      body: JSON.stringify({ templateImageId, name }),
    }),
```

Also update the existing `uploadTemplate` to include the `Content-Type` header implicitly (FormData already does this, no change needed).

**Step 2: Verify and commit**

Run:
```bash
cd frontend && npx tsc --noEmit
```

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: API client methods for template library"
```

---

### Task 10: Personal Library Page

**Files:**
- Create: `frontend/src/app/(app)/library/page.tsx`

**Context:** Grid of user's template images with thumbnails, upload, rename, archive, add-to-set. Shows set count and render count per image. Reference the designs page pattern at `frontend/src/app/(app)/designs/page.tsx`.

**Step 1: Create the library page**

Create `frontend/src/app/(app)/library/page.tsx`:

```tsx
'use client'
import { useEffect, useState, useRef } from 'react'
import { api } from '@/lib/api'
import { Upload, Trash2, Plus, Pencil, Check, X } from 'lucide-react'

interface TemplateImageItem {
  id: string
  name: string
  imagePath: string
  thumbnailPath: string | null
  setCount: number
  renderCount: number
  createdAt: string
}

interface SetOption {
  id: string
  name: string
}

export default function LibraryPage() {
  const [images, setImages] = useState<TemplateImageItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [sets, setSets] = useState<SetOption[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [addToSetId, setAddToSetId] = useState<string | null>(null)
  const [selectedSetId, setSelectedSetId] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const loadImages = (p = page) => {
    api.getTemplateImages(p).then((data: { images: TemplateImageItem[]; total: number }) => {
      setImages(data.images)
      setTotal(data.total)
    })
  }

  useEffect(() => {
    loadImages()
    api.getSets().then((data: SetOption[]) => setSets(data))
  }, [page])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    for (const file of Array.from(files)) {
      await api.uploadTemplateImage(file)
    }
    loadImages()
    e.target.value = ''
  }

  const handleRename = async (id: string) => {
    const trimmed = editName.trim()
    if (!trimmed) return
    await api.updateTemplateImage(id, { name: trimmed })
    setEditingId(null)
    loadImages()
  }

  const handleArchive = async (id: string) => {
    if (!confirm('Archive this template? It will be removed from all sets but renders will be preserved.')) return
    await api.archiveTemplateImage(id)
    loadImages()
  }

  const handleAddToSet = async (imageId: string) => {
    if (!selectedSetId) return
    await api.addTemplateToSet(selectedSetId, imageId)
    setAddToSetId(null)
    setSelectedSetId('')
    loadImages()
  }

  const getThumbnailUrl = (img: TemplateImageItem) =>
    img.thumbnailPath ? `/uploads/${img.thumbnailPath}` : `/api/thumbnails/${img.imagePath}`

  const totalPages = Math.ceil(total / 24)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">My Library</h1>
          <p className="text-gray-500 text-sm">{total} template{total !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => fileInput.current?.click()}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700">
          <Upload size={18} /> Upload
        </button>
        <input ref={fileInput} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
      </div>

      {images.length === 0 ? (
        <div className="text-center text-gray-500 py-16">
          <p className="text-lg">Your library is empty</p>
          <p className="text-sm">Upload product photos to build your template library</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {images.map((img) => (
            <div key={img.id} className="group relative rounded-xl border bg-white overflow-hidden">
              <div className="aspect-square">
                <img src={getThumbnailUrl(img)} alt={img.name}
                  className="w-full h-full object-cover" loading="lazy" />
              </div>
              <div className="p-3">
                {editingId === img.id ? (
                  <div className="flex items-center gap-1">
                    <input type="text" value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(img.id)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      className="text-sm border rounded px-1 py-0.5 w-full" autoFocus />
                    <button onClick={() => handleRename(img.id)} className="text-green-600"><Check size={14} /></button>
                    <button onClick={() => setEditingId(null)} className="text-gray-400"><X size={14} /></button>
                  </div>
                ) : (
                  <p className="text-sm font-medium truncate">{img.name}</p>
                )}
                <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                  <span>{img.setCount} set{img.setCount !== 1 ? 's' : ''}</span>
                  <span>{img.renderCount} render{img.renderCount !== 1 ? 's' : ''}</span>
                </div>
              </div>

              {addToSetId === img.id ? (
                <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center p-4 gap-2">
                  <p className="text-sm font-medium">Add to set:</p>
                  <select value={selectedSetId} onChange={(e) => setSelectedSetId(e.target.value)}
                    className="rounded border px-2 py-1 text-sm w-full">
                    <option value="">Select a set...</option>
                    {sets.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button onClick={() => handleAddToSet(img.id)}
                      disabled={!selectedSetId}
                      className="px-3 py-1 text-sm bg-green-600 text-white rounded disabled:opacity-40">
                      Add
                    </button>
                    <button onClick={() => { setAddToSetId(null); setSelectedSetId('') }}
                      className="px-3 py-1 text-sm bg-gray-200 rounded">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="absolute top-2 right-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex gap-1">
                  <button onClick={() => { setAddToSetId(img.id); setSelectedSetId('') }}
                    className="rounded-full bg-white p-2 shadow hover:bg-green-50" title="Add to set">
                    <Plus size={14} className="text-green-600" />
                  </button>
                  <button onClick={() => { setEditingId(img.id); setEditName(img.name) }}
                    className="rounded-full bg-white p-2 shadow hover:bg-gray-100" title="Rename">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleArchive(img.id)}
                    className="rounded-full bg-white p-2 shadow hover:bg-red-50" title="Archive">
                    <Trash2 size={14} className="text-red-500" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: totalPages }, (_, i) => (
            <button key={i + 1} onClick={() => setPage(i + 1)}
              className={`px-3 py-1 rounded text-sm ${page === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Verify and commit**

Run:
```bash
cd frontend && npx tsc --noEmit
```

```bash
git add frontend/src/app/\(app\)/library/
git commit -m "feat: personal template library page"
```

---

### Task 11: Site-Wide Templates Page

**Files:**
- Create: `frontend/src/app/(app)/templates/page.tsx`

**Context:** Browse site-wide templates. All users see the catalog. Admin users get upload/rename/archive controls. Same grid layout as personal library. Add search.

**Step 1: Add an API method to check if user is admin**

Add to `frontend/src/lib/api.ts`:

```typescript
  me: () => request('/api/auth/me'),
```

This already exists. Ensure the auth `me` endpoint returns `isAdmin`. Update `frontend/src/app/api/auth/me/route.ts` to include `isAdmin` in the response:

```typescript
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: { id: true, email: true, name: true, isAdmin: true },
})
```

**Step 2: Create the site-wide templates page**

Create `frontend/src/app/(app)/templates/page.tsx`:

```tsx
'use client'
import { useEffect, useState, useRef } from 'react'
import { api } from '@/lib/api'
import { Upload, Trash2, Plus, Pencil, Check, X, Search } from 'lucide-react'

interface TemplateImageItem {
  id: string
  name: string
  imagePath: string
  thumbnailPath: string | null
  setCount: number
  createdAt: string
}

interface SetOption {
  id: string
  name: string
}

export default function SiteTemplatesPage() {
  const [images, setImages] = useState<TemplateImageItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [sets, setSets] = useState<SetOption[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [addToSetId, setAddToSetId] = useState<string | null>(null)
  const [selectedSetId, setSelectedSetId] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const loadImages = (p = page, s = search) => {
    api.getSiteTemplates(p, s).then((data: { images: TemplateImageItem[]; total: number }) => {
      setImages(data.images)
      setTotal(data.total)
    })
  }

  useEffect(() => {
    loadImages()
    api.getSets().then((data: SetOption[]) => setSets(data))
    api.me().then((user: { isAdmin?: boolean }) => setIsAdmin(!!user.isAdmin))
  }, [page, search])

  const handleSearch = () => {
    setPage(1)
    setSearch(searchInput)
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    for (const file of Array.from(files)) {
      await api.uploadSiteTemplate(file)
    }
    loadImages()
    e.target.value = ''
  }

  const handleRename = async (id: string) => {
    const trimmed = editName.trim()
    if (!trimmed) return
    await api.updateSiteTemplate(id, { name: trimmed })
    setEditingId(null)
    loadImages()
  }

  const handleArchive = async (id: string) => {
    if (!confirm('Archive this template?')) return
    await api.archiveSiteTemplate(id)
    loadImages()
  }

  const handleAddToSet = async (imageId: string) => {
    if (!selectedSetId) return
    await api.addTemplateToSet(selectedSetId, imageId)
    setAddToSetId(null)
    setSelectedSetId('')
    loadImages()
  }

  const getThumbnailUrl = (img: TemplateImageItem) =>
    img.thumbnailPath ? `/uploads/${img.thumbnailPath}` : `/api/thumbnails/${img.imagePath}`

  const totalPages = Math.ceil(total / 24)

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Templates</h1>
          <p className="text-gray-500 text-sm">{total} template{total !== 1 ? 's' : ''} available</p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center border rounded-lg overflow-hidden">
            <input type="text" value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search templates..."
              className="px-3 py-2 text-sm outline-none w-48" />
            <button onClick={handleSearch} className="px-3 py-2 bg-gray-100 hover:bg-gray-200">
              <Search size={16} />
            </button>
          </div>
          {isAdmin && (
            <>
              <button onClick={() => fileInput.current?.click()}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 text-sm">
                <Upload size={18} /> Upload
              </button>
              <input ref={fileInput} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
            </>
          )}
        </div>
      </div>

      {images.length === 0 ? (
        <div className="text-center text-gray-500 py-16">
          <p className="text-lg">{search ? 'No templates match your search' : 'No templates available yet'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {images.map((img) => (
            <div key={img.id} className="group relative rounded-xl border bg-white overflow-hidden">
              <div className="aspect-square">
                <img src={getThumbnailUrl(img)} alt={img.name}
                  className="w-full h-full object-cover" loading="lazy" />
              </div>
              <div className="p-3">
                {editingId === img.id ? (
                  <div className="flex items-center gap-1">
                    <input type="text" value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(img.id)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      className="text-sm border rounded px-1 py-0.5 w-full" autoFocus />
                    <button onClick={() => handleRename(img.id)} className="text-green-600"><Check size={14} /></button>
                    <button onClick={() => setEditingId(null)} className="text-gray-400"><X size={14} /></button>
                  </div>
                ) : (
                  <p className="text-sm font-medium truncate">{img.name}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  Used in {img.setCount} set{img.setCount !== 1 ? 's' : ''}
                </p>
              </div>

              {addToSetId === img.id ? (
                <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center p-4 gap-2">
                  <p className="text-sm font-medium">Add to set:</p>
                  <select value={selectedSetId} onChange={(e) => setSelectedSetId(e.target.value)}
                    className="rounded border px-2 py-1 text-sm w-full">
                    <option value="">Select a set...</option>
                    {sets.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button onClick={() => handleAddToSet(img.id)}
                      disabled={!selectedSetId}
                      className="px-3 py-1 text-sm bg-green-600 text-white rounded disabled:opacity-40">
                      Add
                    </button>
                    <button onClick={() => { setAddToSetId(null); setSelectedSetId('') }}
                      className="px-3 py-1 text-sm bg-gray-200 rounded">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="absolute top-2 right-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex gap-1">
                  <button onClick={() => { setAddToSetId(img.id); setSelectedSetId('') }}
                    className="rounded-full bg-white p-2 shadow hover:bg-green-50" title="Add to set">
                    <Plus size={14} className="text-green-600" />
                  </button>
                  {isAdmin && (
                    <>
                      <button onClick={() => { setEditingId(img.id); setEditName(img.name) }}
                        className="rounded-full bg-white p-2 shadow hover:bg-gray-100" title="Rename">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleArchive(img.id)}
                        className="rounded-full bg-white p-2 shadow hover:bg-red-50" title="Archive">
                        <Trash2 size={14} className="text-red-500" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: totalPages }, (_, i) => (
            <button key={i + 1} onClick={() => setPage(i + 1)}
              className={`px-3 py-1 rounded text-sm ${page === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 3: Verify and commit**

Run:
```bash
cd frontend && npx tsc --noEmit
```

```bash
git add frontend/src/app/\(app\)/templates/ frontend/src/app/api/auth/me/
git commit -m "feat: site-wide templates page with search and admin controls"
```

---

### Task 12: Template Picker Modal for Set Pages

**Files:**
- Create: `frontend/src/components/template-picker-modal.tsx`
- Modify: `frontend/src/app/(app)/sets/[id]/page.tsx`

**Context:** The set detail page needs an "Add Templates" button that opens a modal where users can browse their personal library and the site-wide library, select templates, and add them to the set.

**Step 1: Create the template picker modal**

Create `frontend/src/components/template-picker-modal.tsx`:

```tsx
'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { X, Check, Search } from 'lucide-react'

interface TemplateImageItem {
  id: string
  name: string
  imagePath: string
  thumbnailPath: string | null
  setCount: number
}

interface TemplatePickerModalProps {
  setId: string
  onClose: () => void
  onAdded: () => void
}

export function TemplatePickerModal({ setId, onClose, onAdded }: TemplatePickerModalProps) {
  const [tab, setTab] = useState<'personal' | 'site'>('personal')
  const [images, setImages] = useState<TemplateImageItem[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const loadImages = () => {
    const fetcher = tab === 'personal'
      ? api.getTemplateImages(page)
      : api.getSiteTemplates(page, search)
    fetcher.then((data: { images: TemplateImageItem[]; total: number }) => {
      setImages(data.images)
      setTotal(data.total)
    })
  }

  useEffect(() => {
    setPage(1)
    setSelected(new Set())
  }, [tab])

  useEffect(() => {
    loadImages()
  }, [tab, page, search])

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleAdd = async () => {
    setAdding(true)
    try {
      for (const imageId of selected) {
        await api.addTemplateToSet(setId, imageId)
      }
      onAdded()
      onClose()
    } finally {
      setAdding(false)
    }
  }

  const getThumbnailUrl = (img: TemplateImageItem) =>
    img.thumbnailPath ? `/uploads/${img.thumbnailPath}` : `/api/thumbnails/${img.imagePath}`

  const totalPages = Math.ceil(total / 24)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col m-4"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">Add Templates</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="flex items-center gap-4 px-4 pt-4">
          <div className="flex border rounded-lg overflow-hidden">
            <button onClick={() => setTab('personal')}
              className={`px-4 py-2 text-sm font-medium ${tab === 'personal' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-50'}`}>
              My Library
            </button>
            <button onClick={() => setTab('site')}
              className={`px-4 py-2 text-sm font-medium ${tab === 'site' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-50'}`}>
              Site Templates
            </button>
          </div>
          {tab === 'site' && (
            <div className="flex items-center border rounded-lg overflow-hidden flex-1">
              <input type="text" value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                placeholder="Search..."
                className="px-3 py-2 text-sm outline-none w-full" />
              <div className="px-3 py-2 text-gray-400"><Search size={16} /></div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {images.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              {tab === 'personal' ? 'Your library is empty. Upload templates first.' : 'No templates found.'}
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {images.map((img) => (
                <button key={img.id} onClick={() => toggleSelect(img.id)}
                  className={`relative rounded-lg border-2 overflow-hidden transition-colors ${
                    selected.has(img.id) ? 'border-blue-500' : 'border-transparent hover:border-gray-300'
                  }`}>
                  <div className="aspect-square">
                    <img src={getThumbnailUrl(img)} alt={img.name}
                      className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  <p className="text-xs truncate p-1">{img.name}</p>
                  {selected.has(img.id) && (
                    <div className="absolute top-1 right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                      <Check size={14} className="text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i + 1} onClick={() => setPage(i + 1)}
                  className={`px-2 py-1 rounded text-xs ${page === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-4 border-t">
          <p className="text-sm text-gray-500">{selected.size} selected</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200">
              Cancel
            </button>
            <button onClick={handleAdd} disabled={selected.size === 0 || adding}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40">
              {adding ? 'Adding...' : `Add ${selected.size} Template${selected.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Update set detail page**

In `frontend/src/app/(app)/sets/[id]/page.tsx`, add import and state for the modal:

```tsx
import { TemplatePickerModal } from '@/components/template-picker-modal'
```

Add state:

```tsx
const [showPicker, setShowPicker] = useState(false)
```

Change the "Add Photos" button to "Add Templates":

```tsx
<button onClick={() => setShowPicker(true)}
  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 text-sm sm:text-base">
  <Upload size={18} /> Add Templates
</button>
```

Remove the hidden file input and `handleUpload` function. Add the modal at the end of the JSX:

```tsx
{showPicker && (
  <TemplatePickerModal
    setId={id}
    onClose={() => setShowPicker(false)}
    onAdded={() => api.getSet(id).then(setSet)}
  />
)}
```

**Step 3: Update template card to use thumbnails**

In the `TemplateCard` component, change the img src to use thumbnails. The template now has `templateImage` included from the API. Update the interface:

```tsx
interface Template {
  id: string
  name: string
  originalImagePath: string | null
  overlayConfig: TemplateOverlayConfig | null
  sortOrder: number
  isFavorite?: boolean
  templateImage?: {
    id: string
    imagePath: string
    thumbnailPath: string | null
  }
}
```

Update the img src in TemplateCard:

```tsx
const imagePath = t.templateImage?.imagePath || t.originalImagePath
const thumbnailPath = t.templateImage?.thumbnailPath
const thumbnailUrl = thumbnailPath ? `/uploads/${thumbnailPath}` : imagePath ? `/api/thumbnails/${imagePath}` : ''
```

Use `thumbnailUrl` for the card image and the full image URL (`/uploads/${imagePath}`) for the SVG overlay viewBox sizing.

**Step 4: Verify and commit**

Run:
```bash
cd frontend && npx tsc --noEmit
```

```bash
git add frontend/src/components/template-picker-modal.tsx frontend/src/app/\(app\)/sets/\[id\]/page.tsx
git commit -m "feat: template picker modal and thumbnail support in set detail"
```

---

### Task 13: Update Sidebar Navigation

**Files:**
- Modify: `frontend/src/components/sidebar.tsx`

**Context:** Add "Library" and "Templates" links to the sidebar navigation.

**Step 1: Update sidebar**

In `frontend/src/components/sidebar.tsx`, add new nav items. Import the needed icons:

```tsx
import { LayoutDashboard, FolderOpen, Palette, Image, Heart, BookOpen, Library } from 'lucide-react'
```

Add two new entries to the navigation items array (after "My Sets" and before "My Designs"):

```tsx
{ href: '/templates', label: 'Templates', icon: BookOpen },
{ href: '/library', label: 'My Library', icon: Library },
```

If `Library` icon doesn't exist in lucide-react, use `ImageIcon` or `Images` instead.

**Step 2: Verify and commit**

Run:
```bash
cd frontend && npx tsc --noEmit
```

```bash
git add frontend/src/components/sidebar.tsx
git commit -m "feat: add Templates and Library links to sidebar"
```

---

### Task 14: Update Template Editor to Read from TemplateImage

**Files:**
- Modify: `frontend/src/app/(app)/sets/[id]/templates/[templateId]/edit/page.tsx`

**Context:** The template editor currently reads `template.originalImagePath` for the image URL. It needs to use `template.templateImage.imagePath` instead. Also add a "Save as default" button that copies the current overlay config to the TemplateImage.

**Step 1: Update the editor page**

The editor fetches the template via `api.getSet(setId)` and finds it in the list. The template now includes `templateImage`. Update the state type:

```tsx
const [template, setTemplate] = useState<{
  id: string; name: string; originalImagePath: string | null;
  overlayConfig: OverlayConfig | null;
  templateImage?: { id: string; imagePath: string; thumbnailPath: string | null }
} | null>(null)
```

Update all references to `template.originalImagePath` to prefer `template.templateImage?.imagePath`:

```tsx
const imageUrl = template.templateImage
  ? `/uploads/${template.templateImage.imagePath}`
  : `/uploads/${template.originalImagePath}`
```

Use `imageUrl` in both `MockupCanvas` and `MaskEditor` props.

Add a "Save as Default" button next to the Save button in the toolbar area:

```tsx
const handleSaveAsDefault = async () => {
  if (!config || !template?.templateImage) return
  await api.updateTemplateImage(template.templateImage.id, {
    defaultOverlayConfig: {
      ...config,
      displacementIntensity: displacement,
      transparency,
      curvature,
      curveAxis,
      mode,
    },
  })
}
```

Add the button after the save button:

```tsx
{template?.templateImage && (
  <button onClick={handleSaveAsDefault}
    className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border rounded">
    Save as Default
  </button>
)}
```

**Step 2: Verify and commit**

Run:
```bash
cd frontend && npx tsc --noEmit
```

```bash
git add frontend/src/app/\(app\)/sets/\[id\]/templates/
git commit -m "feat: template editor reads from TemplateImage, save as default"
```

---

### Task 15: Update Apply Page and Other Image References

**Files:**
- Modify: `frontend/src/app/(app)/sets/[id]/apply/page.tsx`
- Modify: `frontend/src/app/(app)/sets/page.tsx`
- Modify: `frontend/src/app/(app)/renders/page.tsx`

**Context:** All pages that display template images need to prefer `templateImage.thumbnailPath` or `templateImage.imagePath` over `originalImagePath`. Use thumbnails in grid views.

**Step 1: Update the apply page**

In the apply page, template references need updating. The step where templates are displayed should use thumbnail URLs. Update the Template type to include `templateImage` and use the thumbnail URL helper pattern.

**Step 2: Update sets list page**

In `frontend/src/app/(app)/sets/page.tsx`, the set cards show the first 3 template images. Update to use thumbnails:

```tsx
const imagePath = t.templateImage?.imagePath || t.originalImagePath
const thumbPath = t.templateImage?.thumbnailPath
const src = thumbPath ? `/uploads/${thumbPath}` : imagePath ? `/api/thumbnails/${imagePath}` : ''
```

**Step 3: Update renders page**

If the renders page shows template images, update those references similarly.

**Step 4: Verify and commit**

Run:
```bash
cd frontend && npx tsc --noEmit
```

```bash
git add frontend/src/app/
git commit -m "feat: use thumbnails across all pages"
```

---

### Task 16: Tighten Schema Constraints

**Files:**
- Modify: `frontend/prisma/schema.prisma`

**Context:** After migration is complete and all code reads from TemplateImage, make `templateImageId` non-nullable and remove `originalImagePath`.

**Step 1: Update the schema**

```prisma
model MockupTemplate {
  id              String          @id @default(uuid())
  mockupSetId     String          @map("mockup_set_id")
  templateImageId String          @map("template_image_id")
  name            String
  overlayConfig   Json?           @map("overlay_config")
  sortOrder       Int             @default(0) @map("sort_order")
  isFavorite      Boolean         @default(false) @map("is_favorite")
  archivedAt      DateTime?       @map("archived_at")
  mockupSet       MockupSet       @relation(fields: [mockupSetId], references: [id], onDelete: Cascade)
  templateImage   TemplateImage   @relation(fields: [templateImageId], references: [id])
  renderedMockups RenderedMockup[]

  @@map("mockup_templates")
}
```

Note: `originalImagePath` is removed, `templateImageId` is now required (non-nullable), `templateImage` relation loses the `?`.

**Step 2: Run migration**

```bash
cd frontend && npx prisma migrate dev --name tighten_template_image_constraint
```

**Step 3: Remove any remaining references to `originalImagePath`**

Search the codebase for `originalImagePath` and remove/update any remaining references. All code should now use `templateImage.imagePath`.

**Step 4: Verify and commit**

Run:
```bash
cd frontend && npx tsc --noEmit
```

```bash
git add frontend/prisma/ frontend/src/
git commit -m "feat: make templateImageId required, remove originalImagePath"
```

---

### Task 17: TypeScript Check and Integration Verification

**Files:** None new — verification only.

**Step 1: Full TypeScript check**

Run:
```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors.

**Step 2: Run any existing tests**

Run:
```bash
cd frontend && npm run test 2>/dev/null || echo "No frontend tests configured"
cd processing && .venv/bin/python -m pytest 2>/dev/null || echo "No processing tests"
```

**Step 3: Test Docker build**

Run:
```bash
docker compose build frontend
```

Expected: Builds successfully with sharp included.

**Step 4: Manual verification checklist**

- [ ] Can upload a template image to personal library
- [ ] Can browse site-wide templates
- [ ] Can add template from library to a set
- [ ] Template picker modal works from set detail page
- [ ] Thumbnails load in grid views
- [ ] Lazy thumbnail generation works for old images
- [ ] Archive template removes from library and sets
- [ ] Renders still display for archived templates
- [ ] Template editor reads image from TemplateImage
- [ ] "Save as Default" copies config to TemplateImage
- [ ] Batch render works with new data model
- [ ] Admin can upload/manage site-wide templates
- [ ] Non-admin can only browse site-wide templates
