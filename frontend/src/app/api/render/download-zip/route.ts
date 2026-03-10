import { NextRequest, NextResponse } from 'next/server'
import archiver from 'archiver'
import path from 'path'
import { Readable } from 'stream'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, handleAuthError } from '@/lib/server/auth'
import { getRenderPath } from '@/lib/server/storage'

export async function GET(req: NextRequest) {
  try {
    const userId = await requireAuth()
    const mockupSetId = req.nextUrl.searchParams.get('mockupSetId')!
    const designId = req.nextUrl.searchParams.get('designId')!

    const renders = await prisma.renderedMockup.findMany({
      where: {
        designId,
        status: 'complete',
        mockupTemplate: { mockupSetId, mockupSet: { userId } },
      },
      include: { mockupTemplate: { select: { name: true } } },
    })

    if (renders.length === 0) {
      return NextResponse.json({ error: 'No completed renders found' }, { status: 404 })
    }

    const archive = archiver('zip', { zlib: { level: 9 } })

    for (const render of renders) {
      const ext = path.extname(render.renderedImagePath) || '.png'
      archive.file(getRenderPath(render.renderedImagePath), { name: `${render.mockupTemplate.name}${ext}` })
    }

    archive.finalize()

    // Convert Node stream to Web ReadableStream
    const nodeStream = Readable.from(archive)
    const webStream = new ReadableStream({
      start(controller) {
        nodeStream.on('data', (chunk) => controller.enqueue(chunk))
        nodeStream.on('end', () => controller.close())
        nodeStream.on('error', (err) => controller.error(err))
      },
    })

    return new NextResponse(webStream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="mockups-${mockupSetId}.zip"`,
      },
    })
  } catch (err) {
    return handleAuthError(err)
  }
}
