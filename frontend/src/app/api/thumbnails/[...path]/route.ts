import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { ensureThumbnail } from '@/lib/server/thumbnails'
import { prisma } from '@/lib/server/prisma'

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const segments = (await params).path
  const relativePath = segments.join('/')

  // Path traversal protection
  const absolutePath = path.resolve(UPLOAD_DIR, relativePath)
  if (!absolutePath.startsWith(path.resolve(UPLOAD_DIR))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Check if the original file exists
  try {
    await fs.access(absolutePath)
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Generate thumbnail if needed
  let thumbRelative: string
  try {
    thumbRelative = await ensureThumbnail(UPLOAD_DIR, relativePath)
  } catch {
    // Fall back to original
    thumbRelative = relativePath
  }

  const thumbAbsolute = path.join(UPLOAD_DIR, thumbRelative)

  // Update DB record if we generated a new thumbnail
  if (thumbRelative !== relativePath) {
    await prisma.templateImage.updateMany({
      where: { imagePath: relativePath, thumbnailPath: null },
      data: { thumbnailPath: thumbRelative },
    }).catch(() => {
      // Non-critical, ignore
    })
  }

  const ext = path.extname(thumbAbsolute).toLowerCase()
  const contentType = MIME_TYPES[ext] || 'application/octet-stream'

  const buffer = await fs.readFile(thumbAbsolute)
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
