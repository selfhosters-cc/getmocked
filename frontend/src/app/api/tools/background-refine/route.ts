import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/server/auth'
import { prisma } from '@/lib/server/prisma'
import { validateToolUpload } from '@/lib/server/validate-tool-upload'

const PROCESSING_URL = process.env.PROCESSING_URL || 'http://processing:5000'

export async function POST(req: NextRequest) {
  let userId: string
  try {
    userId = await requireAuth()
  } catch (err) {
    return handleAuthError(err)
  }

  const formData = await req.formData()
  const image = formData.get('image') as File | null
  const mask = formData.get('mask') as File | null
  const strokes = formData.get('strokes') as string | null

  if (!image || !mask || !strokes) {
    return NextResponse.json({ error: 'Image, mask, and strokes required' }, { status: 400 })
  }

  const validationError = validateToolUpload(image)
  if (validationError) return validationError

  const proxyForm = new FormData()
  proxyForm.append('image', image)
  proxyForm.append('mask', mask)
  proxyForm.append('strokes', strokes)

  const res = await fetch(`${PROCESSING_URL}/background-refine`, {
    method: 'POST',
    body: proxyForm,
  })

  if (!res.ok) {
    const error = await res.text()
    return NextResponse.json({ error }, { status: res.status })
  }

  await prisma.toolUsage.create({ data: { tool: 'background-remove', userId } })

  const blob = await res.blob()
  const maskData = res.headers.get('X-Mask-Data')

  const response = new NextResponse(blob, {
    headers: { 'Content-Type': 'image/png' },
  })
  if (maskData) {
    response.headers.set('X-Mask-Data', maskData)
  }
  return response
}
