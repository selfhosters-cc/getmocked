import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ cookies: vi.fn() }))

const mockFindMany = vi.fn()
const mockFindFirst = vi.fn()
const mockDelete = vi.fn()
const mockVerifyToken = vi.fn()

vi.mock('@/lib/server/prisma', () => ({
  prisma: {
    etsyConnection: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
    },
  },
}))
vi.mock('@/lib/server/jwt', () => ({
  verifyToken: (...args: unknown[]) => mockVerifyToken(...args),
}))

import { cookies } from 'next/headers'

describe('GET /api/etsy/connections', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns user connections without tokens', async () => {
    ;(cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      get: () => ({ value: 'token' }),
    })
    mockVerifyToken.mockReturnValue({ userId: 'user-1' })
    mockFindMany.mockResolvedValue([
      {
        id: 'conn-1',
        shopId: '123',
        shopName: 'My Shop',
        etsyUserId: '456',
        tokenExpiresAt: new Date('2027-01-01'),
        createdAt: new Date('2025-12-01'),
      },
    ])

    const { GET } = await import('@/app/api/etsy/connections/route')
    const req = new Request('http://localhost/api/etsy/connections')
    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.connections).toHaveLength(1)
    expect(body.connections[0].shopName).toBe('My Shop')
    expect(body.connections[0].status).toBe('connected')
    // Tokens must NOT be in the select
    expect(body.connections[0].accessToken).toBeUndefined()
    expect(body.connections[0].refreshToken).toBeUndefined()
  })

  it('returns 401 when not authenticated', async () => {
    ;(cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      get: () => undefined,
    })

    const { GET } = await import('@/app/api/etsy/connections/route')
    const res = await GET()

    expect(res.status).toBe(401)
  })
})

describe('DELETE /api/etsy/connections/[id]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('deletes a connection owned by the user', async () => {
    ;(cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      get: () => ({ value: 'token' }),
    })
    mockVerifyToken.mockReturnValue({ userId: 'user-1' })
    mockFindFirst.mockResolvedValue({ id: 'conn-1', userId: 'user-1' })
    mockDelete.mockResolvedValue({})

    const { DELETE } = await import('@/app/api/etsy/connections/[id]/route')
    const req = new Request('http://localhost/api/etsy/connections/conn-1', { method: 'DELETE' })
    const res = await DELETE(req as any, { params: Promise.resolve({ id: 'conn-1' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it('returns 404 for connection not owned by user', async () => {
    ;(cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      get: () => ({ value: 'token' }),
    })
    mockVerifyToken.mockReturnValue({ userId: 'user-1' })
    mockFindFirst.mockResolvedValue(null)

    const { DELETE } = await import('@/app/api/etsy/connections/[id]/route')
    const req = new Request('http://localhost/api/etsy/connections/conn-99', { method: 'DELETE' })
    const res = await DELETE(req as any, { params: Promise.resolve({ id: 'conn-99' }) })

    expect(res.status).toBe(404)
  })
})
