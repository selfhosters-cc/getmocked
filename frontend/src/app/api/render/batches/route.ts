import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, handleAuthError } from '@/lib/server/auth'

const PAGE_SIZE = 12

export async function GET(req: NextRequest) {
  try {
    const userId = await requireAuth()
    const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10))

    const [batches, total] = await Promise.all([
      prisma.renderBatch.findMany({
        where: { userId },
        include: {
          mockupSet: { select: { id: true, name: true } },
          design: { select: { id: true, name: true, imagePath: true } },
          renders: { select: { id: true, status: true, renderedImagePath: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.renderBatch.count({ where: { userId } }),
    ])

    const result = batches.map((b) => ({
      id: b.id,
      createdAt: b.createdAt,
      description: b.description,
      mockupSet: b.mockupSet,
      design: b.design,
      totalRenders: b.renders.length,
      completedRenders: b.renders.filter((r) => r.status === 'complete').length,
      failedRenders: b.renders.filter((r) => r.status === 'failed').length,
      previewImages: b.renders
        .filter((r) => r.status === 'complete' && r.renderedImagePath)
        .slice(0, 3)
        .map((r) => r.renderedImagePath),
    }))

    return NextResponse.json({
      batches: result,
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.ceil(total / PAGE_SIZE),
    })
  } catch (err) {
    return handleAuthError(err)
  }
}
