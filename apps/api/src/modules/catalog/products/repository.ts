import type { CategoryStatus, Prisma, PrismaClient, ProductStatus, VariantStatus } from '@ite/db';

import { afterCursor, CURSOR_ORDER_BY, type CursorKey } from '../../../pagination.ts';

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

/** Everything a `ProductDetail` response needs, in display order. */
export const PRODUCT_DETAIL_INCLUDE = {
  category: true,
  variants: {
    include: { size: true, color: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  },
  images: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
} as const satisfies Prisma.ProductInclude;
export type ProductDetailRow = Prisma.ProductGetPayload<{ include: typeof PRODUCT_DETAIL_INCLUDE }>;

/** Everything a `ProductListItem` needs: category, primary image, and variant count. */
export const PRODUCT_LIST_INCLUDE = {
  category: true,
  images: { where: { isPrimary: true }, take: 1 },
  _count: { select: { variants: true } },
} as const satisfies Prisma.ProductInclude;
export type ProductListRow = Prisma.ProductGetPayload<{ include: typeof PRODUCT_LIST_INCLUDE }>;

export type ProductListFilter = {
  /** Omitted: every status except ARCHIVED. */
  status?: ProductStatus;
  categoryId?: string;
  /** Case-insensitive substring of the name. */
  q?: string;
};

/**
 * Escapes LIKE wildcards so `q` matches literally: Prisma passes `contains` to PostgreSQL as a
 * LIKE pattern without escaping `%`, `_`, or the escape character `\\` itself.
 */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** The locked state of a product that writes depend on. */
export type LockedProduct = {
  id: string;
  slug: string;
  status: ProductStatus;
  categoryId: string;
  basePriceAmount: number;
  currency: string;
  activatedAt: Date | null;
};

/** A locked variant row: what readiness, SKU locks, and uniqueness checks need. */
export type LockedVariant = {
  id: string;
  sku: string;
  status: VariantStatus;
  priceOverrideAmount: number | null;
};

type ProductWrite = {
  name?: string;
  slug?: string;
  description?: string | null;
  categoryId?: string;
  basePriceAmount?: number;
  updatedAt: Date;
  updatedById: string | null;
};

/** Database access for products. The only Prisma caller in this module. */
export function createProductRepository(db: PrismaClient) {
  return {
    /** Runs `fn` in a transaction (READ COMMITTED). */
    transaction<T>(fn: (tx: Tx) => Promise<T>) {
      return db.$transaction(fn);
    },

    findDetail(id: string) {
      return db.product.findUnique({ where: { id }, include: PRODUCT_DETAIL_INCLUDE });
    },

    /**
     * One page in `CURSOR_ORDER_BY` order, after `after` when given. Fetches `take` rows (the
     * caller asks for one more than the page size to know whether another page exists).
     */
    list(filter: ProductListFilter, after: CursorKey | undefined, take: number) {
      return db.product.findMany({
        where: {
          AND: [
            filter.status ? { status: filter.status } : { status: { not: 'ARCHIVED' } },
            filter.categoryId ? { categoryId: filter.categoryId } : {},
            filter.q ? { name: { contains: escapeLike(filter.q), mode: 'insensitive' } } : {},
            afterCursor(after),
          ],
        },
        orderBy: [...CURSOR_ORDER_BY],
        take,
        include: PRODUCT_LIST_INCLUDE,
      });
    },

    /** Existing product slugs starting with `prefix`, including archived products. */
    slugsWithPrefix(prefix: string) {
      return db.product
        .findMany({ where: { slug: { startsWith: prefix } }, select: { slug: true } })
        .then((rows) => rows.map((row) => row.slug));
    },

    /** A single INSERT (its own implicit transaction), returning the full detail. */
    create(data: {
      name: string;
      slug: string;
      description: string | null;
      categoryId: string;
      basePriceAmount: number;
      currency: string;
      createdAt: Date;
      updatedAt: Date;
      createdById: string | null;
      updatedById: string | null;
    }) {
      return db.product.create({ data, include: PRODUCT_DETAIL_INCLUDE });
    },

    /**
     * Share-locks a category until the transaction ends, so it cannot be archived meanwhile
     * (archiving takes the row lock FOR UPDATE). Category before product: the fixed lock order.
     */
    async lockCategoryShared(tx: Tx, id: string): Promise<{ status: CategoryStatus } | null> {
      const rows = await tx.$queryRaw<{ status: CategoryStatus }[]>`
        SELECT status FROM categories WHERE id = ${id}::uuid FOR SHARE
      `;
      return rows[0] ?? null;
    },

    /** The product's category id, unlocked: read first so the category can be locked before it. */
    productCategoryId(tx: Tx, id: string) {
      return tx.product
        .findUnique({ where: { id }, select: { categoryId: true } })
        .then((row) => row?.categoryId ?? null);
    },

    /**
     * Locks the product row until the transaction ends. Every write that can affect readiness
     * (lifecycle, product edits, variant changes, image changes) takes this lock, so they run
     * one at a time per product.
     */
    async lockProduct(tx: Tx, id: string): Promise<LockedProduct | null> {
      const rows = await tx.$queryRaw<LockedProduct[]>`
        SELECT id, slug, status, category_id AS "categoryId",
               base_price_amount AS "basePriceAmount", currency, activated_at AS "activatedAt"
        FROM products WHERE id = ${id}::uuid FOR UPDATE
      `;
      return rows[0] ?? null;
    },

    /** Locks every variant of the product (after the product: the fixed order), by id. */
    lockVariants(tx: Tx, productId: string): Promise<LockedVariant[]> {
      return tx.$queryRaw<LockedVariant[]>`
        SELECT id, sku, status, price_override_amount AS "priceOverrideAmount"
        FROM product_variants WHERE product_id = ${productId}::uuid
        ORDER BY id FOR UPDATE
      `;
    },

    /** How many images the product has, and how many are primary. */
    async imageCounts(tx: Tx, productId: string) {
      const imageCount = await tx.productImage.count({ where: { productId } });
      const primaryImageCount = await tx.productImage.count({
        where: { productId, isPrimary: true },
      });
      return { imageCount, primaryImageCount };
    },

    setLifecycle(
      tx: Tx,
      id: string,
      data: {
        status: ProductStatus;
        activatedAt?: Date;
        updatedAt: Date;
        updatedById: string | null;
      },
    ) {
      return tx.product.update({ where: { id }, data, include: PRODUCT_DETAIL_INCLUDE });
    },

    update(tx: Tx, id: string, data: ProductWrite) {
      return tx.product.update({ where: { id }, data, include: PRODUCT_DETAIL_INCLUDE });
    },
  };
}

export type ProductRepository = ReturnType<typeof createProductRepository>;
