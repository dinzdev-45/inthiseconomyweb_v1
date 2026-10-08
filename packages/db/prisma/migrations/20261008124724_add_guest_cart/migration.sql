-- CreateTable
CREATE TABLE "carts" (
    "id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_lines" (
    "id" UUID NOT NULL,
    "cart_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "carts_token_hash_key" ON "carts"("token_hash");

-- CreateIndex
CREATE INDEX "cart_lines_variant_id_idx" ON "cart_lines"("variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "cart_lines_cart_id_variant_id_key" ON "cart_lines"("cart_id", "variant_id");

-- AddForeignKey
ALTER TABLE "cart_lines" ADD CONSTRAINT "cart_lines_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_lines" ADD CONSTRAINT "cart_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Constraints Prisma cannot express (store-cart-api spec).
-- ---------------------------------------------------------------------------

-- A cart line holds 1 to 10 of one variant (quantity limit per variant).
ALTER TABLE "cart_lines" ADD CONSTRAINT "cart_lines_quantity_range"
  CHECK ("quantity" BETWEEN 1 AND 10);
