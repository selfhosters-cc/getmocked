# Template Tags Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add free-form tagging to template images with filtering, autocomplete, and admin moderation.

**Architecture:** Many-to-many Tag ↔ TemplateImage via join table. Global shared tag pool. Tag names lowercased and unique. Soft-delete for admin moderation. AND-logic multi-tag filtering on list endpoints.

**Tech Stack:** Prisma ORM, Next.js 14 API routes, React, Tailwind CSS, Vitest

---

### Task 1: Schema — Add Tag and TemplateImageTag models

**Files:**
- Modify: `frontend/prisma/schema.prisma`

**Step 1: Add Tag and TemplateImageTag models to schema**

Add after the TemplateImage model:

```prisma
model Tag {
  id         String             @id @default(uuid())
  name       String             @unique
  archivedAt DateTime?          @map("archived_at")
  createdAt  DateTime           @default(now()) @map("created_at")
  images     TemplateImageTag[]
  @@map("tags")
}

model TemplateImageTag {
  templateImageId String        @map("template_image_id")
  tagId           String        @map("tag_id")
  templateImage   TemplateImage @relation(fields: [templateImageId], references: [id], onDelete: Cascade)
  tag             Tag           @relation(fields: [tagId], references: [id], onDelete: Cascade)
  @@id([templateImageId, tagId])
  @@map("template_image_tags")
}
```

Add the `tags` relation to the existing TemplateImage model:

```prisma
  tags             TemplateImageTag[]
```

This line goes after the `templates` relation line in the TemplateImage model.

**Step 2: Push schema to database**

Run: `cd frontend && DATABASE_URL=postgresql://getmocked:getmocked@192.168.5.3:5432/getmocked_dev npx prisma db push`
Expected: Schema pushed successfully, no data loss warnings.

**Step 3: Generate Prisma client**

Run: `cd frontend && npx prisma generate`
Expected: Prisma client generated.

**Step 4: Commit**

```bash
git add frontend/prisma/schema.prisma
git commit -m "feat: add Tag and TemplateImageTag schema models"
```

---

### Task 2: API — Tag listing and popular tags endpoints

**Files:**
- Create: `frontend/src/app/api/tags/route.ts`
- Create: `frontend/src/app/api/tags/popular/route.ts`
- Create: `frontend/src/__tests__/api/tags.test.ts`

**Step 1: Write failing tests for tag endpoints**

```typescript
// frontend/src/__tests__/api/tags.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ cookies: vi.fn() }))

const mockFindMany = vi.fn()
const mockVerifyToken = vi.fn()

vi.mock('@/lib/server/prisma', () => ({
  prisma: {
    tag: { findMany: (...args: unknown[]) => mockFindMany(...args) },
  },
}))
vi.mock('@/lib/server/jwt', () => ({
  verifyToken: (...args: unknown[]) => mockVerifyToken(...args),
}))

import { cookies } from 'next/headers'

describe('GET /api/tags', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns tags with usage counts', async () => {
    ;(cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      get: () => ({ value: 'token' }),
    })
    mockVerifyToken.mockReturnValue({ userId: 'user-1' })
    mockFindMany.mockResolvedValue([
      { id: 'tag-1', name: 'bella canvas', _count: { images: 5 }, createdAt: new Date() },
      { id: 'tag-2', name: 'mug', _count: { images: 3 }, createdAt: new Date() },
    ])

    const { GET } = await import('@/app/api/tags/route')
    const req = new Request('http://localhost/api/tags')
    const res = await GET(req as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.tags).toHaveLength(2)
    expect(body.tags[0]).toHaveProperty('usageCount')
  })

  it('filters by search param', async () => {
    ;(cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      get: () => ({ value: 'token' }),
    })
    mockVerifyToken.mockReturnValue({ userId: 'user-1' })
    mockFindMany.mockResolvedValue([
      { id: 'tag-1', name: 'bella canvas', _count: { images: 5 }, createdAt: new Date() },
    ])

    const { GET } = await import('@/app/api/tags/route')
    const req = new Request('http://localhost/api/tags?search=bella')
    const res = await GET(req as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.tags).toHaveLength(1)
  })

  it('returns 401 when not authenticated', async () => {
    ;(cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      get: () => undefined,
    })

    const { GET } = await import('@/app/api/tags/route')
    const req = new Request('http://localhost/api/tags')
    const res = await GET(req as any)

    expect(res.status).toBe(401)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/__tests__/api/tags.test.ts`
Expected: FAIL — module not found

**Step 3: Implement GET /api/tags**

```typescript
// frontend/src/app/api/tags/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, handleAuthError } from '@/lib/server/auth'

export async function GET(req: NextRequest) {
  try {
    await requireAuth()
    const search = req.nextUrl.searchParams.get('search') || ''

    const where: Record<string, unknown> = { archivedAt: null }
    if (search) {
      where.name = { contains: search.toLowerCase(), mode: 'insensitive' }
    }

    const tags = await prisma.tag.findMany({
      where,
      include: { _count: { select: { images: true } } },
      orderBy: { name: 'asc' },
      take: 50,
    })

    return NextResponse.json({
      tags: tags.map((t) => ({
        id: t.id,
        name: t.name,
        usageCount: t._count.images,
        createdAt: t.createdAt,
      })),
    })
  } catch (err) {
    return handleAuthError(err)
  }
}
```

**Step 4: Implement GET /api/tags/popular**

```typescript
// frontend/src/app/api/tags/popular/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, handleAuthError } from '@/lib/server/auth'

export async function GET() {
  try {
    await requireAuth()

    const tags = await prisma.tag.findMany({
      where: { archivedAt: null },
      include: { _count: { select: { images: true } } },
      orderBy: { images: { _count: 'desc' } },
      take: 10,
    })

    return NextResponse.json({
      tags: tags
        .filter((t) => t._count.images > 0)
        .map((t) => ({
          id: t.id,
          name: t.name,
          usageCount: t._count.images,
        })),
    })
  } catch (err) {
    return handleAuthError(err)
  }
}
```

**Step 5: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/__tests__/api/tags.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add frontend/src/app/api/tags/ frontend/src/__tests__/api/tags.test.ts
git commit -m "feat: add GET /api/tags and /api/tags/popular endpoints"
```

---

### Task 3: API — Admin tag moderation endpoint

**Files:**
- Create: `frontend/src/app/api/tags/[id]/route.ts`
- Create: `frontend/src/__tests__/api/tags-admin.test.ts`

**Step 1: Write failing tests**

```typescript
// frontend/src/__tests__/api/tags-admin.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ cookies: vi.fn() }))

const mockFindUnique = vi.fn()
const mockUpdate = vi.fn()
const mockVerifyToken = vi.fn()

vi.mock('@/lib/server/prisma', () => ({
  prisma: {
    tag: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    user: { findUnique: vi.fn().mockResolvedValue({ isAdmin: true }) },
  },
}))
vi.mock('@/lib/server/jwt', () => ({
  verifyToken: (...args: unknown[]) => mockVerifyToken(...args),
}))

import { cookies } from 'next/headers'

describe('PATCH /api/tags/[id]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('allows admin to archive a tag', async () => {
    ;(cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      get: () => ({ value: 'token' }),
    })
    mockVerifyToken.mockReturnValue({ userId: 'admin-1' })
    mockFindUnique.mockResolvedValue({ id: 'tag-1', name: 'bad-tag' })
    mockUpdate.mockResolvedValue({ id: 'tag-1', name: 'bad-tag', archivedAt: new Date() })

    const { PATCH } = await import('@/app/api/tags/[id]/route')
    const req = new Request('http://localhost/api/tags/tag-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archive: true }),
    })
    const res = await PATCH(req as any, { params: Promise.resolve({ id: 'tag-1' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('allows admin to rename a tag', async () => {
    ;(cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      get: () => ({ value: 'token' }),
    })
    mockVerifyToken.mockReturnValue({ userId: 'admin-1' })
    mockFindUnique.mockResolvedValue({ id: 'tag-1', name: 'old-name' })
    mockUpdate.mockResolvedValue({ id: 'tag-1', name: 'new-name' })

    const { PATCH } = await import('@/app/api/tags/[id]/route')
    const req = new Request('http://localhost/api/tags/tag-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Name' }),
    })
    const res = await PATCH(req as any, { params: Promise.resolve({ id: 'tag-1' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/__tests__/api/tags-admin.test.ts`
Expected: FAIL

**Step 3: Implement PATCH /api/tags/[id]**

```typescript
// frontend/src/app/api/tags/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { requireAdmin, handleAuthError } from '@/lib/server/auth'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireAdmin()
    const { id } = await params
    const body = await req.json()

    const tag = await prisma.tag.findUnique({ where: { id } })
    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (body.name) data.name = body.name.toLowerCase().trim()
    if (body.archive) data.archivedAt = new Date()
    if (body.archive === false) data.archivedAt = null

    const updated = await prisma.tag.update({ where: { id }, data })
    return NextResponse.json(updated)
  } catch (err) {
    return handleAuthError(err)
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/__tests__/api/tags-admin.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/app/api/tags/[id]/ frontend/src/__tests__/api/tags-admin.test.ts
git commit -m "feat: add admin tag moderation endpoint (rename, archive)"
```

---

### Task 4: API — Add/remove tags on template images

**Files:**
- Create: `frontend/src/app/api/template-images/[id]/tags/route.ts`
- Create: `frontend/src/__tests__/api/template-image-tags.test.ts`

**Step 1: Write failing tests**

```typescript
// frontend/src/__tests__/api/template-image-tags.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ cookies: vi.fn() }))

const mockFindFirst = vi.fn()
const mockTagUpsert = vi.fn()
const mockJoinCreate = vi.fn()
const mockJoinDelete = vi.fn()
const mockVerifyToken = vi.fn()

vi.mock('@/lib/server/prisma', () => ({
  prisma: {
    templateImage: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
    tag: { upsert: (...args: unknown[]) => mockTagUpsert(...args) },
    templateImageTag: {
      create: (...args: unknown[]) => mockJoinCreate(...args),
      delete: (...args: unknown[]) => mockJoinDelete(...args),
    },
  },
}))
vi.mock('@/lib/server/jwt', () => ({
  verifyToken: (...args: unknown[]) => mockVerifyToken(...args),
}))

import { cookies } from 'next/headers'

describe('POST /api/template-images/[id]/tags', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('adds a tag to a template image', async () => {
    ;(cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      get: () => ({ value: 'token' }),
    })
    mockVerifyToken.mockReturnValue({ userId: 'user-1' })
    mockFindFirst.mockResolvedValue({ id: 'img-1', userId: 'user-1' })
    mockTagUpsert.mockResolvedValue({ id: 'tag-1', name: 'bella canvas' })
    mockJoinCreate.mockResolvedValue({ templateImageId: 'img-1', tagId: 'tag-1' })

    const { POST } = await import('@/app/api/template-images/[id]/tags/route')
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Bella Canvas' }),
    })
    const res = await POST(req as any, { params: Promise.resolve({ id: 'img-1' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.tag.name).toBe('bella canvas')
  })

  it('returns 404 for image not owned by user', async () => {
    ;(cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      get: () => ({ value: 'token' }),
    })
    mockVerifyToken.mockReturnValue({ userId: 'user-1' })
    mockFindFirst.mockResolvedValue(null)

    const { POST } = await import('@/app/api/template-images/[id]/tags/route')
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'test' }),
    })
    const res = await POST(req as any, { params: Promise.resolve({ id: 'img-1' }) })

    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/template-images/[id]/tags/[tagId]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('removes a tag from a template image', async () => {
    ;(cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      get: () => ({ value: 'token' }),
    })
    mockVerifyToken.mockReturnValue({ userId: 'user-1' })
    mockFindFirst.mockResolvedValue({ id: 'img-1', userId: 'user-1' })
    mockJoinDelete.mockResolvedValue({})

    const { DELETE } = await import('@/app/api/template-images/[id]/tags/[tagId]/route')
    const req = new Request('http://localhost', { method: 'DELETE' })
    const res = await DELETE(req as any, { params: Promise.resolve({ id: 'img-1', tagId: 'tag-1' }) })

    expect(res.status).toBe(200)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/__tests__/api/template-image-tags.test.ts`
Expected: FAIL

**Step 3: Implement POST /api/template-images/[id]/tags**

```typescript
// frontend/src/app/api/template-images/[id]/tags/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, handleAuthError } from '@/lib/server/auth'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const userId = await requireAuth()
    const { id } = await params
    const body = await req.json()
    const name = (body.name || '').toLowerCase().trim()

    if (!name) {
      return NextResponse.json({ error: 'Tag name required' }, { status: 400 })
    }

    const image = await prisma.templateImage.findFirst({
      where: { id, archivedAt: null, OR: [{ userId }, { userId: null }] },
    })
    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    const tag = await prisma.tag.upsert({
      where: { name },
      create: { name },
      update: {},
    })

    await prisma.templateImageTag.create({
      data: { templateImageId: id, tagId: tag.id },
    }).catch(() => {
      // Ignore duplicate — tag already on this image
    })

    return NextResponse.json({ tag: { id: tag.id, name: tag.name } })
  } catch (err) {
    return handleAuthError(err)
  }
}
```

**Step 4: Implement DELETE /api/template-images/[id]/tags/[tagId]**

```typescript
// frontend/src/app/api/template-images/[id]/tags/[tagId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, handleAuthError } from '@/lib/server/auth'

type Params = { params: Promise<{ id: string; tagId: string }> }

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const userId = await requireAuth()
    const { id, tagId } = await params

    const image = await prisma.templateImage.findFirst({
      where: { id, archivedAt: null, OR: [{ userId }, { userId: null }] },
    })
    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    await prisma.templateImageTag.delete({
      where: { templateImageId_tagId: { templateImageId: id, tagId } },
    }).catch(() => {
      // Already removed
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    return handleAuthError(err)
  }
}
```

**Step 5: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/__tests__/api/template-image-tags.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add frontend/src/app/api/template-images/[id]/tags/ frontend/src/__tests__/api/template-image-tags.test.ts
git commit -m "feat: add/remove tags on template images"
```

---

### Task 5: API — Add tag filtering and tag data to list endpoints

**Files:**
- Modify: `frontend/src/app/api/template-images/route.ts`
- Modify: `frontend/src/app/api/template-images/site/route.ts`

**Step 1: Update personal library GET to include tags and support tag filtering**

In `frontend/src/app/api/template-images/route.ts`, update the GET handler:

1. Extract tags query param: `const tagsParam = req.nextUrl.searchParams.get('tags') || ''`
2. Parse tag names: `const tagNames = tagsParam ? tagsParam.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : []`
3. Add to `where` clause when tagNames is non-empty:
   ```typescript
   if (tagNames.length > 0) {
     where.tags = { some: { tag: { name: { in: tagNames }, archivedAt: null } } }
   }
   ```
   For AND logic (must have ALL tags), use:
   ```typescript
   if (tagNames.length > 0) {
     where.AND = tagNames.map(name => ({
       tags: { some: { tag: { name, archivedAt: null } } }
     }))
   }
   ```
4. Add `tags` to the include:
   ```typescript
   include: {
     _count: { select: { templates: true } },
     tags: { include: { tag: { select: { id: true, name: true } } } },
   }
   ```
5. Map tags in the response:
   ```typescript
   tags: img.tags.map((t: any) => ({ id: t.tag.id, name: t.tag.name })),
   ```

Also add `search` query param support (library currently lacks it):
```typescript
const search = req.nextUrl.searchParams.get('search') || ''
if (search) {
  where.name = { contains: search, mode: 'insensitive' }
}
```

**Step 2: Update site templates GET with the same changes**

In `frontend/src/app/api/template-images/site/route.ts`, apply the same:
1. Extract and parse `tags` query param
2. Add AND filter to `where` clause
3. Add `tags` to include
4. Map tags in response

**Step 3: Run type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add frontend/src/app/api/template-images/route.ts frontend/src/app/api/template-images/site/route.ts
git commit -m "feat: add tag filtering and tag data to template image list endpoints"
```

---

### Task 6: API client — Add tag methods

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Step 1: Add tag API methods and update existing methods**

Add to the `api` object in `frontend/src/lib/api.ts`:

```typescript
  // Tags
  getTags: (search?: string) =>
    request(`/api/tags${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  getPopularTags: () => request('/api/tags/popular'),
  updateTag: (id: string, data: { name?: string; archive?: boolean }) =>
    request(`/api/tags/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  addTagToImage: (imageId: string, name: string) =>
    request(`/api/template-images/${imageId}/tags`, { method: 'POST', body: JSON.stringify({ name }) }),
  removeTagFromImage: (imageId: string, tagId: string) =>
    request(`/api/template-images/${imageId}/tags/${tagId}`, { method: 'DELETE' }),
```

Update `getTemplateImages` to accept tags param:

```typescript
  getTemplateImages: (page = 1, sort?: string, tags?: string[]) =>
    request(`/api/template-images?page=${page}${sort ? `&sort=${sort}` : ''}${tags?.length ? `&tags=${tags.join(',')}` : ''}`),
```

Update `getSiteTemplates` to accept tags param:

```typescript
  getSiteTemplates: (page = 1, search?: string, sort?: string, tags?: string[]) =>
    request(`/api/template-images/site?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ''}${sort ? `&sort=${sort}` : ''}${tags?.length ? `&tags=${tags.join(',')}` : ''}`),
```

**Step 2: Run type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: Compilation errors in pages that call these functions with old signatures — fix in next tasks.

**Step 3: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: add tag API client methods, update list methods with tags param"
```

---

### Task 7: Frontend — Tag input component with autocomplete

**Files:**
- Create: `frontend/src/components/tag-input.tsx`

**Step 1: Create the TagInput component**

```typescript
// frontend/src/components/tag-input.tsx
'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { X, Plus, Trash2 } from 'lucide-react'

interface Tag {
  id: string
  name: string
}

interface TagInputProps {
  tags: Tag[]
  onAdd: (name: string) => void
  onRemove: (tagId: string) => void
  isAdmin?: boolean
  onAdminArchive?: (tagId: string) => void
}

export function TagInput({ tags, onAdd, onRemove, isAdmin, onAdminArchive }: TagInputProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [suggestions, setSuggestions] = useState<Array<{ id: string; name: string; usageCount: number }>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isAdding && inputRef.current) inputRef.current.focus()
  }, [isAdding])

  const fetchSuggestions = useCallback((query: string) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (!query.trim()) { setSuggestions([]); return }
    searchTimeout.current = setTimeout(async () => {
      try {
        const data = await api.getTags(query)
        setSuggestions(data.tags.filter((t: Tag) => !tags.some((existing) => existing.id === t.id)))
      } catch { setSuggestions([]) }
    }, 200)
  }, [tags])

  const handleAdd = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setInputValue('')
    setSuggestions([])
    setIsAdding(false)
  }

  if (!isAdding) {
    return (
      <div className="flex flex-wrap gap-1 items-center">
        {tags.map((tag) => (
          <span key={tag.id} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gray-100 text-xs text-gray-600">
            {tag.name}
            <button onClick={(e) => { e.stopPropagation(); onRemove(tag.id) }} className="hover:text-red-500">
              <X size={10} />
            </button>
          </span>
        ))}
        <button
          onClick={(e) => { e.stopPropagation(); setIsAdding(true) }}
          className="p-0.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          title="Add tag"
        >
          <Plus size={12} />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1 items-center">
        {tags.map((tag) => (
          <span key={tag.id} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gray-100 text-xs text-gray-600">
            {tag.name}
            <button onClick={(e) => { e.stopPropagation(); onRemove(tag.id) }} className="hover:text-red-500">
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => { setInputValue(e.target.value); fetchSuggestions(e.target.value); setShowSuggestions(true) }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); handleAdd(inputValue) }
            if (e.key === 'Escape') { setIsAdding(false); setInputValue('') }
          }}
          onBlur={() => setTimeout(() => { setShowSuggestions(false); if (!inputValue) setIsAdding(false) }, 200)}
          placeholder="Add tag..."
          className="text-xs border rounded px-1.5 py-0.5 w-24 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-20 w-48 max-h-32 overflow-y-auto">
          {suggestions.map((s) => (
            <div key={s.id} className="flex items-center justify-between px-2 py-1 hover:bg-blue-50 cursor-pointer text-xs"
              onMouseDown={(e) => { e.preventDefault(); handleAdd(s.name) }}>
              <span>{s.name}</span>
              <div className="flex items-center gap-1">
                <span className="text-gray-400">{s.usageCount}</span>
                {isAdmin && onAdminArchive && (
                  <button
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onAdminArchive(s.id) }}
                    className="p-0.5 hover:text-red-500 text-gray-300"
                    title="Archive tag"
                  >
                    <Trash2 size={10} />
                  </button>
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

**Step 2: Run type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/components/tag-input.tsx
git commit -m "feat: add TagInput component with autocomplete and admin moderation"
```

---

### Task 8: Frontend — Tag filter bar component

**Files:**
- Create: `frontend/src/components/tag-filter.tsx`

**Step 1: Create the TagFilter component**

```typescript
// frontend/src/components/tag-filter.tsx
'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '@/lib/api'
import { X, Search, Tag as TagIcon } from 'lucide-react'

interface Tag {
  id: string
  name: string
  usageCount: number
}

interface TagFilterProps {
  activeTags: string[]
  onTagsChange: (tags: string[]) => void
}

export function TagFilter({ activeTags, onTagsChange }: TagFilterProps) {
  const [popularTags, setPopularTags] = useState<Tag[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [suggestions, setSuggestions] = useState<Tag[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    api.getPopularTags().then((data) => setPopularTags(data.tags)).catch(() => {})
  }, [])

  const fetchSuggestions = useCallback((query: string) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (!query.trim()) { setSuggestions([]); return }
    searchTimeout.current = setTimeout(async () => {
      try {
        const data = await api.getTags(query)
        setSuggestions(data.tags.filter((t: Tag) => !activeTags.includes(t.name)))
      } catch { setSuggestions([]) }
    }, 200)
  }, [activeTags])

  const toggleTag = (name: string) => {
    if (activeTags.includes(name)) {
      onTagsChange(activeTags.filter((t) => t !== name))
    } else {
      onTagsChange([...activeTags, name])
    }
  }

  const addFromSearch = (name: string) => {
    if (!activeTags.includes(name)) {
      onTagsChange([...activeTags, name])
    }
    setSearchInput('')
    setSuggestions([])
    setShowSuggestions(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <TagIcon size={14} className="text-gray-400 shrink-0" />
        {popularTags.map((tag) => (
          <button
            key={tag.id}
            onClick={() => toggleTag(tag.name)}
            className={`px-2.5 py-0.5 text-xs rounded-full border transition-colors ${
              activeTags.includes(tag.name)
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            {tag.name}
          </button>
        ))}
        <div className="relative">
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => { setSearchInput(e.target.value); fetchSuggestions(e.target.value); setShowSuggestions(true) }}
              onFocus={() => { if (suggestions.length) setShowSuggestions(true) }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchInput.trim()) { addFromSearch(searchInput.trim().toLowerCase()) }
                if (e.key === 'Escape') { setShowSuggestions(false); setSearchInput('') }
              }}
              placeholder="Search tags..."
              className="pl-6 pr-2 py-0.5 text-xs border rounded-full w-32 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-20 w-48 max-h-32 overflow-y-auto">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  className="flex items-center justify-between w-full px-2 py-1 hover:bg-blue-50 text-xs text-left"
                  onMouseDown={(e) => { e.preventDefault(); addFromSearch(s.name) }}
                >
                  <span>{s.name}</span>
                  <span className="text-gray-400">{s.usageCount}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {activeTags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-gray-500">Filtered by:</span>
          {activeTags.map((name) => (
            <span key={name} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs">
              {name}
              <button onClick={() => toggleTag(name)}><X size={10} /></button>
            </span>
          ))}
          <button onClick={() => onTagsChange([])} className="text-xs text-gray-400 hover:text-gray-600 ml-1">
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Run type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/components/tag-filter.tsx
git commit -m "feat: add TagFilter component with popular pills and search"
```

---

### Task 9: Frontend — Integrate tags into Library page

**Files:**
- Modify: `frontend/src/app/(app)/library/page.tsx`

**Step 1: Add tag imports, state, and update fetchImages**

At the top, add imports:
```typescript
import { TagInput } from '@/components/tag-input'
import { TagFilter } from '@/components/tag-filter'
```

Add to the TemplateImage interface:
```typescript
  tags: Array<{ id: string; name: string }>
```

Add state:
```typescript
const [activeTags, setActiveTags] = useState<string[]>([])
```

Update `fetchImages` signature and call:
```typescript
const fetchImages = useCallback(async (p: number, s?: string, t?: string[]) => {
  setLoading(true)
  try {
    const data = await api.getTemplateImages(p, s, t)
    // ... same as before
  } finally { setLoading(false) }
}, [])
```

Update all calls to `fetchImages` to pass `activeTags` as the third argument. For example:
- `fetchImages(1, sort, activeTags)` in useEffect
- `fetchImages(page, sort, activeTags)` after upload/archive/rename

Add a `handleTagsChange` function:
```typescript
const handleTagsChange = (tags: string[]) => {
  setActiveTags(tags)
  fetchImages(1, sort, tags)
}
```

**Step 2: Add tag handlers for cards**

```typescript
const handleAddTag = async (imageId: string, tagName: string) => {
  const result = await api.addTagToImage(imageId, tagName)
  setImages((prev) => prev.map((img) =>
    img.id === imageId ? { ...img, tags: [...img.tags, result.tag] } : img
  ))
}

const handleRemoveTag = async (imageId: string, tagId: string) => {
  await api.removeTagFromImage(imageId, tagId)
  setImages((prev) => prev.map((img) =>
    img.id === imageId ? { ...img, tags: img.tags.filter((t) => t.id !== tagId) } : img
  ))
}
```

**Step 3: Add TagFilter to the page layout**

After the sort pills div, add:
```tsx
<TagFilter activeTags={activeTags} onTagsChange={handleTagsChange} />
```

**Step 4: Add TagInput on each card**

After the star rating div in the card, add:
```tsx
<TagInput
  tags={img.tags}
  onAdd={(name) => handleAddTag(img.id, name)}
  onRemove={(tagId) => handleRemoveTag(img.id, tagId)}
/>
```

**Step 5: Add search box to library page**

Add search state and handler (library currently doesn't have search):
```typescript
const [search, setSearch] = useState('')
const [searchInput, setSearchInput] = useState('')
const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

const handleSearchChange = (value: string) => {
  setSearchInput(value)
  if (searchTimeout.current) clearTimeout(searchTimeout.current)
  searchTimeout.current = setTimeout(() => {
    setSearch(value)
    fetchImages(1, sort, activeTags)
  }, 400)
}
```

Update `fetchImages` to also accept and pass search. Add the search input in the header next to the Upload button.

**Step 6: Run type check and verify**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 7: Commit**

```bash
git add frontend/src/app/(app)/library/page.tsx
git commit -m "feat: integrate tags into Library page with filtering and inline editing"
```

---

### Task 10: Frontend — Integrate tags into Templates page

**Files:**
- Modify: `frontend/src/app/(app)/templates/page.tsx`

**Step 1: Add tag imports, state, and update fetchImages**

Same pattern as Library page:
- Import `TagInput` and `TagFilter`
- Add `tags` to TemplateImage interface
- Add `activeTags` state
- Update `fetchImages` to pass tags
- Add `handleTagsChange`, `handleAddTag`, `handleRemoveTag`
- Update all `fetchImages` calls to include `activeTags`

**Step 2: Add TagFilter after sort pills**

```tsx
<TagFilter activeTags={activeTags} onTagsChange={handleTagsChange} />
```

**Step 3: Add TagInput on each card**

```tsx
<TagInput
  tags={img.tags}
  onAdd={(name) => handleAddTag(img.id, name)}
  onRemove={(tagId) => handleRemoveTag(img.id, tagId)}
  isAdmin={isAdmin}
  onAdminArchive={async (tagId) => {
    await api.updateTag(tagId, { archive: true })
    fetchImages(page, search, sort, activeTags)
  }}
/>
```

**Step 4: Run type check and verify**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add frontend/src/app/(app)/templates/page.tsx
git commit -m "feat: integrate tags into Templates page with filtering and admin moderation"
```

---

### Task 11: Run all tests and final verification

**Step 1: Run all tests**

Run: `cd frontend && npx vitest run`
Expected: All tests pass

**Step 2: Run type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Push**

```bash
git push
```
