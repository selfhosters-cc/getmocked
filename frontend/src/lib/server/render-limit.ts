import { prisma } from './prisma'

const DEFAULT_RENDER_LIMIT = 500

export async function checkRenderLimit(userId: string): Promise<{ allowed: boolean; used: number; limit: number }> {
  const [used, setting] = await Promise.all([
    prisma.renderedMockup.count({
      where: { batch: { userId } },
    }),
    prisma.systemSetting.findUnique({
      where: { key: 'render_limit' },
    }),
  ])

  const limit = setting ? parseInt(setting.value, 10) : DEFAULT_RENDER_LIMIT

  return { allowed: used < limit, used, limit }
}
