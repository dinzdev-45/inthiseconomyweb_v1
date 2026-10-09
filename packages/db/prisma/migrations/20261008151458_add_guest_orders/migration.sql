-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('AWAITING_PAYMENT', 'EXPIRED');

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "access_key_hash" CHAR(64) NOT NULL,
    "status" "order_status" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address_line1" TEXT NOT NULL,
    "address_line2" TEXT,
    "city" TEXT NOT NULL,
    "province" CHAR(2) NOT NULL,
    "postal_code" CHAR(5) NOT NULL,
    "note" TEXT,
    "subtotal_amount" BIGINT NOT NULL,
    "shipping_fee_amount" INTEGER NOT NULL,
    "total_amount" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "payment_deadline" TIMESTAMPTZ(3) NOT NULL,
    "placed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expired_at" TIMESTAMPTZ(3),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_lines" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "product_name" TEXT NOT NULL,
    "product_slug" TEXT NOT NULL,
    "color_name" TEXT NOT NULL,
    "size_code" TEXT NOT NULL,
    "unit_amount" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "line_total_amount" BIGINT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_number_key" ON "orders"("number");

-- CreateIndex
CREATE UNIQUE INDEX "orders_access_key_hash_key" ON "orders"("access_key_hash");

-- CreateIndex
CREATE INDEX "orders_status_payment_deadline_idx" ON "orders"("status", "payment_deadline");

-- CreateIndex
CREATE INDEX "order_lines_order_id_idx" ON "order_lines"("order_id");

-- CreateIndex
CREATE INDEX "order_lines_variant_id_idx" ON "order_lines"("variant_id");

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Constraints Prisma cannot express (store-checkout-api spec).
-- ---------------------------------------------------------------------------

-- ITE- plus 8 Crockford base32 characters (no I, L, O, U).
ALTER TABLE "orders" ADD CONSTRAINT "orders_number_format"
  CHECK ("number" ~ '^ITE-[0-9A-HJKMNP-TV-Z]{8}$');
ALTER TABLE "orders" ADD CONSTRAINT "orders_currency_format"
  CHECK ("currency" ~ '^[A-Z]{3}$');
ALTER TABLE "orders" ADD CONSTRAINT "orders_province_format"
  CHECK ("province" ~ '^[0-9]{2}$');
ALTER TABLE "orders" ADD CONSTRAINT "orders_postal_code_format"
  CHECK ("postal_code" ~ '^[0-9]{5}$');
ALTER TABLE "orders" ADD CONSTRAINT "orders_amounts_non_negative"
  CHECK ("subtotal_amount" >= 0 AND "shipping_fee_amount" >= 0 AND "total_amount" >= 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_total_is_sum"
  CHECK ("total_amount" = "subtotal_amount" + "shipping_fee_amount");

-- A line holds 1 to 10 of one variant, at a non-negative price.
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_quantity_range"
  CHECK ("quantity" BETWEEN 1 AND 10);
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_amounts_non_negative"
  CHECK ("unit_amount" >= 0 AND "line_total_amount" >= 0);
