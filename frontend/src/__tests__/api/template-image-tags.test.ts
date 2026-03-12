import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ cookies: vi.fn() }))

const mockFindFirst = vi.fn()
const mockTagUpsert = vi.fn()
const mockJoinCreate = vi.fn()
const mockJoinDelete = vi.fn()
const mockVerifyToken = vi.fn()

vi.mock('@/lib/server/prisma', () => ({
  prisma: {
    templateImage: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
    tag: { upsert: (...args: unknown[]) => mockTagUpsert(...args) },
    templateImageTag: {
      create: (...args: unknown[]) => mockJoinCreate(...args),
      delete: (...args: unknown[]) => mockJoinDelete(...args),
    },
  },
}))
vi.mock('@/lib/server/jwt', () => ({
  verifyToken: (...args: unknown[]) => mockVerifyToken(...args),
}))

import { cookies } from 'next/headers'

describe('POST /api/template-images/[id]/tags', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('adds a tag to a template image', async () => {
    ;(cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      get: () => ({ value: 'token' }),
    })
    mockVerifyToken.mockReturnValue({ userId: 'user-1' })
    mockFindFirst.mockResolvedValue({ id: 'img-1', userId: 'user-1' })
    mockTagUpsert.mockResolvedValue({ id: 'tag-1', name: 'bella canvas' })
    mockJoinCreate.mockResolvedValue({ templateImageId: 'img-1', tagId: 'tag-1' })

    const { POST } = await import('@/app/api/template-images/[id]/tags/route')
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Bella Canvas' }),
    })
    const res = await POST(req as any, { params: Promise.resolve({ id: 'img-1' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.tag.name).toBe('bella canvas')
  })

  it('returns 404 for image not owned by user', async () => {
    ;(cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      get: () => ({ value: 'token' }),
    })
    mockVerifyToken.mockReturnValue({ userId: 'user-1' })
    mockFindFirst.mockResolvedValue(null)

    const { POST } = await import('@/app/api/template-images/[id]/tags/route')
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'test' }),
    })
    const res = await POST(req as any, { params: Promise.resolve({ id: 'img-1' }) })

    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/template-images/[id]/tags/[tagId]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('removes a tag from a template image', async () => {
    ;(cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      get: () => ({ value: 'token' }),
    })
    mockVerifyToken.mockReturnValue({ userId: 'user-1' })
    mockFindFirst.mockResolvedValue({ id: 'img-1', userId: 'user-1' })
    mockJoinDelete.mockResolvedValue({})

    const { DELETE } = await import('@/app/api/template-images/[id]/tags/[tagId]/route')
    const req = new Request('http://localhost', { method: 'DELETE' })
    const res = await DELETE(req as any, { params: Promise.resolve({ id: 'img-1', tagId: 'tag-1' }) })

    expect(res.status).toBe(200)
  })
})
