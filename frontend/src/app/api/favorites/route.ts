import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, handleAuthError } from '@/lib/server/auth'

const RENDERS_PER_PAGE = 20

export async function GET(req: NextRequest) {
  try {
    const userId = await requireAuth()

    const { searchParams } = new URL(req.url)
    const renderPage = Math.max(1, parseInt(searchParams.get('renderPage') ?? '1', 10) || 1)

    const [templates, renderTotal, renders] = await Promise.all([
      prisma.mockupTemplate.findMany({
        where: { isFavorite: true, mockupSet: { userId } },
        include: { mockupSet: { select: { id: true, name: true } }, templateImage: { select: { imagePath: true, thumbnailPath: true } } },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.renderedMockup.count({
        where: { isFavorite: true, batch: { userId } },
      }),
      prisma.renderedMockup.findMany({
        where: { isFavorite: true, batch: { userId } },
        include: {
          mockupTemplate: { select: { name: true } },
          design: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (renderPage - 1) * RENDERS_PER_PAGE,
        take: RENDERS_PER_PAGE,
      }),
    ])

    const renderTotalPages = Math.max(1, Math.ceil(renderTotal / RENDERS_PER_PAGE))

    return NextResponse.json({
      templates,
      renders,
      renderPage,
      renderTotalPages,
      renderTotal,
    })
  } catch (err) {
    return handleAuthError(err)
  }
}
