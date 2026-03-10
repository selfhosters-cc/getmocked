import { Router, Response } from 'express'
import archiver from 'archiver'
import { prisma } from '../lib/prisma.js'
import { requireAuth, AuthRequest } from '../middleware/auth.js'
import { getUploadPath, getRenderPath } from '../lib/storage.js'
import path from 'path'

const PROCESSING_URL = process.env.PROCESSING_URL || 'http://localhost:5000'

const router = Router()
router.use(requireAuth)

// Trigger batch render: apply a design to all templates in a set
router.post('/batch', async (req: AuthRequest, res: Response) => {
  try {
    const { mockupSetId, designId } = req.body

    const set = await prisma.mockupSet.findFirst({
      where: { id: mockupSetId, userId: req.userId! },
      include: { templates: { orderBy: { sortOrder: 'asc' } } },
    })
    if (!set) {
      res.status(404).json({ error: 'Mockup set not found' })
      return
    }

    const design = await prisma.design.findFirst({ where: { id: designId, userId: req.userId! } })
    if (!design) {
      res.status(404).json({ error: 'Design not found' })
      return
    }

    // Create pending render records
    const renders = await Promise.all(
      set.templates.map((template) =>
        prisma.renderedMockup.create({
          data: {
            mockupTemplateId: template.id,
            designId: design.id,
            renderedImagePath: '',
            status: 'pending',
          },
        })
      )
    )

    // Fire off async render jobs to processing service
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

    res.status(202).json({ renders: renders.map((r) => ({ id: r.id, status: r.status })) })
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

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

// Get render status for a batch
router.get('/status', async (req: AuthRequest, res: Response) => {
  const { mockupSetId, designId } = req.query as { mockupSetId: string; designId: string }

  const renders = await prisma.renderedMockup.findMany({
    where: {
      designId,
      mockupTemplate: { mockupSetId, mockupSet: { userId: req.userId! } },
    },
    include: { mockupTemplate: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  })
  res.json(renders)
})

// Download single render
router.get('/:id/download', async (req: AuthRequest, res: Response) => {
  const render = await prisma.renderedMockup.findFirst({
    where: {
      id: req.params.id,
      mockupTemplate: { mockupSet: { userId: req.userId! } },
    },
  })
  if (!render || render.status !== 'complete') {
    res.status(404).json({ error: 'Render not found or not complete' })
    return
  }
  res.sendFile(getRenderPath(render.renderedImagePath))
})

// Download all renders as ZIP
router.get('/download-zip', async (req: AuthRequest, res: Response) => {
  const { mockupSetId, designId } = req.query as { mockupSetId: string; designId: string }

  const renders = await prisma.renderedMockup.findMany({
    where: {
      designId,
      status: 'complete',
      mockupTemplate: { mockupSetId, mockupSet: { userId: req.userId! } },
    },
    include: { mockupTemplate: { select: { name: true } } },
  })

  if (renders.length === 0) {
    res.status(404).json({ error: 'No completed renders found' })
    return
  }

  const archive = archiver('zip', { zlib: { level: 9 } })
  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', `attachment; filename="mockups-${mockupSetId}.zip"`)
  archive.pipe(res)

  for (const render of renders) {
    const ext = path.extname(render.renderedImagePath) || '.png'
    archive.file(getRenderPath(render.renderedImagePath), { name: `${render.mockupTemplate.name}${ext}` })
  }
  await archive.finalize()
})

export default router
