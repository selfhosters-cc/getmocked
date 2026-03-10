-- AlterTable
ALTER TABLE "render_batches" ADD COLUMN "description" TEXT;

-- AlterTable
ALTER TABLE "mockup_templates" ADD COLUMN "is_favorite" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "rendered_mockups" ADD COLUMN "is_favorite" BOOLEAN NOT NULL DEFAULT false;
