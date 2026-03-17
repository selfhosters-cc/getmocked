import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, handleAuthError } from '@/lib/server/auth'
import { saveUpload } from '@/lib/server/storage'
import { generateThumbnail } from '@/lib/server/thumbnails'

const PAGE_SIZE = 24
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'

export async function GET(req: NextRequest) {
  try {
    const userId = await requireAuth()
    const params = new URL(req.url).searchParams
    const page = parseInt(params.get('page') || '1')
    const sort = params.get('sort') || 'newest'
    const search = params.get('search') || ''
    const tagsParam = params.get('tags') || ''
    const tagNames = tagsParam ? tagsParam.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : []

    const where: Record<string, unknown> = { userId, archivedAt: null }
    if (search) {
      where.name = { contains: search, mode: 'insensitive' }
    }
    if (tagNames.length > 0) {
      where.AND = tagNames.map(name => ({
        tags: { some: { tag: { name, archivedAt: null } } }
      }))
    }

    // For computed sorts (renders, sets), fetch all IDs, sort, then paginate
    const needsComputedSort = ['most_renders', 'most_sets'].includes(sort)

    // Column-based orderBy
    const orderBy =
      sort === 'oldest' ? { createdAt: 'asc' as const }
      : sort === 'name_asc' ? { name: 'asc' as const }
      : sort === 'name_desc' ? { name: 'desc' as const }
      : sort === 'top_rated' ? { rating: 'desc' as const }
      : { createdAt: 'desc' as const }

    const allImages = await prisma.templateImage.findMany({
      where,
      orderBy: needsComputedSort ? { createdAt: 'desc' } : orderBy,
      ...(needsComputedSort ? {} : { skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
      include: {
        _count: {
          select: { templates: { where: { archivedAt: null } } },
        },
        tags: { include: { tag: { select: { id: true, name: true } } } },
      },
    })

    const total = needsComputedSort
      ? allImages.length
      : await prisma.templateImage.count({ where })

    // Get render counts and template links for all fetched images
    const imageIds = allImages.map((i) => i.id)
    const templatesForImages = await prisma.mockupTemplate.findMany({
      where: { templateImageId: { in: imageIds }, archivedAt: null },
      select: { id: true, templateImageId: true, mockupSetId: true, _count: { select: { renderedMockups: true } } },
    })

    const renderCountByImage = new Map<string, number>()
    const templatesByImage = new Map<string, { templateId: string; setId: string; renderCount: number }[]>()
    for (const t of templatesForImages) {
      if (t.templateImageId) {
        renderCountByImage.set(t.templateImageId, (renderCountByImage.get(t.templateImageId) || 0) + t._count.renderedMockups)
        const list = templatesByImage.get(t.templateImageId) || []
        list.push({ templateId: t.id, setId: t.mockupSetId, renderCount: t._count.renderedMockups })
        templatesByImage.set(t.templateImageId, list)
      }
    }

    let enriched = allImages.map((img) => ({
      ...img,
      setCount: img._count.templates,
      renderCount: renderCountByImage.get(img.id) || 0,
      templateLinks: templatesByImage.get(img.id) || [],
      tags: img.tags.map((t: any) => ({ id: t.tag.id, name: t.tag.name })),
    }))

    // Apply computed sorts and paginate
    if (sort === 'most_renders') {
      enriched.sort((a, b) => b.renderCount - a.renderCount)
    } else if (sort === 'most_sets') {
      enriched.sort((a, b) => b.setCount - a.setCount)
    }

    if (needsComputedSort) {
      enriched = enriched.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    }

    return NextResponse.json({ images: enriched, total, page, pageSize: PAGE_SIZE })
  } catch (err) {
    return handleAuthError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireAuth()
    const formData = await req.formData()
    const file = formData.get('image') as File | null
    if (!file) {
      return NextResponse.json({ error: 'Image file required' }, { status: 400 })
    }

    let imagePath: string
    try {
      imagePath = await saveUpload(file, 'templates/library')
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 })
    }
    let thumbnailPath: string | null = null
    try {
      thumbnailPath = await generateThumbnail(UPLOAD_DIR, imagePath)
    } catch { /* lazy fallback */ }

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
