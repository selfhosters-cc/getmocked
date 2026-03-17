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

  const colors = formData.get('colors') as string | null
  if (!colors) {
    return NextResponse.json({ error: 'Colors required' }, { status: 400 })
  }

  const proxyForm = new FormData()
  proxyForm.append('image', image)
  proxyForm.append('colors', colors)

  const res = await fetch(`${PROCESSING_URL}/color-variants`, {
    method: 'POST',
    body: proxyForm,
  })

  if (!res.ok) {
    const error = await res.text()
    return NextResponse.json({ error }, { status: res.status })
  }

  await prisma.toolUsage.create({ data: { tool: 'color-variants', userId } })

  const blob = await res.blob()
  return new NextResponse(blob, {
    headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/zip' },
  })
}
