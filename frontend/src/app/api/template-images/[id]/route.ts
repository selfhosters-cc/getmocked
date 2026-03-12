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
    if (body.rating !== undefined) data.rating = Math.max(0, Math.min(5, parseInt(body.rating) || 0))

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
