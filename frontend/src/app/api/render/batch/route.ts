import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, handleAuthError } from '@/lib/server/auth'
import { processRender } from '@/lib/server/process-render'
import { checkRenderLimit } from '@/lib/server/render-limit'

export async function POST(req: NextRequest) {
  try {
    const userId = await requireAuth()
    const renderLimit = await checkRenderLimit(userId)
    if (!renderLimit.allowed) {
      return NextResponse.json(
        { error: 'Render limit reached', used: renderLimit.used, limit: renderLimit.limit },
        { status: 403 }
      )
    }
    const { mockupSetId, designId, colorVariants, outputMode, outputColor, description } = await req.json()

    const set = await prisma.mockupSet.findFirst({
      where: { id: mockupSetId, userId },
      include: {
        templates: {
          where: { archivedAt: null },
          orderBy: { sortOrder: 'asc' },
          include: { templateImage: true },
        },
      },
    })
    if (!set) {
      return NextResponse.json({ error: 'Mockup set not found' }, { status: 404 })
    }

    const design = await prisma.design.findFirst({ where: { id: designId, userId } })
    if (!design) {
      return NextResponse.json({ error: 'Design not found' }, { status: 404 })
    }

    // Create batch record
    const batch = await prisma.renderBatch.create({
      data: { userId, mockupSetId, designId, description: description || null },
    })

    // Build color combinations: each entry is a tintColor or null (original)
    const colors: (string | null)[] =
      Array.isArray(colorVariants) && colorVariants.length > 0 ? colorVariants : [null]

    // Create renders for each template × color combination
    const renderItems: { template: (typeof set.templates)[number]; tintColor: string | null }[] =
      set.templates.flatMap((template) => colors.map((tintColor) => ({ template, tintColor })))

    const renders = await Promise.all(
      renderItems.map(({ template, tintColor }) => {
        const renderOptions = { tintColor, outputMode: outputMode || null, outputColor: outputColor || null }
        return prisma.renderedMockup.create({
          data: {
            mockupTemplateId: template.id,
            designId: design.id,
            batchId: batch.id,
            renderedImagePath: '',
            status: 'pending',
            renderOptions,
          },
        })
      })
    )

    for (const [i, { template, tintColor }] of renderItems.entries()) {
      const render = renders[i]
      const renderOptions = { tintColor, outputMode: outputMode || null, outputColor: outputColor || null }
      processRender(template, design, render.id, renderOptions).catch(async (err) => {
        console.error(`Render failed for ${render.id}:`, err)
        await prisma.renderedMockup.update({
          where: { id: render.id },
          data: { status: 'failed' },
        })
      })
    }

    return NextResponse.json(
      { batchId: batch.id, renders: renders.map((r) => ({ id: r.id, status: r.status })) },
      { status: 202 }
    )
  } catch (err) {
    return handleAuthError(err)
  }
}
