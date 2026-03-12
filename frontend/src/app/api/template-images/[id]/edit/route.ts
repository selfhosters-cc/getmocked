import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import path from 'path'
import { randomUUID } from 'crypto'
import fs from 'fs/promises'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, handleAuthError } from '@/lib/server/auth'
import { generateThumbnail } from '@/lib/server/thumbnails'

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const userId = await requireAuth()
    const { id } = await params

    const image = await prisma.templateImage.findFirst({
      where: {
        id,
        archivedAt: null,
        OR: [{ userId }, { userId: null }],
      },
    })
    if (!image) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await req.json()
    const rotation: number = body.rotation || 0
    const crop: { x: number; y: number; width: number; height: number } | null = body.crop || null

    if (![0, 90, 180, 270].includes(rotation) && !crop) {
      return NextResponse.json({ error: 'No edits specified' }, { status: 400 })
    }

    const originalPath = path.join(UPLOAD_DIR, image.imagePath)
    let pipeline = sharp(originalPath)

    if (rotation) {
      pipeline = pipeline.rotate(rotation)
    }

    if (crop) {
      pipeline = pipeline.extract({
        left: Math.round(crop.x),
        top: Math.round(crop.y),
        width: Math.round(crop.width),
        height: Math.round(crop.height),
      })
    }

    // Save as new file (copy-on-edit)
    const ext = path.extname(image.imagePath)
    const newFilename = `${randomUUID()}${ext}`
    const subdir = path.dirname(image.imagePath)
    const newRelativePath = path.join(subdir, newFilename)
    const newAbsolutePath = path.join(UPLOAD_DIR, newRelativePath)

    await fs.mkdir(path.dirname(newAbsolutePath), { recursive: true })
    await pipeline.toFile(newAbsolutePath)

    // Generate thumbnail
    let thumbnailPath: string | null = null
    try {
      thumbnailPath = await generateThumbnail(UPLOAD_DIR, newRelativePath)
    } catch { /* lazy fallback */ }

    // Create a new TemplateImage (original stays untouched)
    const newImage = await prisma.templateImage.create({
      data: {
        userId,
        name: `${image.name} (edited)`,
        imagePath: newRelativePath,
        thumbnailPath,
      },
    })

    return NextResponse.json(newImage)
  } catch (err) {
    return handleAuthError(err)
  }
}
