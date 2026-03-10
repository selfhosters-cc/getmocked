import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { hashPassword, comparePassword } from '../lib/auth-utils.js'
import { signToken } from '../lib/jwt.js'

const router = Router()

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = signupSchema.parse(req.body)

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      res.status(409).json({ error: 'Email already registered' })
      return
    }

    const passwordHash = await hashPassword(password)
    const user = await prisma.user.create({
      data: { email, passwordHash, name, authProvider: 'email' },
    })

    const token = signToken({ userId: user.id })
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 })
    res.status(201).json({ user: { id: user.id, email: user.email, name: user.name } })
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body)

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.passwordHash) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    const valid = await comparePassword(password, user.passwordHash)
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    const token = signToken({ userId: user.id })
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 })
    res.json({ user: { id: user.id, email: user.email, name: user.name } })
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('token')
  res.json({ ok: true })
})

router.get('/me', async (req: Request, res: Response) => {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }
  try {
    const { verifyToken } = await import('../lib/jwt.js')
    const payload = verifyToken(token)
    const user = await prisma.user.findUnique({ where: { id: payload.userId } })
    if (!user) {
      res.status(401).json({ error: 'User not found' })
      return
    }
    res.json({ user: { id: user.id, email: user.email, name: user.name } })
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
})

export default router
