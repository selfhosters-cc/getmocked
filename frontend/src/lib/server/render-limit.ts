import { prisma } from './prisma'

const DEFAULT_RENDER_LIMIT = 500

export async function checkRenderLimit(userId: string): Promise<{ allowed: boolean; used: number; limit: number }> {
  const [totalRendered, setting, user] = await Promise.all([
    prisma.renderedMockup.count({
      where: { mockupTemplate: { mockupSet: { userId } } },
    }),
    prisma.systemSetting.findUnique({
      where: { key: 'render_limit' },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { renderCountOffset: true },
    }),
  ])

  const parsed = setting ? parseInt(setting.value, 10) : NaN
  const limit = isNaN(parsed) ? DEFAULT_RENDER_LIMIT : parsed
  const offset = user?.renderCountOffset ?? 0
  const used = Math.max(0, totalRendered - offset)

  return { allowed: used < limit, used, limit }
}
