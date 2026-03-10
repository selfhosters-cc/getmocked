import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, handleAuthError } from '@/lib/server/auth'

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireAuth()
    const { id } = await params

    const render = await prisma.renderedMockup.findFirst({
      where: { id },
      include: { batch: { select: { userId: true } } },
    })
    if (!render || render.batch?.userId !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const updated = await prisma.renderedMockup.update({
      where: { id },
      data: { isFavorite: !render.isFavorite },
    })
    return NextResponse.json({ isFavorite: updated.isFavorite })
  } catch (err) {
    return handleAuthError(err)
  }
}
