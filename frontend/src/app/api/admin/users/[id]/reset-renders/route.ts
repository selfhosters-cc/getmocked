import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, handleAuthError } from '@/lib/server/auth'
import { prisma } from '@/lib/server/prisma'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
  } catch (err) {
    return handleAuthError(err)
  }

  const { id } = await params

  // Get current total renders for this user
  const totalRenders = await prisma.renderedMockup.count({
    where: { mockupTemplate: { mockupSet: { userId: id } } },
  })

  // Set offset to current total, effectively resetting their count to 0
  await prisma.user.update({
    where: { id },
    data: { renderCountOffset: totalRenders },
  })

  return NextResponse.json({ success: true, newOffset: totalRenders })
}
