import sharp from 'sharp'
import path from 'path'
import fs from 'fs/promises'

const THUMB_SIZE = 400

function getThumbPath(originalPath: string): string {
  const ext = path.extname(originalPath)
  const base = originalPath.slice(0, -ext.length)
  return `${base}_thumb${ext}`
}

export async function generateThumbnail(
  uploadDir: string,
  relativePath: string
): Promise<string> {
  const absoluteOriginal = path.join(uploadDir, relativePath)
  const thumbRelative = getThumbPath(relativePath)
  const absoluteThumb = path.join(uploadDir, thumbRelative)

  // Skip if thumbnail already exists
  try {
    await fs.access(absoluteThumb)
    return thumbRelative
  } catch {
    // Doesn't exist, generate it
  }

  await sharp(absoluteOriginal)
    .rotate()
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'inside', withoutEnlargement: true })
    .toFile(absoluteThumb)

  return thumbRelative
}

export async function ensureThumbnail(
  uploadDir: string,
  relativePath: string
): Promise<string> {
  return generateThumbnail(uploadDir, relativePath)
}

export { getThumbPath }
