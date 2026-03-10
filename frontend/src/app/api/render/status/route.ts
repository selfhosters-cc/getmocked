import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, handleAuthError } from '@/lib/server/auth'

export async function GET(req: NextRequest) {
  try {
    const userId = await requireAuth()
    const mockupSetId = req.nextUrl.searchParams.get('mockupSetId')!
    const designId = req.nextUrl.searchParams.get('designId')!

    const renders = await prisma.renderedMockup.findMany({
      where: {
        designId,
        mockupTemplate: { mockupSetId, mockupSet: { userId } },
      },
      include: { mockupTemplate: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json(renders)
  } catch (err) {
    return handleAuthError(err)
  }
}
