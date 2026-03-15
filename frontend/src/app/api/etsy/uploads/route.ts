import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/server/auth'
import { prisma } from '@/lib/server/prisma'

export async function GET(req: NextRequest) {
  let userId: string
  try {
    userId = await requireAuth()
  } catch (err) {
    return handleAuthError(err)
  }

  const url = req.nextUrl
  const renderedMockupId = url.searchParams.get('renderedMockupId')
  const etsyConnectionId = url.searchParams.get('etsyConnectionId')

  const where: Record<string, unknown> = {
    etsyConnection: { userId },
  }
  if (renderedMockupId) where.renderedMockupId = renderedMockupId
  if (etsyConnectionId) where.etsyConnectionId = etsyConnectionId

  const uploads = await prisma.etsyUpload.findMany({
    where,
    select: {
      id: true,
      etsyListingId: true,
      etsyImageId: true,
      status: true,
      errorMessage: true,
      createdAt: true,
      etsyConnection: {
        select: { id: true, shopName: true },
      },
      renderedMockup: {
        select: { id: true, renderedImagePath: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return NextResponse.json({ uploads })
}
