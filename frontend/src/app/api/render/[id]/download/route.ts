import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, handleAuthError } from '@/lib/server/auth'
import { getRenderPath } from '@/lib/server/storage'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireAuth()
    const { id } = await params

    const render = await prisma.renderedMockup.findFirst({
      where: {
        id,
        mockupTemplate: { mockupSet: { userId } },
      },
    })
    if (!render || render.status !== 'complete') {
      return NextResponse.json({ error: 'Render not found or not complete' }, { status: 404 })
    }

    const filePath = getRenderPath(render.renderedImagePath)
    const buffer = await fs.readFile(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const contentType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'application/octet-stream'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${path.basename(filePath)}"`,
      },
    })
  } catch (err) {
    return handleAuthError(err)
  }
}
