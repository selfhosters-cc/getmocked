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

    // Get render counts via templates
    const imageIds = images.map((i) => i.id)
    const templatesForImages = await prisma.mockupTemplate.findMany({
      where: { templateImageId: { in: imageIds } },
      select: { id: true, templateImageId: true, _count: { select: { renderedMockups: true } } },
    })

    const renderCountByImage = new Map<string, number>()
    for (const t of templatesForImages) {
      if (t.templateImageId) {
        renderCountByImage.set(t.templateImageId, (renderCountByImage.get(t.templateImageId) || 0) + t._count.renderedMockups)
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
