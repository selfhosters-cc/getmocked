import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, handleAuthError } from '@/lib/server/auth'
import { getUploadPath, getRenderPath } from '@/lib/server/storage'
import path from 'path'

const PROCESSING_URL = process.env.PROCESSING_URL || 'http://localhost:5000'

export async function POST(req: NextRequest) {
  try {
    const userId = await requireAuth()
    const { mockupSetId, designId, colorVariants, outputMode, outputColor, description } = await req.json()

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
      data: { userId, mockupSetId, designId, description: description || null },
    })

    // Build color combinations: each entry is a tintColor or null (original)
    const colors: (string | null)[] =
      Array.isArray(colorVariants) && colorVariants.length > 0 ? colorVariants : [null]

    // Create renders for each template × color combination
    const renderItems: { template: (typeof set.templates)[number]; tintColor: string | null }[] =
      set.templates.flatMap((template) => colors.map((tintColor) => ({ template, tintColor })))

    const renders = await Promise.all(
      renderItems.map(({ template, tintColor }) => {
        const renderOptions = { tintColor, outputMode: outputMode || null, outputColor: outputColor || null }
        return prisma.renderedMockup.create({
          data: {
            mockupTemplateId: template.id,
            designId: design.id,
            batchId: batch.id,
            renderedImagePath: '',
            status: 'pending',
            renderOptions,
          },
        })
      })
    )

    for (const [i, { template, tintColor }] of renderItems.entries()) {
      const render = renders[i]
      const renderOptions = { tintColor, outputMode: outputMode || null, outputColor: outputColor || null }
      processRender(template, design, render.id, renderOptions).catch(async (err) => {
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
  renderId: string,
  renderOptions?: { tintColor: string | null; outputMode: string | null; outputColor: string | null }
) {
  await prisma.renderedMockup.update({ where: { id: renderId }, data: { status: 'processing' } })

  // Merge render options into overlay config for processing service
  const overlayConfig = { ...(template.overlayConfig as Record<string, unknown>) }
  if (renderOptions?.tintColor) {
    overlayConfig.tintColor = renderOptions.tintColor
    // Derive mask path from template image path (replace extension with _mask.png)
    const templatePath = getUploadPath(template.originalImagePath)
    const maskPath = templatePath.replace(/\.[^.]+$/, '_mask.png')
    overlayConfig.maskPath = maskPath
  }
  if (renderOptions?.outputMode) {
    overlayConfig.outputMode = renderOptions.outputMode
  }
  if (renderOptions?.outputColor) {
    overlayConfig.outputColor = renderOptions.outputColor
  }

  const response = await fetch(`${PROCESSING_URL}/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      templateImagePath: getUploadPath(template.originalImagePath),
      designImagePath: getUploadPath(design.imagePath),
      overlayConfig,
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
