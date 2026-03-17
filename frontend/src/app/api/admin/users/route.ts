import { NextResponse } from 'next/server'
import { requireAdmin, handleAuthError } from '@/lib/server/auth'
import { prisma } from '@/lib/server/prisma'

export async function GET() {
  try {
    await requireAdmin()
  } catch (err) {
    return handleAuthError(err)
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      authProvider: true,
      isAdmin: true,
      renderCountOffset: true,
      createdAt: true,
      _count: {
        select: {
          mockupSets: true,
          designs: true,
          renderBatches: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Get render counts per user
  const renderCountsByUser: Record<string, number> = {}
  for (const user of users) {
    const count = await prisma.renderedMockup.count({
      where: { mockupTemplate: { mockupSet: { userId: user.id } } },
    })
    renderCountsByUser[user.id] = count
  }

  const result = users.map(u => ({
    ...u,
    totalRenders: renderCountsByUser[u.id] || 0,
    effectiveRenders: Math.max(0, (renderCountsByUser[u.id] || 0) - u.renderCountOffset),
  }))

  return NextResponse.json({ users: result })
}
