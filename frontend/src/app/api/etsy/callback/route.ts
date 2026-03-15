import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/auth'
import { exchangeCode, getShopInfo } from '@/lib/server/etsy'
import { prisma } from '@/lib/server/prisma'

function getOrigin(req: NextRequest): string {
  const forwardedHost = req.headers.get('x-forwarded-host')
  const forwardedProto = req.headers.get('x-forwarded-proto') || 'https'
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`
  const host = req.headers.get('host')
  if (host) return `${forwardedProto}://${host}`
  return req.nextUrl.origin
}

export async function GET(req: NextRequest) {
  const origin = getOrigin(req)

  let userId: string
  try {
    userId = await requireAuth()
  } catch {
    return NextResponse.redirect(`${origin}/login`)
  }

  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const storedState = req.cookies.get('etsy_oauth_state')?.value
  const verifier = req.cookies.get('etsy_pkce_verifier')?.value

  // Validate state parameter
  if (!code || !state || !verifier || state !== storedState) {
    return NextResponse.redirect(`${origin}/connections?error=invalid_state`)
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCode(code, verifier)

    // Get shop info
    const shopInfo = await getShopInfo(tokens.accessToken)

    // Check if this shop is already connected for this user
    const existing = await prisma.etsyConnection.findFirst({
      where: { userId, shopId: shopInfo.shopId },
    })

    if (existing) {
      // Update existing connection with fresh tokens
      await prisma.etsyConnection.update({
        where: { id: existing.id },
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt: tokens.expiresAt,
          shopName: shopInfo.shopName,
        },
      })
    } else {
      // Create new connection
      await prisma.etsyConnection.create({
        data: {
          userId,
          shopId: shopInfo.shopId,
          shopName: shopInfo.shopName,
          etsyUserId: shopInfo.etsyUserId,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt: tokens.expiresAt,
        },
      })
    }

    // Clear OAuth cookies and redirect
    const res = NextResponse.redirect(`${origin}/connections?success=connected`)
    res.cookies.delete('etsy_pkce_verifier')
    res.cookies.delete('etsy_oauth_state')
    return res
  } catch (err) {
    console.error('Etsy OAuth callback error:', err)
    const res = NextResponse.redirect(`${origin}/connections?error=oauth_failed`)
    res.cookies.delete('etsy_pkce_verifier')
    res.cookies.delete('etsy_oauth_state')
    return res
  }
}
