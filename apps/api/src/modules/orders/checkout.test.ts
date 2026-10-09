import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { sellableProduct } from '../../../test/support/cart.ts';
import {
  createCatalogHarness,
  idr,
  problem,
  type CatalogHarness,
} from '../../../test/support/catalog.ts';
import { checkoutClient } from '../../../test/support/checkout.ts';

let c: CatalogHarness;
let free: CatalogHarness;
beforeAll(async () => {
  c = await createCatalogHarness();
  // Free shipping from Rp 1.500.000 (minor units).
  free = await createCatalogHarness({ FREE_SHIPPING_THRESHOLD: '150000000' });
});
afterAll(async () => {
  await c.close();
  await free.close();
});

/** A cart holding a Rp 699.000 and a Rp 829.000 item (subtotal Rp 1.528.000). */
async function twoLineCart(h: CatalogHarness) {
  const client = checkoutClient(h);
  const a = await sellableProduct(h, 'Summary Hoodie', [
    { stockQuantity: 5, priceOverride: idr(69_900_000) },
  ]);
  const b = await sellableProduct(h, 'Summary Zip', [
    { stockQuantity: 5, priceOverride: idr(82_900_000) },
  ]);
  const { token } = await client.cart.create();
  await client.cart.added(token, a.variants[0]!.key);
  await client.cart.added(token, b.variants[0]!.key);
  return { client, token, a, b };
}

describe('store-checkout-api: Checkout summary', () => {
  it('Checkout summary', async () => {
    const { client, token } = await twoLineCart(c);
    const res = await client.summaryResponse(token);
    expect(res.headers['cache-control']).toBe('no-store');
    const summary = await client.summary(token);
    expect(summary.lines.map((line) => line.product.name)).toEqual([
      'Summary Hoodie',
      'Summary Zip',
    ]);
    expect(summary).toMatchObject({
      subtotal: idr(152_800_000),
      shippingFee: idr(2_000_000),
      total: idr(154_800_000),
      ready: true,
    });
  });

  it('Free shipping threshold', async () => {
    const { client, token, a } = await twoLineCart(free);
    expect(await client.summary(token)).toMatchObject({
      subtotal: idr(152_800_000),
      shippingFee: idr(0),
      total: idr(152_800_000),
    });
    const { token: small } = await client.cart.create();
    await client.cart.added(small, a.variants[0]!.key);
    expect(await client.summary(small)).toMatchObject({
      subtotal: idr(69_900_000),
      shippingFee: idr(2_000_000),
      total: idr(71_900_000),
    });
  });

  it('Cart that cannot be checked out', async () => {
    const client = checkoutClient(c);
    const { token: empty } = await client.cart.create();
    expect(await client.summary(empty)).toMatchObject({
      lines: [],
      ready: false,
      total: idr(2_000_000),
    });

    const gone = await sellableProduct(c, 'Summary Gone');
    const { token } = await client.cart.create();
    await client.cart.added(token, gone.variants[0]!.key);
    c.ok(await c.call('POST', `/products/${gone.product.id}/deactivate`));
    expect((await client.summary(token)).ready).toBe(false);

    problem(await client.summaryResponse('x'.repeat(43)), 404, 'CART_NOT_FOUND');
    problem(await client.summaryResponse(), 404, 'CART_NOT_FOUND');
  });
});
