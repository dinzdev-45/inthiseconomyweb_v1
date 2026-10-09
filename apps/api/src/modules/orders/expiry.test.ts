import { StoreOrder } from '@ite/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { sellableProduct } from '../../../test/support/cart.ts';
import { createCatalogHarness, type CatalogHarness } from '../../../test/support/catalog.ts';
import { checkoutClient, stockOf } from '../../../test/support/checkout.ts';
import { PAYMENT_WINDOW_MS } from './keys.ts';
import { createOrderRepository } from './repository.ts';

// A fresh harness per test: these tests move the clock a day forward, past the staff session.
let c: CatalogHarness;
let client: ReturnType<typeof checkoutClient>;
beforeEach(async () => {
  c = await createCatalogHarness();
  client = checkoutClient(c);
});
afterEach(async () => c.close());

async function orderOf(quantity: number, stock: number, name: string) {
  const p = await sellableProduct(c, name, [{ stockQuantity: stock }]);
  const { token } = await client.cart.create();
  await client.cart.added(token, { ...p.variants[0]!.key, quantity });
  return { product: p, variantId: p.variants[0]!.variant.id, token };
}
const statusOf = async (number: string, key: string) =>
  StoreOrder.parse(c.ok(await client.orderResponse(number, key))).status;

describe('store-checkout-api: Unpaid order expiry', () => {
  it('Unpaid order expires', async () => {
    const { variantId, token } = await orderOf(2, 5, 'Expiry One');
    const { order, accessKey } = await client.placeCart(token);
    expect(await stockOf(c, variantId)).toBe(3);

    c.h.clock.advance(PAYMENT_WINDOW_MS - 1000);
    await c.h.app.orderSweeper.runOnce();
    expect(await statusOf(order.number, accessKey)).toBe('AWAITING_PAYMENT');

    c.h.clock.advance(1000);
    expect(await c.h.app.orderSweeper.runOnce()).toBeGreaterThanOrEqual(1);
    expect(await statusOf(order.number, accessKey)).toBe('EXPIRED');
    expect(await stockOf(c, variantId)).toBe(5);

    // Running again changes nothing.
    await c.h.app.orderSweeper.runOnce();
    expect(await stockOf(c, variantId)).toBe(5);
  });

  it('Expiry returns stock once', async () => {
    const { variantId, token } = await orderOf(3, 4, 'Expiry Twice');
    const { order, accessKey } = await client.placeCart(token);
    expect(await stockOf(c, variantId)).toBe(1);
    c.h.clock.advance(PAYMENT_WINDOW_MS);

    // Two independent sweeps (as two API instances would run) over the same order.
    const repo = createOrderRepository(c.h.db);
    const now = c.h.clock.now();
    const [first, second] = await Promise.all([repo.expireDue(now, 100), repo.expireDue(now, 100)]);
    expect(await statusOf(order.number, accessKey)).toBe('EXPIRED');
    expect(await stockOf(c, variantId)).toBe(4);
    expect(first + second).toBeGreaterThanOrEqual(1);
    expect(await c.h.db.order.count({ where: { number: order.number, status: 'EXPIRED' } })).toBe(
      1,
    );
  });

  it('is never started by buildApp', () => {
    expect(c.h.app.orderSweeper.started).toBe(false);
  });
});

describe('product-variants-inventory: Non-negative stock', () => {
  it('Orders and adjustments together', async () => {
    const { product, variantId, token } = await orderOf(3, 5, 'Expiry Together');
    const { total } = await client.summary(token);
    const before = await c.h.db.productVariant.findUniqueOrThrow({ where: { id: variantId } });

    const [placed, adjusted] = await Promise.all([
      client.placeResponse(token, total),
      c.call('POST', `/products/${product.product.id}/variants/${variantId}/stock-adjustments`, {
        delta: -2,
      }),
    ]);
    expect(placed.statusCode).toBe(201);
    expect(adjusted.statusCode).toBe(200);
    expect(await stockOf(c, variantId)).toBe(0);

    const afterBoth = await c.h.db.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    // Only the staff adjustment set attribution.
    expect(afterBoth.updatedById).toBe(c.owner.id);
    expect(afterBoth.updatedAt.getTime()).toBeGreaterThanOrEqual(before.updatedAt.getTime());

    c.h.clock.advance(PAYMENT_WINDOW_MS);
    await c.h.app.orderSweeper.runOnce();
    const afterExpiry = await c.h.db.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    expect(afterExpiry.stockQuantity).toBe(3);
    expect(afterExpiry.updatedById).toBe(c.owner.id);
    expect(afterExpiry.updatedAt).toEqual(afterBoth.updatedAt);
  });
});
