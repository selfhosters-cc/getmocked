import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ cookies: vi.fn() }))

const mockFindUnique = vi.fn()
const mockUpdate = vi.fn()
const mockVerifyToken = vi.fn()

vi.mock('@/lib/server/prisma', () => ({
  prisma: {
    tag: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    user: { findUnique: vi.fn().mockResolvedValue({ isAdmin: true }) },
  },
}))
vi.mock('@/lib/server/jwt', () => ({
  verifyToken: (...args: unknown[]) => mockVerifyToken(...args),
}))

import { cookies } from 'next/headers'

describe('PATCH /api/tags/[id]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('allows admin to archive a tag', async () => {
    ;(cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      get: () => ({ value: 'token' }),
    })
    mockVerifyToken.mockReturnValue({ userId: 'admin-1' })
    mockFindUnique.mockResolvedValue({ id: 'tag-1', name: 'bad-tag' })
    mockUpdate.mockResolvedValue({ id: 'tag-1', name: 'bad-tag', archivedAt: new Date() })

    const { PATCH } = await import('@/app/api/tags/[id]/route')
    const req = new Request('http://localhost/api/tags/tag-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archive: true }),
    })
    const res = await PATCH(req as any, { params: Promise.resolve({ id: 'tag-1' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('allows admin to rename a tag', async () => {
    ;(cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      get: () => ({ value: 'token' }),
    })
    mockVerifyToken.mockReturnValue({ userId: 'admin-1' })
    mockFindUnique.mockResolvedValue({ id: 'tag-1', name: 'old-name' })
    mockUpdate.mockResolvedValue({ id: 'tag-1', name: 'new-name' })

    const { PATCH } = await import('@/app/api/tags/[id]/route')
    const req = new Request('http://localhost/api/tags/tag-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Name' }),
    })
    const res = await PATCH(req as any, { params: Promise.resolve({ id: 'tag-1' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
  })
})
