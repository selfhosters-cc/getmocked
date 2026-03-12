import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, handleAuthError } from '@/lib/server/auth'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireAuth()
    const { id } = await params

    const render = await prisma.renderedMockup.findFirst({
      where: {
        id,
        mockupTemplate: { mockupSet: { userId } },
      },
      include: {
        mockupTemplate: { select: { id: true, name: true, overlayConfig: true } },
        design: { select: { id: true, name: true, imagePath: true } },
      },
    })

    if (!render) {
      return NextResponse.json({ error: 'Render not found' }, { status: 404 })
    }

    return NextResponse.json(render)
  } catch (err) {
    return handleAuthError(err)
  }
}
