import { NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { getAuthUserId } from '@/lib/server/auth'

export async function GET() {
  const userId = await getAuthUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 401 })
  }

  return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } })
}
