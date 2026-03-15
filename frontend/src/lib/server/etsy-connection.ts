import { prisma } from './prisma'
import { refreshAccessToken, EtsyApiError } from './etsy'
import type { EtsyConnection } from '@prisma/client'

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000 // Refresh 5 min before expiry

export async function getValidAccessToken(
  connection: Pick<EtsyConnection, 'id' | 'accessToken' | 'refreshToken' | 'tokenExpiresAt'>,
): Promise<string> {
  const needsRefresh = connection.tokenExpiresAt.getTime() - Date.now() < TOKEN_REFRESH_BUFFER_MS

  if (!needsRefresh) {
    return connection.accessToken
  }

  try {
    const tokens = await refreshAccessToken(connection.refreshToken)

    await prisma.etsyConnection.update({
      where: { id: connection.id },
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: tokens.expiresAt,
      },
    })

    return tokens.accessToken
  } catch (err) {
    if (err instanceof EtsyApiError) {
      await prisma.etsyConnection.update({
        where: { id: connection.id },
        data: { tokenExpiresAt: new Date(0) },
      })
    }
    throw err
  }
}
