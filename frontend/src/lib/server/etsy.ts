import crypto from 'crypto'

const ETSY_API_BASE = 'https://openapi.etsy.com/v3'
const ETSY_AUTH_URL = 'https://www.etsy.com/oauth/connect'
const ETSY_TOKEN_URL = 'https://api.etsy.com/v3/public/oauth/token'

export class EtsyApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public etsyError?: string,
  ) {
    super(message)
    this.name = 'EtsyApiError'
  }
}

export function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(32).toString('base64url')
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

export function getAuthUrl(codeChallenge: string, state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.ETSY_API_KEY!,
    redirect_uri: process.env.ETSY_REDIRECT_URI!,
    scope: 'listings_r listings_w',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })
  return `${ETSY_AUTH_URL}?${params.toString()}`
}

interface TokenResponse {
  accessToken: string
  refreshToken: string
  expiresAt: Date
}

export async function exchangeCode(code: string, codeVerifier: string): Promise<TokenResponse> {
  const res = await fetch(ETSY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.ETSY_API_KEY!,
      redirect_uri: process.env.ETSY_REDIRECT_URI!,
      code,
      code_verifier: codeVerifier,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new EtsyApiError('Failed to exchange auth code', res.status, err.error)
  }

  const data = await res.json()
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  }
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(ETSY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.ETSY_API_KEY!,
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new EtsyApiError('Failed to refresh token', res.status, err.error)
  }

  const data = await res.json()
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  }
}

async function etsyFetch(path: string, accessToken: string, options: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${ETSY_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'x-api-key': process.env.ETSY_API_KEY!,
      ...options.headers,
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new EtsyApiError(`Etsy API error: ${path}`, res.status, err.error || JSON.stringify(err))
  }

  return res
}

interface ShopInfo {
  shopId: string
  shopName: string
  etsyUserId: string
}

export async function getShopInfo(accessToken: string): Promise<ShopInfo> {
  const userRes = await etsyFetch('/application/users/me', accessToken)
  const userData = await userRes.json()
  const etsyUserId = String(userData.user_id)

  const shopRes = await etsyFetch(`/application/users/${etsyUserId}/shops`, accessToken)
  const shopData = await shopRes.json()

  if (!shopData.results || shopData.results.length === 0) {
    throw new EtsyApiError('No shop found for this Etsy account', 404)
  }

  const shop = shopData.results[0]
  return {
    shopId: String(shop.shop_id),
    shopName: shop.shop_name,
    etsyUserId,
  }
}

export interface EtsyListing {
  listingId: string
  title: string
  state: string
  thumbnailUrl: string | null
}

interface ListingsResponse {
  listings: EtsyListing[]
  totalCount: number
}

export async function getListings(
  accessToken: string,
  shopId: string,
  options: { limit?: number; offset?: number; keyword?: string } = {},
): Promise<ListingsResponse> {
  const params = new URLSearchParams({
    state: 'active',
    limit: String(options.limit || 25),
    offset: String(options.offset || 0),
    includes: 'images',
  })
  if (options.keyword) {
    params.set('keyword', options.keyword)
  }

  const res = await etsyFetch(
    `/application/shops/${shopId}/listings?${params.toString()}`,
    accessToken,
  )
  const data = await res.json()

  return {
    totalCount: data.count,
    listings: (data.results || []).map((l: Record<string, unknown>) => ({
      listingId: String(l.listing_id),
      title: l.title as string,
      state: l.state as string,
      thumbnailUrl: (l.images as Record<string, unknown>[])?.[0]?.url_170x135 as string || null,
    })),
  }
}

export async function getListingImageCount(accessToken: string, listingId: string): Promise<number> {
  const res = await etsyFetch(`/application/listings/${listingId}/images`, accessToken)
  const data = await res.json()
  return data.count
}

interface UploadResult {
  etsyImageId: string
}

export async function uploadListingImage(
  accessToken: string,
  shopId: string,
  listingId: string,
  imageBuffer: Buffer,
  filename: string,
): Promise<UploadResult> {
  const formData = new FormData()
  formData.append('image', new Blob([new Uint8Array(imageBuffer)]), filename)

  const res = await fetch(
    `${ETSY_API_BASE}/application/shops/${shopId}/listings/${listingId}/images`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-api-key': process.env.ETSY_API_KEY!,
      },
      body: formData,
    },
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new EtsyApiError(
      `Failed to upload image to listing ${listingId}`,
      res.status,
      err.error || JSON.stringify(err),
    )
  }

  const data = await res.json()
  return { etsyImageId: String(data.listing_image_id) }
}
