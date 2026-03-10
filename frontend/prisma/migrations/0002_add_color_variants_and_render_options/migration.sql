-- AlterTable
ALTER TABLE "mockup_sets" ADD COLUMN "color_variants" JSONB DEFAULT '[]';

-- AlterTable
ALTER TABLE "rendered_mockups" ADD COLUMN "render_options" JSONB;
