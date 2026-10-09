import {
  CartToken,
  OrderAccessKey,
  OrderNumber,
  provinceName,
  type CheckoutSummary,
  type Money,
  type PlaceOrderRequest,
  type PlaceOrderResponse,
  type StoreOrder,
} from '@ite/contracts';
import { Prisma } from '@ite/db';

import type { Clock } from '../../clock.ts';
import { DomainError } from '../../errors.ts';
import type { StoreCartRepository } from '../store-cart/repository.ts';
import { CART_TTL_MS, hashCartToken } from '../store-cart/token.ts';
import { toStoreCart } from '../store-cart/view.ts';
import type { OrderRepository, OrderRow } from './repository.ts';
import { generateOrderKey, generateOrderNumber, hashOrderKey, PAYMENT_WINDOW_MS } from './keys.ts';

/*
 * Guest checkout and orders (store-checkout-api spec, guest-checkout design D3). Placing an order
 * is one transaction: re-check the cart, take the stock, copy the lines, empty the cart.
 */

const errors = {
  cartNotFound: () => new DomainError('CART_NOT_FOUND', 404, 'Cart not found.'),
  cartEmpty: () => new DomainError('CART_EMPTY', 409, 'Your cart is empty.'),
  cartChanged: () =>
    new DomainError('CART_CHANGED', 409, 'Your cart changed. Review it and try again.'),
  orderNotFound: () => new DomainError('ORDER_NOT_FOUND', 404, 'Order not found.'),
};
/** Retries for the (astronomically rare) order number collision. */
const NUMBER_ATTEMPTS = 5;

export type ShippingSettings = { flatFee: number; freeThreshold: number | undefined };

export function createOrderService({
  orders,
  carts,
  clock,
  secret,
  storeCurrency,
  shipping,
}: {
  orders: OrderRepository;
  carts: StoreCartRepository;
  clock: Clock;
  secret: string;
  storeCurrency: string;
  shipping: ShippingSettings;
}) {
  const money = (amount: number): Money => ({ amount, currency: storeCurrency });
  const shippingFee = (subtotal: number) =>
    shipping.freeThreshold !== undefined && subtotal >= shipping.freeThreshold
      ? 0
      : shipping.flatFee;

  function cartHash(token: string | undefined): string {
    if (!CartToken.safeParse(token).success) throw errors.cartNotFound();
    return hashCartToken(secret, token!);
  }

  function toOrder(row: OrderRow): StoreOrder {
    return {
      number: row.number,
      status: row.status,
      placedAt: row.placedAt.toISOString(),
      paymentDeadline: row.paymentDeadline.toISOString(),
      lines: row.lines.map((line) => ({
        productName: line.productName,
        productSlug: line.productSlug,
        colorName: line.colorName,
        sizeCode: line.sizeCode,
        unitPrice: { amount: line.unitAmount, currency: row.currency },
        quantity: line.quantity,
        lineTotal: { amount: Number(line.lineTotalAmount), currency: row.currency },
      })),
      subtotal: { amount: Number(row.subtotalAmount), currency: row.currency },
      shippingFee: { amount: row.shippingFeeAmount, currency: row.currency },
      total: { amount: Number(row.totalAmount), currency: row.currency },
      contact: { email: row.email, name: row.name, phone: row.phone },
      delivery: {
        line1: row.addressLine1,
        line2: row.addressLine2,
        city: row.city,
        province: { code: row.province, name: provinceName(row.province) ?? row.province },
        postalCode: row.postalCode,
      },
      note: row.note,
    };
  }

  async function placeOnce(token: string | undefined, details: PlaceOrderRequest) {
    const hash = cartHash(token);
    const now = clock.now();
    const accessKey = generateOrderKey();
    const row = await orders.transaction(async (tx) => {
      const cart = await carts.lockLive(tx, hash, now);
      if (!cart) throw errors.cartNotFound();
      const rows = await carts.view(cart.id, now, tx);
      if (rows.length === 0) throw errors.cartEmpty();
      if (rows.some((line) => line.status !== 'AVAILABLE')) throw errors.cartChanged();

      const subtotal = rows.reduce((sum, line) => sum + line.unitAmount * line.quantity, 0);
      const fee = shippingFee(subtotal);
      const total = subtotal + fee;
      const expected = details.expectedTotal;
      if (expected.amount !== total || expected.currency !== storeCurrency) {
        throw errors.cartChanged();
      }

      // Take stock in variant id order (the lock order admin variant writes use).
      for (const line of [...rows].sort((a, b) => a.variantId.localeCompare(b.variantId))) {
        if (!(await orders.takeStock(tx, line.variantId, line.quantity, now))) {
          throw errors.cartChanged();
        }
      }

      const created = await orders.create(tx, {
        number: generateOrderNumber(),
        accessKeyHash: hashOrderKey(secret, accessKey),
        email: details.email,
        name: details.name,
        phone: details.phone,
        addressLine1: details.address.line1,
        addressLine2: details.address.line2 ?? null,
        city: details.address.city,
        province: details.address.province,
        postalCode: details.address.postalCode,
        note: details.note ?? null,
        subtotalAmount: subtotal,
        shippingFeeAmount: fee,
        totalAmount: total,
        currency: storeCurrency,
        paymentDeadline: new Date(now.getTime() + PAYMENT_WINDOW_MS),
        placedAt: now,
        lines: rows.map((line) => ({
          variantId: line.variantId,
          productName: line.productName,
          productSlug: line.productSlug,
          colorName: line.colorName,
          sizeCode: line.sizeCode,
          unitAmount: line.unitAmount,
          quantity: line.quantity,
          lineTotalAmount: line.unitAmount * line.quantity,
        })),
      });
      await orders.emptyCart(tx, cart.id);
      await carts.touch(tx, cart.id, now, new Date(now.getTime() + CART_TTL_MS));
      return created;
    });
    return { order: toOrder(row), accessKey };
  }

  const isNumberCollision = (error: unknown) =>
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    JSON.stringify(error.meta ?? {}).includes('number');

  return {
    async summary(token: string | undefined): Promise<CheckoutSummary> {
      const cart = await carts.findLive(cartHash(token), clock.now());
      if (!cart) throw errors.cartNotFound();
      const rows = await carts.view(cart.id, clock.now());
      const { lines, subtotal } = toStoreCart(rows, storeCurrency);
      const fee = shippingFee(subtotal.amount);
      return {
        lines,
        subtotal,
        shippingFee: money(fee),
        total: money(subtotal.amount + fee),
        ready: lines.length > 0 && lines.every((line) => line.status === 'AVAILABLE'),
      };
    },

    /** Places an order from the cart; all or nothing (see the module comment). */
    async place(
      token: string | undefined,
      details: PlaceOrderRequest,
    ): Promise<PlaceOrderResponse> {
      for (let attempt = 1; ; attempt++) {
        try {
          return await placeOnce(token, details);
        } catch (error) {
          if (attempt < NUMBER_ATTEMPTS && isNumberCollision(error)) continue;
          throw error;
        }
      }
    },

    /** The order to whoever holds its key; every miss looks the same. */
    async get(number: string, key: string | undefined): Promise<StoreOrder> {
      if (!OrderNumber.safeParse(number).success || !OrderAccessKey.safeParse(key).success) {
        throw errors.orderNotFound();
      }
      const row = await orders.findByNumberAndKey(number, hashOrderKey(secret, key!));
      if (!row) throw errors.orderNotFound();
      return toOrder(row);
    },

    /** Expires unpaid orders past their deadline, in batches; returns how many expired. */
    async expireDue(batchSize = 100): Promise<number> {
      const now = clock.now();
      let total = 0;
      for (;;) {
        const expired = await orders.expireDue(now, batchSize);
        total += expired;
        if (expired < batchSize) return total;
      }
    },
  };
}

export type OrderService = ReturnType<typeof createOrderService>;
