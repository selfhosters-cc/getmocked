import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, handleAuthError } from '@/lib/server/auth'

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
})

export async function GET() {
  try {
    const userId = await requireAuth()
    const sets = await prisma.mockupSet.findMany({
      where: { userId },
      include: { templates: { select: { id: true, name: true, sortOrder: true, templateImage: { select: { imagePath: true, thumbnailPath: true } } } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(sets)
  } catch (err) {
    return handleAuthError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireAuth()
    const body = await req.json()
    const data = createSchema.parse(body)
    const set = await prisma.mockupSet.create({
      data: { ...data, userId },
    })
    return NextResponse.json(set, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 })
    }
    return handleAuthError(err)
  }
}
