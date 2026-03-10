import { Router, Response } from 'express'
import { z } from 'zod'
import multer from 'multer'
import { prisma } from '../lib/prisma.js'
import { requireAuth, AuthRequest } from '../middleware/auth.js'
import { saveUpload, deleteFile } from '../lib/storage.js'

const router = Router()
router.use(requireAuth)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

const overlayConfigSchema = z.object({
  corners: z.array(z.object({ x: z.number(), y: z.number() })).length(4),
  displacementIntensity: z.number().min(0).max(1).default(0.5),
  textureData: z.any().optional(),
  mode: z.enum(['advanced', 'basic']).default('advanced'),
  rotation: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
})

// Upload product photo to create a template
router.post('/:setId/templates', upload.single('image'), async (req: AuthRequest, res: Response) => {
  try {
    const set = await prisma.mockupSet.findFirst({ where: { id: req.params.setId, userId: req.userId! } })
    if (!set) {
      res.status(404).json({ error: 'Set not found' })
      return
    }
    if (!req.file) {
      res.status(400).json({ error: 'Image file required' })
      return
    }

    const imagePath = await saveUpload(req.file, `templates/${set.id}`)
    const count = await prisma.mockupTemplate.count({ where: { mockupSetId: set.id } })

    const template = await prisma.mockupTemplate.create({
      data: {
        mockupSetId: set.id,
        name: req.body.name || req.file.originalname,
        originalImagePath: imagePath,
        sortOrder: count,
      },
    })
    res.status(201).json(template)
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Update overlay config for a template
router.patch('/:setId/templates/:templateId', async (req: AuthRequest, res: Response) => {
  try {
    const set = await prisma.mockupSet.findFirst({ where: { id: req.params.setId, userId: req.userId! } })
    if (!set) {
      res.status(404).json({ error: 'Set not found' })
      return
    }

    const data: Record<string, unknown> = {}
    if (req.body.name) data.name = req.body.name
    if (req.body.sortOrder !== undefined) data.sortOrder = req.body.sortOrder
    if (req.body.overlayConfig) {
      data.overlayConfig = overlayConfigSchema.parse(req.body.overlayConfig)
    }

    const template = await prisma.mockupTemplate.updateMany({
      where: { id: req.params.templateId, mockupSetId: set.id },
      data,
    })
    if (template.count === 0) {
      res.status(404).json({ error: 'Template not found' })
      return
    }
    const updated = await prisma.mockupTemplate.findUnique({ where: { id: req.params.templateId } })
    res.json(updated)
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Delete template
router.delete('/:setId/templates/:templateId', async (req: AuthRequest, res: Response) => {
  const set = await prisma.mockupSet.findFirst({ where: { id: req.params.setId, userId: req.userId! } })
  if (!set) {
    res.status(404).json({ error: 'Set not found' })
    return
  }

  const template = await prisma.mockupTemplate.findFirst({
    where: { id: req.params.templateId, mockupSetId: set.id },
  })
  if (!template) {
    res.status(404).json({ error: 'Template not found' })
    return
  }

  await deleteFile(template.originalImagePath)
  await prisma.mockupTemplate.delete({ where: { id: template.id } })
  res.json({ ok: true })
})

// Serve uploaded images
router.get('/uploads/*', async (req: AuthRequest, res: Response) => {
  const filePath = req.params[0]
  const { getUploadPath } = await import('../lib/storage.js')
  res.sendFile(getUploadPath(filePath), { root: '/' })
})

export default router
