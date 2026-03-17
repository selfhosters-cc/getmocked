import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/server/auth'
import { prisma } from '@/lib/server/prisma'

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
  if (!image) {
    return NextResponse.json({ error: 'Image required' }, { status: 400 })
  }

  const text = formData.get('text') as string | null
  const watermarkImage = formData.get('watermark_image') as File | null
  if (!text && !watermarkImage) {
    return NextResponse.json({ error: 'Provide text or watermark image' }, { status: 400 })
  }

  const proxyForm = new FormData()
  proxyForm.append('image', image)
  if (text) proxyForm.append('text', text)
  if (watermarkImage) proxyForm.append('watermark_image', watermarkImage)
  proxyForm.append('opacity', (formData.get('opacity') as string) || '50')
  proxyForm.append('position', (formData.get('position') as string) || 'center')
  proxyForm.append('font_size', (formData.get('font_size') as string) || '24')
  proxyForm.append('color', (formData.get('color') as string) || '#ffffff')

  const res = await fetch(`${PROCESSING_URL}/watermark`, {
    method: 'POST',
    body: proxyForm,
  })

  if (!res.ok) {
    const error = await res.text()
    return NextResponse.json({ error }, { status: res.status })
  }

  await prisma.toolUsage.create({ data: { tool: 'watermark', userId } })

  const blob = await res.blob()
  return new NextResponse(blob, {
    headers: { 'Content-Type': res.headers.get('Content-Type') || 'image/png' },
  })
}
