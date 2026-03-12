-- AlterTable
ALTER TABLE "users" ADD COLUMN "is_admin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "template_images" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "name" TEXT NOT NULL,
    "image_path" TEXT NOT NULL,
    "thumbnail_path" TEXT,
    "default_overlay_config" JSONB,
    "default_mask_path" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_images_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "mockup_templates" ADD COLUMN "template_image_id" TEXT;
ALTER TABLE "mockup_templates" ADD COLUMN "archived_at" TIMESTAMP(3);
ALTER TABLE "mockup_templates" ALTER COLUMN "original_image_path" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "template_images" ADD CONSTRAINT "template_images_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mockup_templates" ADD CONSTRAINT "mockup_templates_template_image_id_fkey" FOREIGN KEY ("template_image_id") REFERENCES "template_images"("id") ON DELETE SET NULL ON UPDATE CASCADE;
