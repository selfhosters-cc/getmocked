import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ cookies: vi.fn() }))

const mockFindMany = vi.fn()
const mockVerifyToken = vi.fn()

vi.mock('@/lib/server/prisma', () => ({
  prisma: {
    tag: { findMany: (...args: unknown[]) => mockFindMany(...args) },
  },
}))
vi.mock('@/lib/server/jwt', () => ({
  verifyToken: (...args: unknown[]) => mockVerifyToken(...args),
}))

import { cookies } from 'next/headers'

describe('GET /api/tags', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns tags with usage counts', async () => {
    ;(cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      get: () => ({ value: 'token' }),
    })
    mockVerifyToken.mockReturnValue({ userId: 'user-1' })
    mockFindMany.mockResolvedValue([
      { id: 'tag-1', name: 'bella canvas', _count: { images: 5 }, createdAt: new Date() },
      { id: 'tag-2', name: 'mug', _count: { images: 3 }, createdAt: new Date() },
    ])

    const { GET } = await import('@/app/api/tags/route')
    const req = new Request('http://localhost/api/tags')
    const res = await GET(req as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.tags).toHaveLength(2)
    expect(body.tags[0]).toHaveProperty('usageCount')
  })

  it('filters by search param', async () => {
    ;(cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      get: () => ({ value: 'token' }),
    })
    mockVerifyToken.mockReturnValue({ userId: 'user-1' })
    mockFindMany.mockResolvedValue([
      { id: 'tag-1', name: 'bella canvas', _count: { images: 5 }, createdAt: new Date() },
    ])

    const { GET } = await import('@/app/api/tags/route')
    const req = new Request('http://localhost/api/tags?search=bella')
    const res = await GET(req as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.tags).toHaveLength(1)
  })

  it('returns 401 when not authenticated', async () => {
    ;(cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      get: () => undefined,
    })

    const { GET } = await import('@/app/api/tags/route')
    const req = new Request('http://localhost/api/tags')
    const res = await GET(req as any)

    expect(res.status).toBe(401)
  })
})
