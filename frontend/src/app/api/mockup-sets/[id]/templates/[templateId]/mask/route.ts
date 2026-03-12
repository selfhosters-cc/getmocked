import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, handleAuthError } from '@/lib/server/auth'
import { getUploadPath } from '@/lib/server/storage'

const PROCESSING_URL = process.env.PROCESSING_URL || 'http://localhost:5000'
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'

type Params = { params: Promise<{ id: string; templateId: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const userId = await requireAuth()
    const { id: setId, templateId } = await params

    const set = await prisma.mockupSet.findFirst({ where: { id: setId, userId } })
    if (!set) return NextResponse.json({ error: 'Set not found' }, { status: 404 })

    const template = await prisma.mockupTemplate.findFirst({
      where: { id: templateId, mockupSetId: setId },
      include: { templateImage: true },
    })
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

    if (!template.templateImage) return NextResponse.json({ error: 'No image linked' }, { status: 400 })
    const imagePath = getUploadPath(template.templateImage.imagePath)
    const response = await fetch(`${PROCESSING_URL}/detect-mask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imagePath }),
    })

    if (!response.ok) throw new Error(`Processing service returned ${response.status}`)
    const result = await response.json()
    if (result.maskPath) {
      const uploadDir = path.resolve(UPLOAD_DIR)
      const absPath = path.resolve(result.maskPath)
      result.maskPath = path.relative(uploadDir, absPath)
    }
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
      include: { templateImage: true },
    })
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

    if (!template.templateImage) return NextResponse.json({ error: 'No image linked' }, { status: 400 })

    const { maskPath, strokes } = await req.json()
    const absMaskPath = path.join(path.resolve(UPLOAD_DIR), maskPath)
    const response = await fetch(`${PROCESSING_URL}/refine-mask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imagePath: getUploadPath(template.templateImage.imagePath), maskPath: absMaskPath, strokes }),
    })

    if (!response.ok) throw new Error(`Processing service returned ${response.status}`)
    const result = await response.json()
    if (result.maskPath) {
      const uploadDir = path.resolve(UPLOAD_DIR)
      const absPath = path.resolve(result.maskPath)
      result.maskPath = path.relative(uploadDir, absPath)
    }
    return NextResponse.json(result)
  } catch (err) {
    return handleAuthError(err)
  }
}
