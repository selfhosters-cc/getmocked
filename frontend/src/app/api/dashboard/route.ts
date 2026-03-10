import { NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, handleAuthError } from '@/lib/server/auth'

export async function GET() {
  try {
    const userId = await requireAuth()

    const [setsCount, designsCount, renderStats, recentBatches] = await Promise.all([
      prisma.mockupSet.count({ where: { userId } }),
      prisma.design.count({ where: { userId } }),
      prisma.renderedMockup.groupBy({
        by: ['status'],
        where: { batch: { userId } },
        _count: true,
      }),
      prisma.renderBatch.findMany({
        where: { userId },
        include: {
          mockupSet: { select: { id: true, name: true } },
          design: { select: { id: true, name: true, imagePath: true } },
          renders: { select: { id: true, status: true, renderedImagePath: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 4,
      }),
    ])

    const totalRenders = renderStats.reduce((sum, r) => sum + r._count, 0)
    const completedRenders = renderStats.find((r) => r.status === 'complete')?._count ?? 0
    const failedRenders = renderStats.find((r) => r.status === 'failed')?._count ?? 0

    const recentPreviews = recentBatches.map((b) => ({
      id: b.id,
      createdAt: b.createdAt,
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
      stats: {
        sets: setsCount,
        designs: designsCount,
        totalRenders,
        completedRenders,
        failedRenders,
      },
      recentBatches: recentPreviews,
    })
  } catch (err) {
    return handleAuthError(err)
  }
}
