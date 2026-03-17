import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/server/prisma', () => ({
  prisma: {
    renderedMockup: { count: vi.fn() },
    systemSetting: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}))

import { prisma } from '@/lib/server/prisma'
import { checkRenderLimit } from '@/lib/server/render-limit'

describe('checkRenderLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns allowed=true when under limit', async () => {
    vi.mocked(prisma.renderedMockup.count).mockResolvedValue(100)
    vi.mocked(prisma.systemSetting.findUnique).mockResolvedValue({
      key: 'render_limit',
      value: '500',
      updatedAt: new Date(),
    })
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ renderCountOffset: 0 } as never)

    const result = await checkRenderLimit('user-1')
    expect(result).toEqual({ allowed: true, used: 100, limit: 500 })
    expect(prisma.renderedMockup.count).toHaveBeenCalledWith({
      where: { mockupTemplate: { mockupSet: { userId: 'user-1' } } },
    })
  })

  it('returns allowed=false when at limit', async () => {
    vi.mocked(prisma.renderedMockup.count).mockResolvedValue(500)
    vi.mocked(prisma.systemSetting.findUnique).mockResolvedValue({
      key: 'render_limit',
      value: '500',
      updatedAt: new Date(),
    })
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ renderCountOffset: 0 } as never)

    const result = await checkRenderLimit('user-1')
    expect(result).toEqual({ allowed: false, used: 500, limit: 500 })
  })

  it('defaults to 500 if setting not found', async () => {
    vi.mocked(prisma.renderedMockup.count).mockResolvedValue(10)
    vi.mocked(prisma.systemSetting.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ renderCountOffset: 0 } as never)

    const result = await checkRenderLimit('user-1')
    expect(result).toEqual({ allowed: true, used: 10, limit: 500 })
  })
})
