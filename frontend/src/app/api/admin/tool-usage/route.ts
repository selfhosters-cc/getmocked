import { NextResponse } from 'next/server'
import { requireAdmin, handleAuthError } from '@/lib/server/auth'
import { prisma } from '@/lib/server/prisma'

export async function GET() {
  try {
    await requireAdmin()
  } catch (err) {
    return handleAuthError(err)
  }

  const now = new Date()
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [allTime, last24h, last7d, recent] = await Promise.all([
    prisma.toolUsage.groupBy({
      by: ['tool'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    }),
    prisma.toolUsage.groupBy({
      by: ['tool'],
      where: { createdAt: { gte: oneDayAgo } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    }),
    prisma.toolUsage.groupBy({
      by: ['tool'],
      where: { createdAt: { gte: sevenDaysAgo } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    }),
    prisma.toolUsage.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      select: { id: true, tool: true, userId: true, createdAt: true },
    }),
  ])

  return NextResponse.json({
    allTime: allTime.map(r => ({ tool: r.tool, count: r._count.id })),
    last24h: last24h.map(r => ({ tool: r.tool, count: r._count.id })),
    last7d: last7d.map(r => ({ tool: r.tool, count: r._count.id })),
    recent,
  })
}
