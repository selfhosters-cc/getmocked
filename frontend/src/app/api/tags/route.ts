import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, handleAuthError } from '@/lib/server/auth'

export async function GET(req: NextRequest) {
  try {
    await requireAuth()
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''

    const where: Record<string, unknown> = { archivedAt: null }
    if (search) {
      where.name = { contains: search.toLowerCase(), mode: 'insensitive' }
    }

    const tags = await prisma.tag.findMany({
      where,
      include: { _count: { select: { images: true } } },
      orderBy: { name: 'asc' },
      take: 50,
    })

    return NextResponse.json({
      tags: tags.map((t) => ({
        id: t.id,
        name: t.name,
        usageCount: t._count.images,
        createdAt: t.createdAt,
      })),
    })
  } catch (err) {
    return handleAuthError(err)
  }
}
