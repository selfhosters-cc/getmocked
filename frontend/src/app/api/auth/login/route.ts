import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/server/prisma'
import { comparePassword } from '@/lib/server/auth-utils'
import { signToken } from '@/lib/server/jwt'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password } = loginSchema.parse(body)

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const valid = await comparePassword(password, user.passwordHash)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const token = signToken({ userId: user.id })
    const res = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } })
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
