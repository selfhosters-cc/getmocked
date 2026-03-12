import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { requireAdmin, handleAuthError } from '@/lib/server/auth'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireAdmin()
    const { id } = await params
    const body = await req.json()

    const tag = await prisma.tag.findUnique({ where: { id } })
    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (body.name) data.name = body.name.toLowerCase().trim()
    if (body.archive) data.archivedAt = new Date()
    if (body.archive === false) data.archivedAt = null

    const updated = await prisma.tag.update({ where: { id }, data })
    return NextResponse.json(updated)
  } catch (err) {
    return handleAuthError(err)
  }
}
