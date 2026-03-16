import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('next/headers', () => ({ cookies: vi.fn() }))

const mockCreate = vi.fn()
vi.mock('@/lib/server/prisma', () => ({
  prisma: { toolUsage: { create: (...args: unknown[]) => mockCreate(...args) } }
}))

vi.mock('@/lib/server/auth', () => ({
  getAuthUserId: vi.fn(),
}))

import { POST } from '@/app/api/tools/usage/route'
import { getAuthUserId } from '@/lib/server/auth'

describe('POST /api/tools/usage', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('logs usage with userId when authenticated', async () => {
    vi.mocked(getAuthUserId).mockResolvedValue('user-123')
    mockCreate.mockResolvedValue({ id: '1', tool: 'resize', userId: 'user-123' })

    const req = new NextRequest('http://localhost/api/tools/usage', {
      method: 'POST',
      body: JSON.stringify({ tool: 'resize' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(mockCreate).toHaveBeenCalledWith({
      data: { tool: 'resize', userId: 'user-123' }
    })
  })

  it('logs usage without userId when not authenticated', async () => {
    vi.mocked(getAuthUserId).mockResolvedValue(null)
    mockCreate.mockResolvedValue({ id: '2', tool: 'crop', userId: null })

    const req = new NextRequest('http://localhost/api/tools/usage', {
      method: 'POST',
      body: JSON.stringify({ tool: 'crop' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(mockCreate).toHaveBeenCalledWith({
      data: { tool: 'crop', userId: null }
    })
  })

  it('returns 400 for missing tool name', async () => {
    vi.mocked(getAuthUserId).mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/tools/usage', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
