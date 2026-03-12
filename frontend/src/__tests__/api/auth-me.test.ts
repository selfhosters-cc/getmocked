import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}))

// Mock prisma
const mockFindUnique = vi.fn()
vi.mock('@/lib/server/prisma', () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => mockFindUnique(...args) },
  },
}))

// Mock jwt
const mockVerifyToken = vi.fn()
vi.mock('@/lib/server/jwt', () => ({
  verifyToken: (...args: unknown[]) => mockVerifyToken(...args),
}))

import { cookies } from 'next/headers'
import { GET } from '@/app/api/auth/me/route'

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    ;(cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      get: () => undefined,
    })

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe('Not authenticated')
  })

  it('returns user data with isAdmin=false for regular user', async () => {
    ;(cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      get: () => ({ value: 'valid-token' }),
    })
    mockVerifyToken.mockReturnValue({ userId: 'user-1' })
    mockFindUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@test.com',
      name: 'Test User',
      isAdmin: false,
    })

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.user).toEqual({
      id: 'user-1',
      email: 'user@test.com',
      name: 'Test User',
      isAdmin: false,
    })
  })

  it('returns isAdmin=true for admin user', async () => {
    ;(cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      get: () => ({ value: 'valid-token' }),
    })
    mockVerifyToken.mockReturnValue({ userId: 'admin-1' })
    mockFindUnique.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@test.com',
      name: 'Admin User',
      isAdmin: true,
    })

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.user.isAdmin).toBe(true)
  })

  it('returns 401 when user not found in database', async () => {
    ;(cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      get: () => ({ value: 'valid-token' }),
    })
    mockVerifyToken.mockReturnValue({ userId: 'nonexistent' })
    mockFindUnique.mockResolvedValue(null)

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe('User not found')
  })
})
