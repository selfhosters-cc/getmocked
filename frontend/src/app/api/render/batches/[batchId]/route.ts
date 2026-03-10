import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, handleAuthError } from '@/lib/server/auth'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  try {
    const userId = await requireAuth()
    const { batchId } = await params

    const batch = await prisma.renderBatch.findFirst({
      where: { id: batchId, userId },
      include: {
        mockupSet: { select: { id: true, name: true } },
        design: { select: { id: true, name: true, imagePath: true } },
        renders: {
          include: { mockupTemplate: { select: { name: true, overlayConfig: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }

    return NextResponse.json(batch)
  } catch (err) {
    return handleAuthError(err)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  try {
    const userId = await requireAuth()
    const { batchId } = await params

    const result = await prisma.renderBatch.deleteMany({
      where: { id: batchId, userId },
    })
    if (result.count === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleAuthError(err)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  try {
    const userId = await requireAuth()
    const { batchId } = await params
    const { description } = await req.json()

    const result = await prisma.renderBatch.updateMany({
      where: { id: batchId, userId },
      data: { description: description ?? null },
    })
    if (result.count === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleAuthError(err)
  }
}
