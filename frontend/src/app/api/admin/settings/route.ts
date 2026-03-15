import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/server/prisma'
import { requireAdmin, handleAuthError } from '@/lib/server/auth'

const settingSchema = z.object({
  key: z.enum(['render_limit']),
  value: z.string().min(1),
})

export async function GET() {
  try {
    await requireAdmin()
    const settings = await prisma.systemSetting.findMany()
    return NextResponse.json({ settings })
  } catch (err) {
    return handleAuthError(err)
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json()
    const parsed = settingSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid setting' }, { status: 400 })
    }
    const { key, value } = parsed.data

    if (key === 'render_limit') {
      const num = parseInt(value, 10)
      if (isNaN(num) || num < 0) {
        return NextResponse.json({ error: 'Render limit must be a non-negative number' }, { status: 400 })
      }
    }

    const setting = await prisma.systemSetting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    })

    return NextResponse.json({ setting })
  } catch (err) {
    return handleAuthError(err)
  }
}
