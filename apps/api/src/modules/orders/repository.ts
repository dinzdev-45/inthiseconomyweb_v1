import type { OrderStatus, PrismaClient } from '@ite/db';

import type { Tx } from '../store-cart/repository.ts';

/** What placing an order writes (lines are copies of the cart view rows). */
export type NewOrder = {
  number: string;
  accessKeyHash: string;
  email: string;
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  province: string;
  postalCode: string;
  note: string | null;
  subtotalAmount: number;
  shippingFeeAmount: number;
  totalAmount: number;
  currency: string;
  paymentDeadline: Date;
  placedAt: Date;
  lines: {
    variantId: string;
    productName: string;
    productSlug: string;
    colorName: string;
    sizeCode: string;
    unitAmount: number;
    quantity: number;
    lineTotalAmount: number;
  }[];
};

const ORDER_INCLUDE = { lines: { orderBy: { position: 'asc' } } } as const;

/** Database access for orders. The only Prisma caller in this module. */
export function createOrderRepository(db: PrismaClient) {
  return {
    transaction<T>(fn: (tx: Tx) => Promise<T>) {
      return db.$transaction(fn);
    },

    /**
     * Takes `quantity` from a sellable variant's stock, atomically: zero rows means it is no longer
     * ACTIVE or has too little stock. Attribution is left alone (orders are not staff changes).
     */
    async takeStock(tx: Tx, variantId: string, quantity: number): Promise<boolean> {
      const updated = await tx.$executeRaw`
        UPDATE product_variants v
        SET stock_quantity = v.stock_quantity - ${quantity}::integer
        FROM products p
        WHERE v.id = ${variantId}::uuid AND p.id = v.product_id
          AND v.status = 'ACTIVE' AND p.status = 'ACTIVE'
          AND v.stock_quantity >= ${quantity}::integer
      `;
      return updated === 1;
    },

    create(tx: Tx, order: NewOrder) {
      const { lines, subtotalAmount, totalAmount, placedAt, ...fields } = order;
      return tx.order.create({
        data: {
          ...fields,
          subtotalAmount: BigInt(subtotalAmount),
          totalAmount: BigInt(totalAmount),
          placedAt,
          updatedAt: placedAt,
          lines: {
            create: lines.map((line, position) => ({
              ...line,
              lineTotalAmount: BigInt(line.lineTotalAmount),
              position,
            })),
          },
        },
        include: ORDER_INCLUDE,
      });
    },

    emptyCart(tx: Tx, cartId: string) {
      return tx.cartLine.deleteMany({ where: { cartId } });
    },

    findByNumberAndKey(number: string, accessKeyHash: string) {
      return db.order.findFirst({ where: { number, accessKeyHash }, include: ORDER_INCLUDE });
    },

    /**
     * Expires up to `limit` unpaid orders past their deadline and returns their stock, in one
     * transaction. `SKIP LOCKED` keeps concurrent sweepers off each other's orders, and the status
     * change commits with the stock return, so each order's stock comes back exactly once.
     */
    expireDue(now: Date, limit: number): Promise<number> {
      return db.$transaction(async (tx) => {
        const due = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM orders
          WHERE status = 'AWAITING_PAYMENT' AND payment_deadline <= ${now}
          ORDER BY payment_deadline, id
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
        `;
        if (due.length === 0) return 0;
        const ids = due.map((row) => row.id);
        // Return stock per variant, in variant id order (the same lock order as checkout).
        await tx.$executeRaw`
          UPDATE product_variants v
          SET stock_quantity = v.stock_quantity + t.quantity
          FROM (
            SELECT variant_id, SUM(quantity)::integer AS quantity
            FROM order_lines WHERE order_id = ANY(${ids}::uuid[])
            GROUP BY variant_id ORDER BY variant_id
          ) t
          WHERE v.id = t.variant_id
        `;
        const status: OrderStatus = 'EXPIRED';
        await tx.order.updateMany({
          where: { id: { in: ids } },
          data: { status, expiredAt: now, updatedAt: now },
        });
        return ids.length;
      });
    },
  };
}

export type OrderRepository = ReturnType<typeof createOrderRepository>;
export type OrderRow = NonNullable<Awaited<ReturnType<OrderRepository['findByNumberAndKey']>>>;
