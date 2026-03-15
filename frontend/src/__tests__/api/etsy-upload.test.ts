import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ cookies: vi.fn() }))

const mockVerifyToken = vi.fn()
const mockConnectionFindFirst = vi.fn()
const mockRenderFindFirst = vi.fn()
const mockUploadCreate = vi.fn()
const mockUploadUpdate = vi.fn()
const mockUploadFindFirst = vi.fn()

vi.mock('@/lib/server/jwt', () => ({
  verifyToken: (...args: unknown[]) => mockVerifyToken(...args),
}))
vi.mock('@/lib/server/prisma', () => ({
  prisma: {
    etsyConnection: { findFirst: (...args: unknown[]) => mockConnectionFindFirst(...args) },
    renderedMockup: { findFirst: (...args: unknown[]) => mockRenderFindFirst(...args) },
    etsyUpload: {
      findFirst: (...args: unknown[]) => mockUploadFindFirst(...args),
      create: (...args: unknown[]) => mockUploadCreate(...args),
      update: (...args: unknown[]) => mockUploadUpdate(...args),
    },
  },
}))

const mockGetValidAccessToken = vi.fn()
vi.mock('@/lib/server/etsy-connection', () => ({
  getValidAccessToken: (...args: unknown[]) => mockGetValidAccessToken(...args),
}))

const mockGetListingImageCount = vi.fn()
const mockUploadListingImage = vi.fn()
vi.mock('@/lib/server/etsy', () => ({
  getListingImageCount: (...args: unknown[]) => mockGetListingImageCount(...args),
  uploadListingImage: (...args: unknown[]) => mockUploadListingImage(...args),
  EtsyApiError: class extends Error {
    constructor(m: string, public status: number, public etsyError?: string) { super(m); this.name = 'EtsyApiError' }
  },
}))

vi.mock('fs/promises', () => ({
  default: { readFile: vi.fn().mockResolvedValue(Buffer.from('fake-image-data')) },
}))

vi.mock('@/lib/server/storage', () => ({
  getRenderPath: (p: string) => `/app/rendered/${p}`,
}))

import { cookies } from 'next/headers'

function authed() {
  ;(cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    get: () => ({ value: 'token' }),
  })
  mockVerifyToken.mockReturnValue({ userId: 'user-1' })
}

describe('POST /api/etsy/upload', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 400 when listing is full', async () => {
    authed()
    mockConnectionFindFirst.mockResolvedValue({ id: 'conn-1', userId: 'user-1', shopId: '123' })
    mockRenderFindFirst.mockResolvedValue({
      id: 'render-1',
      renderedImagePath: 'output/test.png',
      mockupTemplate: { mockupSet: { userId: 'user-1' } },
    })
    mockUploadFindFirst.mockResolvedValue(null)
    mockUploadCreate.mockResolvedValue({ id: 'upload-1' })
    mockUploadUpdate.mockResolvedValue({})
    mockGetValidAccessToken.mockResolvedValue('access-token')
    mockGetListingImageCount.mockResolvedValue(10)

    const { POST } = await import('@/app/api/etsy/upload/route')
    const req = new Request('http://localhost/api/etsy/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        etsyConnectionId: 'conn-1',
        etsyListingId: '456',
        renderedMockupId: 'render-1',
      }),
    })
    const res = await POST(req as any)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('10')
  })

  it('returns 400 when missing required fields', async () => {
    authed()

    const { POST } = await import('@/app/api/etsy/upload/route')
    const req = new Request('http://localhost/api/etsy/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ etsyConnectionId: 'conn-1' }),
    })
    const res = await POST(req as any)

    expect(res.status).toBe(400)
  })

  it('detects duplicate uploads', async () => {
    authed()
    mockConnectionFindFirst.mockResolvedValue({ id: 'conn-1', userId: 'user-1', shopId: '123' })
    mockRenderFindFirst.mockResolvedValue({
      id: 'render-1',
      renderedImagePath: 'output/test.png',
    })
    mockUploadFindFirst.mockResolvedValue({
      id: 'existing-upload',
      etsyImageId: 'img-123',
      status: 'complete',
    })

    const { POST } = await import('@/app/api/etsy/upload/route')
    const req = new Request('http://localhost/api/etsy/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        etsyConnectionId: 'conn-1',
        etsyListingId: '456',
        renderedMockupId: 'render-1',
      }),
    })
    const res = await POST(req as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.status).toBe('already_uploaded')
  })

  it('returns 401 when not authenticated', async () => {
    ;(cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      get: () => undefined,
    })

    const { POST } = await import('@/app/api/etsy/upload/route')
    const req = new Request('http://localhost/api/etsy/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const res = await POST(req as any)

    expect(res.status).toBe(401)
  })
})
