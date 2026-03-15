import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { requireAuth, handleAuthError } from '@/lib/server/auth'
import { prisma } from '@/lib/server/prisma'
import { getListingImageCount, uploadListingImage, EtsyApiError } from '@/lib/server/etsy'
import { getValidAccessToken } from '@/lib/server/etsy-connection'
import { getRenderPath } from '@/lib/server/storage'

const ETSY_MAX_IMAGES = 10

export async function POST(req: NextRequest) {
  let userId: string
  try {
    userId = await requireAuth()
  } catch (err) {
    return handleAuthError(err)
  }

  const body = await req.json()
  const { etsyConnectionId, etsyListingId, renderedMockupId } = body

  if (!etsyConnectionId || !etsyListingId || !renderedMockupId) {
    return NextResponse.json(
      { error: 'Missing required fields: etsyConnectionId, etsyListingId, renderedMockupId' },
      { status: 400 },
    )
  }

  // Verify connection ownership
  const connection = await prisma.etsyConnection.findFirst({
    where: { id: etsyConnectionId, userId },
  })
  if (!connection) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  }

  // Verify render ownership through relation chain
  const render = await prisma.renderedMockup.findFirst({
    where: {
      id: renderedMockupId,
      mockupTemplate: { mockupSet: { userId } },
    },
  })
  if (!render) {
    return NextResponse.json({ error: 'Render not found' }, { status: 404 })
  }

  // Check for existing upload (duplicate detection)
  const existingUpload = await prisma.etsyUpload.findFirst({
    where: {
      etsyConnectionId,
      renderedMockupId,
      etsyListingId,
      status: 'complete',
    },
  })
  if (existingUpload) {
    return NextResponse.json({
      id: existingUpload.id,
      status: 'already_uploaded',
      etsyImageId: existingUpload.etsyImageId,
      message: 'This render has already been uploaded to this listing',
    })
  }

  // Create upload record
  const upload = await prisma.etsyUpload.create({
    data: {
      etsyConnectionId,
      renderedMockupId,
      etsyListingId,
      status: 'pending',
    },
  })

  try {
    const accessToken = await getValidAccessToken(connection)

    // Pre-check slot availability
    const imageCount = await getListingImageCount(accessToken, etsyListingId)
    if (imageCount >= ETSY_MAX_IMAGES) {
      await prisma.etsyUpload.update({
        where: { id: upload.id },
        data: { status: 'failed', errorMessage: `Listing already has ${imageCount}/${ETSY_MAX_IMAGES} images` },
      })
      return NextResponse.json(
        { id: upload.id, status: 'failed', error: `Listing already has ${imageCount}/${ETSY_MAX_IMAGES} images. Remove some photos to make room.` },
        { status: 400 },
      )
    }

    // Read rendered image from disk
    const imagePath = getRenderPath(render.renderedImagePath)
    let imageBuffer: Buffer
    try {
      imageBuffer = await fs.readFile(imagePath)
    } catch {
      await prisma.etsyUpload.update({
        where: { id: upload.id },
        data: { status: 'failed', errorMessage: 'Rendered image file not found on disk' },
      })
      return NextResponse.json(
        { id: upload.id, status: 'failed', error: 'Rendered image file not found' },
        { status: 404 },
      )
    }

    // Upload to Etsy
    const filename = path.basename(render.renderedImagePath)
    const result = await uploadListingImage(
      accessToken,
      connection.shopId,
      etsyListingId,
      imageBuffer,
      filename,
    )

    // Mark as complete
    await prisma.etsyUpload.update({
      where: { id: upload.id },
      data: { status: 'complete', etsyImageId: result.etsyImageId },
    })

    return NextResponse.json({
      id: upload.id,
      status: 'complete',
      etsyImageId: result.etsyImageId,
    })
  } catch (err) {
    const errorMessage = err instanceof EtsyApiError
      ? `Etsy API error (${err.status}): ${err.etsyError || err.message}`
      : err instanceof Error ? err.message : 'Unknown error'

    await prisma.etsyUpload.update({
      where: { id: upload.id },
      data: { status: 'failed', errorMessage },
    })

    const status = err instanceof EtsyApiError && err.status === 429 ? 429 : 500
    return NextResponse.json(
      { id: upload.id, status: 'failed', error: errorMessage },
      { status },
    )
  }
}
