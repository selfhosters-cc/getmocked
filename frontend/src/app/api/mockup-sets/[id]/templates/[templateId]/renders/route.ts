import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, handleAuthError } from '@/lib/server/auth'

type Params = { params: Promise<{ id: string; templateId: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = await requireAuth()
    const { id: setId, templateId } = await params
    const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10))
    const pageSize = 12

    const set = await prisma.mockupSet.findFirst({ where: { id: setId, userId } })
    if (!set) return NextResponse.json({ error: 'Set not found' }, { status: 404 })

    const [renders, total] = await Promise.all([
      prisma.renderedMockup.findMany({
        where: { mockupTemplateId: templateId },
        include: {
          design: { select: { id: true, name: true, imagePath: true } },
          batch: { select: { id: true, createdAt: true, description: true } },
          mockupTemplate: { select: { id: true, name: true, overlayConfig: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.renderedMockup.count({ where: { mockupTemplateId: templateId } }),
    ])

    return NextResponse.json({ renders, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
  } catch (err) {
    return handleAuthError(err)
  }
}
