import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, handleAuthError } from '@/lib/server/auth'
import { getUploadPath } from '@/lib/server/storage'

const PROCESSING_URL = process.env.PROCESSING_URL || 'http://localhost:5000'

type Params = { params: Promise<{ id: string; templateId: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const userId = await requireAuth()
    const { id: setId, templateId } = await params

    const set = await prisma.mockupSet.findFirst({ where: { id: setId, userId } })
    if (!set) return NextResponse.json({ error: 'Set not found' }, { status: 404 })

    const template = await prisma.mockupTemplate.findFirst({
      where: { id: templateId, mockupSetId: setId },
    })
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

    const imagePath = getUploadPath(template.originalImagePath)
    const response = await fetch(`${PROCESSING_URL}/detect-mask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imagePath }),
    })

    if (!response.ok) throw new Error(`Processing service returned ${response.status}`)
    const result = await response.json()
    return NextResponse.json(result)
  } catch (err) {
    return handleAuthError(err)
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const userId = await requireAuth()
    const { id: setId, templateId } = await params

    const set = await prisma.mockupSet.findFirst({ where: { id: setId, userId } })
    if (!set) return NextResponse.json({ error: 'Set not found' }, { status: 404 })

    const template = await prisma.mockupTemplate.findFirst({
      where: { id: templateId, mockupSetId: setId },
    })
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

    const { maskPath, strokes } = await req.json()
    const response = await fetch(`${PROCESSING_URL}/refine-mask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imagePath: getUploadPath(template.originalImagePath), maskPath, strokes }),
    })

    if (!response.ok) throw new Error(`Processing service returned ${response.status}`)
    const result = await response.json()
    return NextResponse.json(result)
  } catch (err) {
    return handleAuthError(err)
  }
}
