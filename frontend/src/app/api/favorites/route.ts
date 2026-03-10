import { NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, handleAuthError } from '@/lib/server/auth'

export async function GET() {
  try {
    const userId = await requireAuth()

    const [templates, renders] = await Promise.all([
      prisma.mockupTemplate.findMany({
        where: { isFavorite: true, mockupSet: { userId } },
        include: { mockupSet: { select: { id: true, name: true } } },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.renderedMockup.findMany({
        where: { isFavorite: true, batch: { userId } },
        include: {
          mockupTemplate: { select: { name: true } },
          design: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ])

    return NextResponse.json({ templates, renders })
  } catch (err) {
    return handleAuthError(err)
  }
}
