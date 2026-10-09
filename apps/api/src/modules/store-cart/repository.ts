import type { CartLineStatus } from '@ite/contracts';
import type { PrismaClient } from '@ite/db';

import { unreleased } from '../drops/release.ts';

export type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

/** A sellable variant (ACTIVE product, ACTIVE variant), its stock, and whether it is unreleased. */
export type SellableVariant = { variantId: string; stock: number; unreleased: boolean };

/** A cart line with what quantity changes depend on. */
export type LockedLine = { id: string; quantity: number; sellable: boolean; stock: number };

/** One line of the cart view, with price and status computed in SQL (guest-cart design D4). */
export type CartViewRow = {
  id: string;
  /** Internal only (checkout decrements this variant's stock); never part of a response. */
  variantId: string;
  quantity: number;
  productSlug: string;
  productName: string;
  currency: string;
  colorSlug: string;
  colorName: string;
  sizeCode: string;
  sizeLabel: string;
  unitAmount: number;
  status: CartLineStatus;
  image: { url: string; alt: string } | null;
};

/** Database access for guest carts. The only Prisma caller in this module. */
export function createStoreCartRepository(db: PrismaClient) {
  return {
    transaction<T>(fn: (tx: Tx) => Promise<T>) {
      return db.$transaction(fn);
    },

    create(data: { tokenHash: string; createdAt: Date; expiresAt: Date }) {
      return db.cart.create({
        data: { ...data, updatedAt: data.createdAt },
        select: { id: true },
      });
    },

    /** The live cart with this token hash, or null when unknown or expired at `now`. */
    findLive(tokenHash: string, now: Date) {
      return db.cart.findFirst({
        where: { tokenHash, expiresAt: { gt: now } },
        select: { id: true },
      });
    },

    /** Locks the live cart row until the transaction ends: cart writes run one at a time. */
    async lockLive(tx: Tx, tokenHash: string, now: Date): Promise<{ id: string } | null> {
      const rows = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM carts WHERE token_hash = ${tokenHash} AND expires_at > ${now} FOR UPDATE
      `;
      return rows[0] ?? null;
    },

    /** Records a change: `updated_at`, and expiry pushed out from it. */
    touch(tx: Tx, cartId: string, now: Date, expiresAt: Date) {
      return tx.cart.update({ where: { id: cartId }, data: { updatedAt: now, expiresAt } });
    },

    /** The ACTIVE variant of an ACTIVE product with this color and size, or null. */
    async findSellableVariant(
      tx: Tx,
      key: { productSlug: string; colorSlug: string; sizeCode: string },
      now: Date,
    ): Promise<SellableVariant | null> {
      const rows = await tx.$queryRaw<SellableVariant[]>`
        SELECT v.id AS "variantId", v.stock_quantity AS stock, ${unreleased('p', now)} AS unreleased
        FROM product_variants v
        JOIN products p ON p.id = v.product_id
        JOIN colors c ON c.id = v.color_id
        JOIN sizes s ON s.id = v.size_id
        WHERE p.slug = ${key.productSlug} AND c.slug = ${key.colorSlug} AND s.code = ${key.sizeCode}
          AND p.status = 'ACTIVE' AND v.status = 'ACTIVE'
      `;
      return rows[0] ?? null;
    },

    findLineByVariant(tx: Tx, cartId: string, variantId: string) {
      return tx.cartLine.findUnique({
        where: { cartId_variantId: { cartId, variantId } },
        select: { id: true, quantity: true },
      });
    },

    /** A line of this cart with its variant's sellability and stock, or null. */
    async findLine(tx: Tx, cartId: string, lineId: string, now: Date): Promise<LockedLine | null> {
      const rows = await tx.$queryRaw<LockedLine[]>`
        SELECT l.id, l.quantity,
               (p.status = 'ACTIVE' AND v.status = 'ACTIVE' AND NOT ${unreleased('p', now)}) AS sellable,
               v.stock_quantity AS stock
        FROM cart_lines l
        JOIN product_variants v ON v.id = l.variant_id
        JOIN products p ON p.id = v.product_id
        WHERE l.id = ${lineId}::uuid AND l.cart_id = ${cartId}::uuid
      `;
      return rows[0] ?? null;
    },

    lineCount(tx: Tx, cartId: string) {
      return tx.cartLine.count({ where: { cartId } });
    },

    insertLine(tx: Tx, data: { cartId: string; variantId: string; quantity: number; now: Date }) {
      const { now, ...line } = data;
      return tx.cartLine.create({
        data: { ...line, createdAt: now, updatedAt: now },
        select: { id: true },
      });
    },

    setQuantity(tx: Tx, lineId: string, quantity: number, now: Date) {
      return tx.cartLine.update({ where: { id: lineId }, data: { quantity, updatedAt: now } });
    },

    deleteLine(tx: Tx, lineId: string) {
      return tx.cartLine.delete({ where: { id: lineId } });
    },

    /**
     * The cart's lines in the order they were added, priced and flagged now (one statement).
     * Pass a transaction to read inside it (checkout does).
     */
    view(cartId: string, now: Date, client: Pick<Tx, '$queryRaw'> = db): Promise<CartViewRow[]> {
      return client.$queryRaw<CartViewRow[]>`
        SELECT l.id, l.variant_id AS "variantId", l.quantity,
               p.slug AS "productSlug", p.name AS "productName", p.currency,
               c.slug AS "colorSlug", c.name AS "colorName",
               s.code AS "sizeCode", s.label AS "sizeLabel",
               COALESCE(v.price_override_amount, p.base_price_amount) AS "unitAmount",
               CASE
                 WHEN p.status <> 'ACTIVE' OR v.status <> 'ACTIVE' OR ${unreleased('p', now)}
                   THEN 'UNAVAILABLE'
                 WHEN v.stock_quantity < l.quantity THEN 'INSUFFICIENT_STOCK'
                 ELSE 'AVAILABLE'
               END AS status,
               (
                 SELECT json_build_object('url', i.url, 'alt', i.alt)
                 FROM product_images i WHERE i.product_id = p.id AND i.is_primary
                 LIMIT 1
               ) AS image
        FROM cart_lines l
        JOIN product_variants v ON v.id = l.variant_id
        JOIN products p ON p.id = v.product_id
        JOIN colors c ON c.id = v.color_id
        JOIN sizes s ON s.id = v.size_id
        WHERE l.cart_id = ${cartId}::uuid
        ORDER BY l.created_at, l.id
      `;
    },
  };
}

export type StoreCartRepository = ReturnType<typeof createStoreCartRepository>;
