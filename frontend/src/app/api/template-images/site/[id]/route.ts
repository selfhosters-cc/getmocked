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
