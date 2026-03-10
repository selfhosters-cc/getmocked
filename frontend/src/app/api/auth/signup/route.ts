import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/server/prisma'
import { hashPassword } from '@/lib/server/auth-utils'
import { signToken } from '@/lib/server/jwt'

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password, name } = signupSchema.parse(body)

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    const passwordHash = await hashPassword(password)
    const user = await prisma.user.create({
      data: { email, passwordHash, name, authProvider: 'email' },
    })

    const token = signToken({ userId: user.id })
    const res = NextResponse.json(
      { user: { id: user.id, email: user.email, name: user.name } },
      { status: 201 }
    )
    res.cookies.set('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 })
    return res
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 })
    }
    console.error('Auth error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
