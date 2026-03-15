import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import {
  generatePKCE,
  getAuthUrl,
  exchangeCode,
  refreshAccessToken,
  getShopInfo,
  getListings,
  getListingImageCount,
  uploadListingImage,
  EtsyApiError,
} from '@/lib/server/etsy'

describe('Etsy Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ETSY_API_KEY = 'test-api-key'
    process.env.ETSY_REDIRECT_URI = 'http://localhost:3335/api/etsy/callback'
  })

  describe('generatePKCE', () => {
    it('returns a verifier and challenge pair', () => {
      const { verifier, challenge } = generatePKCE()
      expect(verifier).toBeDefined()
      expect(verifier.length).toBeGreaterThanOrEqual(43)
      expect(challenge).toBeDefined()
      expect(challenge.length).toBeGreaterThan(0)
    })
  })

  describe('getAuthUrl', () => {
    it('builds the Etsy authorization URL with PKCE', () => {
      const url = getAuthUrl('test-challenge', 'test-state')
      expect(url).toContain('https://www.etsy.com/oauth/connect')
      expect(url).toContain('client_id=test-api-key')
      expect(url).toContain('code_challenge=test-challenge')
      expect(url).toContain('code_challenge_method=S256')
      expect(url).toContain('scope=listings_r+listings_w')
      expect(url).toContain('state=test-state')
    })
  })

  describe('exchangeCode', () => {
    it('exchanges auth code for tokens', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'access-123',
          refresh_token: 'refresh-456',
          expires_in: 3600,
        }),
      })

      const result = await exchangeCode('auth-code', 'verifier')
      expect(result.accessToken).toBe('access-123')
      expect(result.refreshToken).toBe('refresh-456')
      expect(result.expiresAt).toBeInstanceOf(Date)
    })

    it('throws EtsyApiError on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'invalid_grant' }),
      })

      await expect(exchangeCode('bad-code', 'verifier')).rejects.toThrow(EtsyApiError)
    })
  })

  describe('refreshAccessToken', () => {
    it('refreshes an expired token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          expires_in: 3600,
        }),
      })

      const result = await refreshAccessToken('old-refresh')
      expect(result.accessToken).toBe('new-access')
      expect(result.refreshToken).toBe('new-refresh')
    })
  })

  describe('getShopInfo', () => {
    it('fetches the authenticated user shop', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user_id: 12345 }),
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          count: 1,
          results: [{ shop_id: 67890, shop_name: 'TestShop' }],
        }),
      })

      const result = await getShopInfo('access-token')
      expect(result.shopId).toBe('67890')
      expect(result.shopName).toBe('TestShop')
      expect(result.etsyUserId).toBe('12345')
    })
  })

  describe('getListings', () => {
    it('fetches active listings with pagination', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          count: 50,
          results: [
            { listing_id: 1, title: 'Test Listing', state: 'active', images: [{ url_170x135: 'thumb.jpg' }] },
          ],
        }),
      })

      const result = await getListings('access-token', '67890', { limit: 25, offset: 0 })
      expect(result.totalCount).toBe(50)
      expect(result.listings).toHaveLength(1)
      expect(result.listings[0].title).toBe('Test Listing')
    })
  })

  describe('getListingImageCount', () => {
    it('returns the number of images on a listing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          count: 7,
          results: Array(7).fill({ listing_image_id: 1 }),
        }),
      })

      const count = await getListingImageCount('access-token', '12345')
      expect(count).toBe(7)
    })
  })

  describe('uploadListingImage', () => {
    it('uploads an image to a listing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          listing_image_id: 999,
        }),
      })

      const result = await uploadListingImage(
        'access-token',
        '67890',
        '12345',
        Buffer.from('fake-image'),
        'mockup.png',
      )
      expect(result.etsyImageId).toBe('999')
    })

    it('throws EtsyApiError on upload failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'image limit reached' }),
      })

      await expect(
        uploadListingImage('access-token', '67890', '12345', Buffer.from('fake'), 'test.png')
      ).rejects.toThrow(EtsyApiError)
    })
  })
})
