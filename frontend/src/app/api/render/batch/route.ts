import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, handleAuthError } from '@/lib/server/auth'
import { getUploadPath, getRenderPath } from '@/lib/server/storage'
import path from 'path'

const PROCESSING_URL = process.env.PROCESSING_URL || 'http://localhost:5000'

export async function POST(req: NextRequest) {
  try {
    const userId = await requireAuth()
    const { mockupSetId, designId } = await req.json()

    const set = await prisma.mockupSet.findFirst({
      where: { id: mockupSetId, userId },
      include: { templates: { orderBy: { sortOrder: 'asc' } } },
    })
    if (!set) {
      return NextResponse.json({ error: 'Mockup set not found' }, { status: 404 })
    }

    const design = await prisma.design.findFirst({ where: { id: designId, userId } })
    if (!design) {
      return NextResponse.json({ error: 'Design not found' }, { status: 404 })
    }

    // Create batch record
    const batch = await prisma.renderBatch.create({
      data: { userId, mockupSetId, designId },
    })

    const renders = await Promise.all(
      set.templates.map((template) =>
        prisma.renderedMockup.create({
          data: {
            mockupTemplateId: template.id,
            designId: design.id,
            batchId: batch.id,
            renderedImagePath: '',
            status: 'pending',
          },
        })
      )
    )

    for (const [i, template] of set.templates.entries()) {
      const render = renders[i]
      processRender(template, design, render.id).catch(async (err) => {
        console.error(`Render failed for ${render.id}:`, err)
        await prisma.renderedMockup.update({
          where: { id: render.id },
          data: { status: 'failed' },
        })
      })
    }

    return NextResponse.json(
      { batchId: batch.id, renders: renders.map((r) => ({ id: r.id, status: r.status })) },
      { status: 202 }
    )
  } catch (err) {
    return handleAuthError(err)
  }
}

async function processRender(
  template: { id: string; originalImagePath: string; overlayConfig: unknown },
  design: { id: string; imagePath: string },
  renderId: string
) {
  await prisma.renderedMockup.update({ where: { id: renderId }, data: { status: 'processing' } })

  const response = await fetch(`${PROCESSING_URL}/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      templateImagePath: getUploadPath(template.originalImagePath),
      designImagePath: getUploadPath(design.imagePath),
      overlayConfig: template.overlayConfig,
      outputDir: getRenderPath(`${design.id}`),
      renderId,
    }),
  })

  if (!response.ok) throw new Error(`Processing service returned ${response.status}`)

  const result = (await response.json()) as { outputPath: string }
  const relativePath = path.relative(process.env.RENDER_DIR || './rendered', result.outputPath)
  await prisma.renderedMockup.update({
    where: { id: renderId },
    data: { status: 'complete', renderedImagePath: relativePath },
  })
}
