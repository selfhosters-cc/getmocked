import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, requireAdmin, handleAuthError } from '@/lib/server/auth'

type Params = { params: Promise<{ id: string; tagId: string }> }

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const userId = await requireAuth()
    const { id, tagId } = await params

    const image = await prisma.templateImage.findFirst({
      where: { id, OR: [{ userId }, { userId: null }] },
    })
    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }
    // Only admins can untag site-wide (public) templates
    if (image.userId === null) {
      await requireAdmin()
    }

    await prisma.templateImageTag.delete({
      where: { templateImageId_tagId: { templateImageId: id, tagId } },
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (err) {
    return handleAuthError(err)
  }
}
