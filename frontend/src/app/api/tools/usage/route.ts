import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/server/prisma'
import { getAuthUserId } from '@/lib/server/auth'

const usageSchema = z.object({
  tool: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = usageSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'tool is required' }, { status: 400 })
  }

  const userId = await getAuthUserId()

  const usage = await prisma.toolUsage.create({
    data: { tool: parsed.data.tool, userId },
  })

  return NextResponse.json(usage, { status: 201 })
}
