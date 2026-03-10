import fs from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'
const RENDER_DIR = process.env.RENDER_DIR || './rendered'

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true })
}

export async function saveUpload(file: Express.Multer.File, subdir: string): Promise<string> {
  const dir = path.join(UPLOAD_DIR, subdir)
  await ensureDir(dir)
  const ext = path.extname(file.originalname)
  const filename = `${randomUUID()}${ext}`
  const filepath = path.join(dir, filename)
  await fs.writeFile(filepath, file.buffer)
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
