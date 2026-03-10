import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, handleAuthError } from '@/lib/server/auth'
import { deleteFile } from '@/lib/server/storage'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireAuth()
    const { id } = await params
    const design = await prisma.design.findFirst({ where: { id, userId } })
    if (!design) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    // Delete associated renders and their files first (no cascade on design FK)
    const renders = await prisma.renderedMockup.findMany({
      where: { designId: design.id },
    })
    for (const render of renders) {
      if (render.renderedImagePath) {
        await deleteFile(render.renderedImagePath).catch(() => {})
      }
    }
    await prisma.renderedMockup.deleteMany({ where: { designId: design.id } })

    await deleteFile(design.imagePath)
    await prisma.design.delete({ where: { id: design.id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleAuthError(err)
  }
}
