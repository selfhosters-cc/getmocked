import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { requireAdmin, handleAuthError } from '@/lib/server/auth'

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
    const { key, value } = await req.json()

    if (!key || value === undefined) {
      return NextResponse.json({ error: 'key and value are required' }, { status: 400 })
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
