import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, handleAuthError } from '@/lib/server/auth'

const overlayConfigSchema = z.object({
  corners: z.array(z.object({ x: z.number(), y: z.number() })).length(4),
  displacementIntensity: z.number().min(0).max(1).default(0.5),
  transparency: z.number().min(0).max(1).default(0),
  textureData: z.any().optional(),
  curvature: z.number().min(-1).max(1).optional(),
  curveAxis: z.enum(['auto', 'horizontal', 'vertical']).optional(),
  mode: z.enum(['advanced', 'basic']).default('advanced'),
  rotation: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
})

type Params = { params: Promise<{ id: string; templateId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const userId = await requireAuth()
    const { id: setId, templateId } = await params

    const set = await prisma.mockupSet.findFirst({ where: { id: setId, userId } })
    if (!set) {
      return NextResponse.json({ error: 'Set not found' }, { status: 404 })
    }

    const body = await req.json()
    const data: Record<string, unknown> = {}
    if (body.name) data.name = body.name
    if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder
    if (body.overlayConfig) {
      data.overlayConfig = overlayConfigSchema.parse(body.overlayConfig)
    }
    if (body.isFavorite !== undefined) data.isFavorite = !!body.isFavorite

    const result = await prisma.mockupTemplate.updateMany({
      where: { id: templateId, mockupSetId: set.id },
      data,
    })
    if (result.count === 0) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }
    const updated = await prisma.mockupTemplate.findUnique({ where: { id: templateId } })
    return NextResponse.json(updated)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 })
    }
    return handleAuthError(err)
  }
}

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
