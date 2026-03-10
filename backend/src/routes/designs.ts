import { Router, Response } from 'express'
import multer from 'multer'
import { prisma } from '../lib/prisma.js'
import { requireAuth, AuthRequest } from '../middleware/auth.js'
import { saveUpload, deleteFile } from '../lib/storage.js'

const router = Router()
router.use(requireAuth)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

// List designs
router.get('/', async (req: AuthRequest, res: Response) => {
  const designs = await prisma.design.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: 'desc' },
  })
  res.json(designs)
})

// Upload design
router.post('/', upload.single('image'), async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'Image file required' })
    return
  }
  const imagePath = await saveUpload(req.file, `designs/${req.userId}`)
  const design = await prisma.design.create({
    data: {
      userId: req.userId!,
      name: req.body.name || req.file.originalname,
      imagePath,
    },
  })
  res.status(201).json(design)
})

// Delete design
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const design = await prisma.design.findFirst({ where: { id: req.params.id, userId: req.userId! } })
  if (!design) {
    res.status(404).json({ error: 'Not found' })
    return
  }
  await deleteFile(design.imagePath)
  await prisma.design.delete({ where: { id: design.id } })
  res.json({ ok: true })
})

export default router
