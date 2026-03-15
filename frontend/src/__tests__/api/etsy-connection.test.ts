import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUpdate = vi.fn()

vi.mock('@/lib/server/prisma', () => ({
  prisma: {
    etsyConnection: {
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}))

const mockRefreshAccessToken = vi.fn()
vi.mock('@/lib/server/etsy', () => ({
  refreshAccessToken: (...args: unknown[]) => mockRefreshAccessToken(...args),
  EtsyApiError: class extends Error { constructor(m: string, public status: number) { super(m); this.name = 'EtsyApiError' } },
}))

import { getValidAccessToken } from '@/lib/server/etsy-connection'

describe('getValidAccessToken', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns existing token if not expired', async () => {
    const connection = {
      id: 'conn-1',
      accessToken: 'valid-token',
      refreshToken: 'refresh-token',
      tokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
    }

    const token = await getValidAccessToken(connection as any)
    expect(token).toBe('valid-token')
    expect(mockRefreshAccessToken).not.toHaveBeenCalled()
  })

  it('refreshes token if expiring within 5 minutes', async () => {
    const connection = {
      id: 'conn-1',
      accessToken: 'old-token',
      refreshToken: 'refresh-token',
      tokenExpiresAt: new Date(Date.now() + 2 * 60 * 1000),
    }

    mockRefreshAccessToken.mockResolvedValue({
      accessToken: 'new-token',
      refreshToken: 'new-refresh',
      expiresAt: new Date(Date.now() + 3600 * 1000),
    })
    mockUpdate.mockResolvedValue({})

    const token = await getValidAccessToken(connection as any)
    expect(token).toBe('new-token')
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'conn-1' },
    }))
  })

  it('marks connection stale when refresh fails with EtsyApiError', async () => {
    const { EtsyApiError } = await import('@/lib/server/etsy')
    const connection = {
      id: 'conn-1',
      accessToken: 'old-token',
      refreshToken: 'bad-refresh',
      tokenExpiresAt: new Date(Date.now() - 1000),
    }

    mockRefreshAccessToken.mockRejectedValue(new EtsyApiError('refresh failed', 401))
    mockUpdate.mockResolvedValue({})

    await expect(getValidAccessToken(connection as any)).rejects.toThrow()
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: { tokenExpiresAt: new Date(0) },
    }))
  })
})
