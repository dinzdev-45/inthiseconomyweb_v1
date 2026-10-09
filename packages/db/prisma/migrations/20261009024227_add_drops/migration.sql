-- CreateEnum
CREATE TYPE "drop_status" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "drops" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "collection" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "release_at" TIMESTAMPTZ(3) NOT NULL,
    "image_url" TEXT,
    "image_alt" TEXT,
    "status" "drop_status" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "drops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drop_products" (
    "drop_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "drop_products_pkey" PRIMARY KEY ("drop_id","product_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "drops_slug_key" ON "drops"("slug");

-- CreateIndex
CREATE INDEX "drops_release_at_idx" ON "drops"("release_at");

-- CreateIndex
CREATE UNIQUE INDEX "drop_products_product_id_key" ON "drop_products"("product_id");

-- AddForeignKey
ALTER TABLE "drops" ADD CONSTRAINT "drops_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drops" ADD CONSTRAINT "drops_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drop_products" ADD CONSTRAINT "drop_products_drop_id_fkey" FOREIGN KEY ("drop_id") REFERENCES "drops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drop_products" ADD CONSTRAINT "drop_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Constraints Prisma cannot express (drops-management spec).
-- ---------------------------------------------------------------------------

ALTER TABLE "drops" ADD CONSTRAINT "drops_slug_format"
  CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length("slug") <= 80);
ALTER TABLE "drops" ADD CONSTRAINT "drops_text_lengths"
  CHECK (length("collection") BETWEEN 1 AND 60 AND length("title") BETWEEN 1 AND 120
         AND ("description" IS NULL OR length("description") <= 2000));
-- An image has both a URL and alt text, or neither.
ALTER TABLE "drops" ADD CONSTRAINT "drops_image_complete"
  CHECK (("image_url" IS NULL) = ("image_alt" IS NULL));
ALTER TABLE "drop_products" ADD CONSTRAINT "drop_products_position_non_negative"
  CHECK ("position" >= 0);
