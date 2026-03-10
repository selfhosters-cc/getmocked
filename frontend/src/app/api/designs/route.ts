import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, handleAuthError } from '@/lib/server/auth'
import { saveUpload } from '@/lib/server/storage'

export async function GET() {
  try {
    const userId = await requireAuth()
    const designs = await prisma.design.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(designs)
  } catch (err) {
    return handleAuthError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireAuth()
    const formData = await req.formData()
    const file = formData.get('image') as File | null
    if (!file) {
      return NextResponse.json({ error: 'Image file required' }, { status: 400 })
    }

    const imagePath = await saveUpload(file, `designs/${userId}`)
    const design = await prisma.design.create({
      data: {
        userId,
        name: (formData.get('name') as string) || file.name,
        imagePath,
      },
    })
    return NextResponse.json(design, { status: 201 })
  } catch (err) {
    return handleAuthError(err)
  }
}
