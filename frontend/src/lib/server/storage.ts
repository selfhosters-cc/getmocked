import fs from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'
const RENDER_DIR = process.env.RENDER_DIR || './rendered'

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB
const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
])
const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'])

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true })
}

export async function saveUpload(file: File, subdir: string): Promise<string> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`)
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error(`Invalid file type "${file.type}". Allowed: ${[...ALLOWED_MIME_TYPES].join(', ')}`)
  }
  const ext = path.extname(file.name).toLowerCase()
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`Invalid file extension "${ext}". Allowed: ${[...ALLOWED_EXTENSIONS].join(', ')}`)
  }

  const dir = path.join(UPLOAD_DIR, subdir)
  await ensureDir(dir)
  const filename = `${randomUUID()}${ext}`
  const filepath = path.join(dir, filename)
  const buffer = Buffer.from(await file.arrayBuffer())
  await fs.writeFile(filepath, buffer)
  return path.join(subdir, filename)
}

export async function deleteFile(relativePath: string): Promise<void> {
  try {
    await fs.unlink(path.join(UPLOAD_DIR, relativePath))
  } catch { /* ignore if already deleted */ }
}

export function getUploadPath(relativePath: string): string {
  return path.join(UPLOAD_DIR, relativePath)
}

export function getRenderPath(relativePath: string): string {
  return path.join(RENDER_DIR, relativePath)
}
