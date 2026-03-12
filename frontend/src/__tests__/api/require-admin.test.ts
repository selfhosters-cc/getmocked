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
import { requireAdmin, requireAuth, AuthError } from '@/lib/server/auth'

describe('requireAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws AuthError when not authenticated', async () => {
    ;(cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      get: () => undefined,
    })

    await expect(requireAdmin()).rejects.toThrow(AuthError)
    await expect(requireAdmin()).rejects.toThrow('Not authenticated')
  })

  it('throws AuthError when user is not admin', async () => {
    ;(cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      get: () => ({ value: 'valid-token' }),
    })
    mockVerifyToken.mockReturnValue({ userId: 'user-1' })
    mockFindUnique.mockResolvedValue({ isAdmin: false })

    await expect(requireAdmin()).rejects.toThrow(AuthError)
    await expect(requireAdmin()).rejects.toThrow('Not authorized')
  })

  it('returns userId when user is admin', async () => {
    ;(cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      get: () => ({ value: 'valid-token' }),
    })
    mockVerifyToken.mockReturnValue({ userId: 'admin-1' })
    mockFindUnique.mockResolvedValue({ isAdmin: true })

    const userId = await requireAdmin()
    expect(userId).toBe('admin-1')
  })

  it('throws AuthError when user not found in database', async () => {
    ;(cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      get: () => ({ value: 'valid-token' }),
    })
    mockVerifyToken.mockReturnValue({ userId: 'nonexistent' })
    mockFindUnique.mockResolvedValue(null)

    await expect(requireAdmin()).rejects.toThrow(AuthError)
    await expect(requireAdmin()).rejects.toThrow('Not authorized')
  })
})

describe('requireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws AuthError when no token', async () => {
    ;(cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      get: () => undefined,
    })

    await expect(requireAuth()).rejects.toThrow(AuthError)
  })

  it('returns userId when valid token', async () => {
    ;(cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      get: () => ({ value: 'valid-token' }),
    })
    mockVerifyToken.mockReturnValue({ userId: 'user-1' })

    const userId = await requireAuth()
    expect(userId).toBe('user-1')
  })

  it('throws AuthError when token verification fails', async () => {
    ;(cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      get: () => ({ value: 'bad-token' }),
    })
    mockVerifyToken.mockImplementation(() => { throw new Error('Invalid token') })

    await expect(requireAuth()).rejects.toThrow(AuthError)
  })
})
