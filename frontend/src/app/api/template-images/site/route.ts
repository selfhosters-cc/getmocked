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
    const page = parseInt(req.nextUrl.searchParams.get('page') || '1')
    const search = req.nextUrl.searchParams.get('search') || ''
    const offset = (page - 1) * PAGE_SIZE

    const where: Record<string, unknown> = {
      userId: null,
      archivedAt: null,
    }
    if (search) {
      where.name = { contains: search, mode: 'insensitive' }
    }

    const [images, total] = await Promise.all([
      prisma.templateImage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: PAGE_SIZE,
        include: {
          _count: { select: { templates: { where: { archivedAt: null } } } },
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
