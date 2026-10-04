import type { PrismaClient } from '@ite/db';

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

type Attributed = { updatedAt: Date; updatedById: string | null };

/**
 * Database access for image metadata. Every call runs inside a transaction that already holds
 * the product row lock (taken through the product repository), so image writes for one product
 * run one at a time and the primary invariant is checked and changed atomically.
 */
export function createImageRepository() {
  return {
    /** The product's images in display order (sortOrder, then id). */
    list(tx: Tx, productId: string) {
      return tx.productImage.findMany({
        where: { productId },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      });
    },

    /** The product a variant belongs to, or null for an unknown variant. */
    variantProductId(tx: Tx, variantId: string) {
      return tx.productVariant
        .findUnique({ where: { id: variantId }, select: { productId: true } })
        .then((row) => row?.productId ?? null);
    },

    create(
      tx: Tx,
      data: Attributed & {
        productId: string;
        variantId: string | null;
        url: string;
        alt: string;
        sortOrder: number;
        isPrimary: boolean;
        createdAt: Date;
        createdById: string | null;
      },
    ) {
      return tx.productImage.create({ data });
    },

    update(
      tx: Tx,
      id: string,
      data: Attributed & {
        url?: string;
        alt?: string;
        variantId?: string | null;
        isPrimary?: boolean;
        sortOrder?: number;
      },
    ) {
      return tx.productImage.update({ where: { id }, data });
    },

    /**
     * Unsets the current primary (if any). Must run before setting the new one: the partial
     * unique index allows at most one primary per product at every statement.
     */
    unsetPrimary(tx: Tx, productId: string, data: Attributed) {
      return tx.productImage.updateMany({
        where: { productId, isPrimary: true },
        data: { isPrimary: false, ...data },
      });
    },

    delete(tx: Tx, id: string) {
      return tx.productImage.delete({ where: { id } });
    },
  };
}

export type ImageRepository = ReturnType<typeof createImageRepository>;
