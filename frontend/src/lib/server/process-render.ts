import { prisma } from '@/lib/server/prisma'
import { getUploadPath, getRenderPath } from '@/lib/server/storage'
import path from 'path'

const PROCESSING_URL = process.env.PROCESSING_URL || 'http://localhost:5000'

export interface RenderTemplate {
  id: string
  overlayConfig: unknown
  templateImage?: { id: string; imagePath: string; defaultMaskPath: string | null } | null
}

export interface RenderDesign {
  id: string
  imagePath: string
}

export interface RenderOptions {
  tintColor: string | null
  outputMode: string | null
  outputColor: string | null
}

export async function processRender(
  template: RenderTemplate,
  design: RenderDesign,
  renderId: string,
  renderOptions?: RenderOptions
) {
  await prisma.renderedMockup.update({ where: { id: renderId }, data: { status: 'processing' } })

  const imagePath = template.templateImage?.imagePath
  if (!imagePath) throw new Error('No image path available for template')

  // Merge render options into overlay config for processing service
  const overlayConfig = { ...(template.overlayConfig as Record<string, unknown>) }
  if (renderOptions?.tintColor) {
    overlayConfig.tintColor = renderOptions.tintColor
    const maskPath = template.templateImage?.defaultMaskPath
      ? getUploadPath(template.templateImage.defaultMaskPath)
      : getUploadPath(imagePath).replace(/\.[^.]+$/, '_mask.png')
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
      templateImagePath: getUploadPath(imagePath),
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
