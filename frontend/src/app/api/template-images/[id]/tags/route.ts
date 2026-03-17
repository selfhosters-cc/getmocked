import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, requireAdmin, handleAuthError } from '@/lib/server/auth'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const userId = await requireAuth()
    const { id } = await params
    const body = await req.json()
    const name = (body.name || '').toLowerCase().trim()

    if (!name) {
      return NextResponse.json({ error: 'Tag name required' }, { status: 400 })
    }

    const image = await prisma.templateImage.findFirst({
      where: { id, OR: [{ userId }, { userId: null }] },
    })
    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }
    // Only admins can tag site-wide (public) templates
    if (image.userId === null) {
      await requireAdmin()
    }

    const tag = await prisma.tag.upsert({
      where: { name },
      create: { name },
      update: {},
    })

    await prisma.templateImageTag.create({
      data: { templateImageId: id, tagId: tag.id },
    }).catch(() => {})

    return NextResponse.json({ tag: { id: tag.id, name: tag.name } })
  } catch (err) {
    return handleAuthError(err)
  }
}
