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

    let imagePath: string
    try {
      imagePath = await saveUpload(file, `templates/${set.id}`)
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 })
    }
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
        sortOrder: count,
      },
      include: { templateImage: true },
    })
    return NextResponse.json(template, { status: 201 })
  } catch (err) {
    return handleAuthError(err)
  }
}
