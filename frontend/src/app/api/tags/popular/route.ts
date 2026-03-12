import { NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, handleAuthError } from '@/lib/server/auth'

export async function GET() {
  try {
    await requireAuth()

    const tags = await prisma.tag.findMany({
      where: { archivedAt: null },
      include: { _count: { select: { images: true } } },
      orderBy: { images: { _count: 'desc' } },
      take: 10,
    })

    return NextResponse.json({
      tags: tags
        .filter((t) => t._count.images > 0)
        .map((t) => ({
          id: t.id,
          name: t.name,
          usageCount: t._count.images,
        })),
    })
  } catch (err) {
    return handleAuthError(err)
  }
}
