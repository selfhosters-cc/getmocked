import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { requireAuth, handleAuthError } from '@/lib/server/auth'
import { processRender } from '@/lib/server/process-render'

export async function POST(req: NextRequest) {
  try {
    const userId = await requireAuth()
    const { mockupTemplateId, designId, tintColor, outputMode, outputColor, batchId } = await req.json()

    if (!mockupTemplateId || !designId) {
      return NextResponse.json({ error: 'mockupTemplateId and designId are required' }, { status: 400 })
    }

    const template = await prisma.mockupTemplate.findFirst({
      where: {
        id: mockupTemplateId,
        archivedAt: null,
        mockupSet: { userId },
      },
      include: { templateImage: true },
    })
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    const design = await prisma.design.findFirst({ where: { id: designId, userId } })
    if (!design) {
      return NextResponse.json({ error: 'Design not found' }, { status: 404 })
    }

    if (batchId) {
      const batch = await prisma.renderBatch.findFirst({ where: { id: batchId, userId } })
      if (!batch) {
        return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
      }
    }

    const renderOptions = {
      tintColor: tintColor || null,
      outputMode: outputMode || null,
      outputColor: outputColor || null,
    }

    const render = await prisma.renderedMockup.create({
      data: {
        mockupTemplateId: template.id,
        designId: design.id,
        batchId: batchId || null,
        renderedImagePath: '',
        status: 'pending',
        renderOptions,
      },
    })

    processRender(template, design, render.id, renderOptions).catch(async (err) => {
      console.error(`Single render failed for ${render.id}:`, err)
      await prisma.renderedMockup.update({
        where: { id: render.id },
        data: { status: 'failed' },
      })
    })

    return NextResponse.json({ renderId: render.id, status: 'pending' }, { status: 202 })
  } catch (err) {
    return handleAuthError(err)
  }
}
