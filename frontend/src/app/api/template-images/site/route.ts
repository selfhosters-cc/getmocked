import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, requireAdmin, handleAuthError } from '@/lib/server/auth'
import { saveUpload } from '@/lib/server/storage'
import { generateThumbnail } from '@/lib/server/thumbnails'

const PAGE_SIZE = 24
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'

export async function GET(req: NextRequest) {
  try {
    await requireAuth()
    const params = new URL(req.url).searchParams
    const page = parseInt(params.get('page') || '1')
    const search = params.get('search') || ''
    const sort = params.get('sort') || 'newest'
    const tagsParam = params.get('tags') || ''
    const tagNames = tagsParam ? tagsParam.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : []
    const offset = (page - 1) * PAGE_SIZE

    const where: Record<string, unknown> = {
      userId: null,
      archivedAt: null,
    }
    if (search) {
      where.name = { contains: search, mode: 'insensitive' }
    }
    if (tagNames.length > 0) {
      where.AND = tagNames.map(name => ({
        tags: { some: { tag: { name, archivedAt: null } } }
      }))
    }

    const needsComputedSort = sort === 'most_sets'

    const orderBy =
      sort === 'oldest' ? { createdAt: 'asc' as const }
      : sort === 'name_asc' ? { name: 'asc' as const }
      : sort === 'name_desc' ? { name: 'desc' as const }
      : sort === 'top_rated' ? { rating: 'desc' as const }
      : { createdAt: 'desc' as const }

    const images = await prisma.templateImage.findMany({
      where,
      orderBy: needsComputedSort ? { createdAt: 'desc' } : orderBy,
      ...(needsComputedSort ? {} : { skip: offset, take: PAGE_SIZE }),
      include: {
        _count: { select: { templates: { where: { archivedAt: null } } } },
        tags: { include: { tag: { select: { id: true, name: true } } } },
      },
    })

    const total = needsComputedSort
      ? images.length
      : await prisma.templateImage.count({ where })

    let result = images.map((img) => ({
      ...img,
      setCount: img._count.templates,
      tags: img.tags.map((t: any) => ({ id: t.tag.id, name: t.tag.name })),
    }))

    if (sort === 'most_sets') {
      result.sort((a, b) => b.setCount - a.setCount)
    }

    if (needsComputedSort) {
      result = result.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    }

    return NextResponse.json({ images: result, total, page, pageSize: PAGE_SIZE })
  } catch (err) {
    return handleAuthError(err)
  }
}

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
    } catch { /* lazy fallback */ }

    const image = await prisma.templateImage.create({
      data: {
        userId: null,
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
