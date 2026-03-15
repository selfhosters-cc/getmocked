import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/server/auth'
import { prisma } from '@/lib/server/prisma'
import { getListings, EtsyApiError } from '@/lib/server/etsy'
import { getValidAccessToken } from '@/lib/server/etsy-connection'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let userId: string
  try {
    userId = await requireAuth()
  } catch (err) {
    return handleAuthError(err)
  }

  const { id } = await params
  const url = req.nextUrl
  const page = parseInt(url.searchParams.get('page') || '1', 10)
  const search = url.searchParams.get('search') || undefined
  const limit = 25

  const connection = await prisma.etsyConnection.findFirst({
    where: { id, userId },
  })

  if (!connection) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  }

  try {
    const accessToken = await getValidAccessToken(connection)
    const result = await getListings(accessToken, connection.shopId, {
      limit,
      offset: (page - 1) * limit,
      keyword: search,
    })

    return NextResponse.json({
      listings: result.listings,
      totalCount: result.totalCount,
      page,
      totalPages: Math.ceil(result.totalCount / limit),
    })
  } catch (err) {
    if (err instanceof EtsyApiError) {
      if (err.status === 401) {
        return NextResponse.json(
          { error: 'Etsy connection expired. Please reconnect your shop.' },
          { status: 401 },
        )
      }
      return NextResponse.json(
        { error: `Etsy API error: ${err.etsyError || err.message}` },
        { status: err.status >= 500 ? 502 : err.status },
      )
    }
    throw err
  }
}
