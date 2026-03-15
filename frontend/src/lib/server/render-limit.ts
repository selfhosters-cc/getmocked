import { prisma } from './prisma'

const DEFAULT_RENDER_LIMIT = 500

export async function checkRenderLimit(userId: string): Promise<{ allowed: boolean; used: number; limit: number }> {
  const [used, setting] = await Promise.all([
    prisma.renderedMockup.count({
      where: { mockupTemplate: { mockupSet: { userId } } },
    }),
    prisma.systemSetting.findUnique({
      where: { key: 'render_limit' },
    }),
  ])

  const parsed = setting ? parseInt(setting.value, 10) : NaN
  const limit = isNaN(parsed) ? DEFAULT_RENDER_LIMIT : parsed

  return { allowed: used < limit, used, limit }
}
