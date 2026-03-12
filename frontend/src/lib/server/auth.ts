import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { verifyToken } from './jwt'
import { prisma } from './prisma'

export async function getAuthUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return null
  try {
    const payload = verifyToken(token)
    return payload.userId
  } catch {
    return null
  }
}

export async function requireAuth(): Promise<string> {
  const userId = await getAuthUserId()
  if (!userId) {
    throw new AuthError('Not authenticated')
  }
  return userId
}

export async function requireAdmin(): Promise<string> {
  const userId = await requireAuth()
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } })
  if (!user?.isAdmin) {
    throw new AuthError('Not authorized')
  }
  return userId
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

export function handleAuthError(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: 401 })
  }
  throw err
}
