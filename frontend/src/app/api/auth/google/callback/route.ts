import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { signToken } from '@/lib/server/jwt'
import { tokenCookieOptions } from '@/lib/server/auth'

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
  const code = req.nextUrl.searchParams.get('code')
  if (!code) {
    return NextResponse.redirect(`${origin}/login`)
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!
  const callbackUrl = process.env.GOOGLE_CALLBACK_URL || `${origin}/api/auth/google/callback`

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      console.error('Google token exchange failed:', await tokenRes.text())
      return NextResponse.redirect(`${origin}/login`)
    }

    const tokens = await tokenRes.json()

    // Get user info
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })

    if (!userInfoRes.ok) {
      console.error('Google userinfo failed:', await userInfoRes.text())
      return NextResponse.redirect(`${origin}/login`)
    }

    const profile = await userInfoRes.json()
    const email = profile.email as string
    if (!email) {
      return NextResponse.redirect(`${origin}/login`)
    }

    // Find or create user
    let user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: profile.name || null,
          authProvider: 'google',
        },
      })
    }

    const token = signToken({ userId: user.id })
    const res = NextResponse.redirect(`${origin}/dashboard`)
    res.cookies.set('token', token, tokenCookieOptions())
    return res
  } catch (err) {
    console.error('Google OAuth error:', err)
    return NextResponse.redirect(`${origin}/login`)
  }
}
