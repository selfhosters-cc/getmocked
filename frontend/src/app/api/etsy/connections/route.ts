import { NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/server/auth'
import { prisma } from '@/lib/server/prisma'

export async function GET() {
  let userId: string
  try {
    userId = await requireAuth()
  } catch (err) {
    return handleAuthError(err)
  }

  const connections = await prisma.etsyConnection.findMany({
    where: { userId },
    select: {
      id: true,
      shopId: true,
      shopName: true,
      etsyUserId: true,
      tokenExpiresAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const connectionsWithStatus = connections.map((c) => ({
    ...c,
    status: c.tokenExpiresAt.getTime() > 0 ? 'connected' : 'needs_reauth',
  }))

  return NextResponse.json({ connections: connectionsWithStatus })
}
