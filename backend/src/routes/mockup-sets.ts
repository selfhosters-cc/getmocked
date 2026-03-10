import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth, AuthRequest } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
})

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
})

// List all sets for current user
router.get('/', async (req: AuthRequest, res: Response) => {
  const sets = await prisma.mockupSet.findMany({
    where: { userId: req.userId! },
    include: { templates: { select: { id: true, name: true, originalImagePath: true, sortOrder: true } } },
    orderBy: { createdAt: 'desc' },
  })
  res.json(sets)
})

// Get single set
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const set = await prisma.mockupSet.findFirst({
    where: { id: req.params.id, userId: req.userId! },
    include: { templates: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!set) {
    res.status(404).json({ error: 'Not found' })
    return
  }
  res.json(set)
})

// Create set
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = createSchema.parse(req.body)
    const set = await prisma.mockupSet.create({
      data: { ...data, userId: req.userId! },
    })
    res.status(201).json(set)
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Update set
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const data = updateSchema.parse(req.body)
    const set = await prisma.mockupSet.updateMany({
      where: { id: req.params.id, userId: req.userId! },
      data,
    })
    if (set.count === 0) {
      res.status(404).json({ error: 'Not found' })
      return
    }
    const updated = await prisma.mockupSet.findUnique({ where: { id: req.params.id } })
    res.json(updated)
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Delete set
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const result = await prisma.mockupSet.deleteMany({
    where: { id: req.params.id, userId: req.userId! },
  })
  if (result.count === 0) {
    res.status(404).json({ error: 'Not found' })
    return
  }
  res.json({ ok: true })
})

export default router
