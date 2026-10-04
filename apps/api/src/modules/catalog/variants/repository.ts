import type { PrismaClient, VariantStatus } from '@ite/db';

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

const VARIANT_INCLUDE = { size: true, color: true } as const;

type VariantWrite = {
  sizeId?: string;
  colorId?: string;
  sku?: string;
  priceOverrideAmount?: number | null;
  status?: VariantStatus;
  updatedAt: Date;
  updatedById: string | null;
};

/**
 * Database access for variants. Locks on the product and its variants come from the product
 * repository (fixed order: category, product, variants); stock changes are one statement here.
 */
export function createVariantRepository(db: PrismaClient) {
  return {
    create(
      tx: Tx,
      data: {
        productId: string;
        sizeId: string;
        colorId: string;
        sku: string;
        priceOverrideAmount: number | null;
        stockQuantity: number;
        createdAt: Date;
        updatedAt: Date;
        createdById: string | null;
        updatedById: string | null;
      },
    ) {
      return tx.productVariant.create({ data, include: VARIANT_INCLUDE });
    },

    update(tx: Tx, id: string, data: VariantWrite) {
      return tx.productVariant.update({ where: { id }, data, include: VARIANT_INCLUDE });
    },

    /**
     * Applies a stock delta atomically (design D5): a single conditional UPDATE, so concurrent
     * adjustments serialize on the variant row lock and each re-checks the condition against the
     * latest quantity (no lost updates). The bound is computed as bigint so an overflow is a
     * failed condition, not an error. Archived products are read-only. Returns the new quantity,
     * or null when no row matched (unknown, archived, or out of range).
     */
    async adjustStock(
      productId: string,
      variantId: string,
      delta: number,
      actorId: string,
      now: Date,
    ): Promise<number | null> {
      const rows = await db.$queryRaw<{ stockQuantity: number }[]>`
        UPDATE product_variants AS v
        SET stock_quantity = v.stock_quantity + ${delta}::integer,
            updated_by = ${actorId}::uuid,
            updated_at = ${now}
        FROM products AS p
        WHERE v.id = ${variantId}::uuid
          AND v.product_id = ${productId}::uuid
          AND p.id = v.product_id
          AND p.status <> 'ARCHIVED'
          AND v.stock_quantity::bigint + ${delta}::bigint BETWEEN 0 AND 2147483647
        RETURNING v.stock_quantity AS "stockQuantity"
      `;
      return rows[0]?.stockQuantity ?? null;
    },

    /** After a failed adjustment: why it failed (the follow-up existence check of design D5). */
    stockState(productId: string, variantId: string) {
      return db.productVariant.findFirst({
        where: { id: variantId, productId },
        select: { stockQuantity: true, product: { select: { status: true } } },
      });
    },
  };
}

export type VariantRepository = ReturnType<typeof createVariantRepository>;
