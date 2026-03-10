import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, handleAuthError } from '@/lib/server/auth'
import { saveUpload } from '@/lib/server/storage'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireAuth()
    const { id: setId } = await params

    const set = await prisma.mockupSet.findFirst({ where: { id: setId, userId } })
    if (!set) {
      return NextResponse.json({ error: 'Set not found' }, { status: 404 })
    }

    const formData = await req.formData()
    const file = formData.get('image') as File | null
    if (!file) {
      return NextResponse.json({ error: 'Image file required' }, { status: 400 })
    }

    const imagePath = await saveUpload(file, `templates/${set.id}`)
    const count = await prisma.mockupTemplate.count({ where: { mockupSetId: set.id } })

    const template = await prisma.mockupTemplate.create({
      data: {
        mockupSetId: set.id,
        name: (formData.get('name') as string) || file.name,
        originalImagePath: imagePath,
        sortOrder: count,
      },
    })
    return NextResponse.json(template, { status: 201 })
  } catch (err) {
    return handleAuthError(err)
  }
}
