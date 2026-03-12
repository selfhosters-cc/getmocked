import { PrismaClient } from '@prisma/client'
import { generateThumbnail } from '../frontend/src/lib/server/thumbnails'

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'

async function main() {
  const prisma = new PrismaClient()

  try {
    const templates = await prisma.mockupTemplate.findMany({
      where: { templateImageId: null },
      include: { mockupSet: { select: { userId: true } } },
    })

    console.log(`Found ${templates.length} templates to migrate`)

    // Group by (userId, imagePath) for deduplication
    const imageMap = new Map<string, {
      userId: string
      imagePath: string
      name: string
      overlayConfig: unknown
      templateIds: string[]
    }>()

    for (const t of templates) {
      const key = `${t.mockupSet.userId}::${t.originalImagePath}`
      const existing = imageMap.get(key)
      if (existing) {
        existing.templateIds.push(t.id)
      } else {
        imageMap.set(key, {
          userId: t.mockupSet.userId,
          imagePath: t.originalImagePath!,
          name: t.name,
          overlayConfig: t.overlayConfig,
          templateIds: [t.id],
        })
      }
    }

    console.log(`Creating ${imageMap.size} TemplateImage records (${templates.length - imageMap.size} deduped)`)

    for (const [, data] of imageMap) {
      let thumbnailPath: string | null = null
      try {
        thumbnailPath = await generateThumbnail(UPLOAD_DIR, data.imagePath)
        console.log(`  Thumbnail: ${thumbnailPath}`)
      } catch (err) {
        console.warn(`  Thumbnail failed for ${data.imagePath}:`, err)
      }

      const templateImage = await prisma.templateImage.create({
        data: {
          userId: data.userId,
          name: data.name,
          imagePath: data.imagePath,
          thumbnailPath,
          defaultOverlayConfig: data.overlayConfig as any,
        },
      })

      await prisma.mockupTemplate.updateMany({
        where: { id: { in: data.templateIds } },
        data: { templateImageId: templateImage.id },
      })

      console.log(`  Created TemplateImage ${templateImage.id} -> ${data.templateIds.length} templates`)
    }

    console.log('Migration complete!')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(console.error)
