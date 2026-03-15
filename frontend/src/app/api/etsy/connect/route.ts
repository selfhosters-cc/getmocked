import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/server/auth'
import { generatePKCE, getAuthUrl } from '@/lib/server/etsy'
import { randomUUID } from 'crypto'

export async function GET(req: NextRequest) {
  try {
    await requireAuth()
  } catch (err) {
    return handleAuthError(err)
  }

  const { verifier, challenge } = generatePKCE()
  const state = randomUUID()

  const authUrl = getAuthUrl(challenge, state)

  const res = NextResponse.redirect(authUrl)

  // Store verifier and state in short-lived cookies for the callback
  res.cookies.set('etsy_pkce_verifier', verifier, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600, // 10 minutes
    path: '/',
  })
  res.cookies.set('etsy_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600,
    path: '/',
  })

  return res
}
