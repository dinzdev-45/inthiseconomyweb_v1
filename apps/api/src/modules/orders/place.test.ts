import { CartToken } from '@ite/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { sellableProduct } from '../../../test/support/cart.ts';
import {
  createCatalogHarness,
  idr,
  problem,
  type CatalogHarness,
} from '../../../test/support/catalog.ts';
import { checkoutClient, DETAILS, stockOf } from '../../../test/support/checkout.ts';
import { TEST_ENV_SOURCE } from '../../../test/support/env.ts';
import { hashOrderKey, PAYMENT_WINDOW_MS } from './keys.ts';

let c: CatalogHarness;
let client: ReturnType<typeof checkoutClient>;
beforeAll(async () => {
  c = await createCatalogHarness();
  client = checkoutClient(c);
});
afterAll(async () => c.close());

const orderCount = () => c.h.db.order.count();

describe('store-checkout-api: Place an order', () => {
  it('Place an order', async () => {
    const a = await sellableProduct(c, 'Place Hoodie', [
      { stockQuantity: 5, priceOverride: idr(69_900_000) },
    ]);
    const b = await sellableProduct(c, 'Place Zip', [
      { stockQuantity: 5, priceOverride: idr(82_900_000) },
    ]);
    const { token } = await client.cart.create();
    await client.cart.added(token, { ...a.variants[0]!.key, quantity: 2 });
    await client.cart.added(token, b.variants[0]!.key);

    const { order, accessKey } = await client.placeCart(token);
    expect(CartToken.safeParse(accessKey).success).toBe(true); // same 43-character shape
    expect(order.number).toMatch(/^ITE-[0-9A-HJKMNP-TV-Z]{8}$/);
    expect(order).toMatchObject({
      status: 'AWAITING_PAYMENT',
      subtotal: idr(222_700_000),
      shippingFee: idr(2_000_000),
      total: idr(224_700_000),
      contact: { email: 'ana@example.com', name: 'Ana Putri', phone: '+6281234567890' },
      delivery: {
        line1: 'Jl. Melati No. 5',
        line2: 'Blok C',
        city: 'Bandung',
        province: { code: '32', name: 'Jawa Barat' },
        postalCode: '40115',
      },
      note: 'Leave with the guard',
    });
    expect(order.lines).toEqual([
      {
        productName: 'Place Hoodie',
        productSlug: a.product.slug,
        colorName: a.variants[0]!.key.colorSlug,
        sizeCode: a.variants[0]!.key.sizeCode,
        unitPrice: idr(69_900_000),
        quantity: 2,
        lineTotal: idr(139_800_000),
      },
      expect.objectContaining({
        productName: 'Place Zip',
        quantity: 1,
        lineTotal: idr(82_900_000),
      }),
    ]);
    expect(Date.parse(order.paymentDeadline) - Date.parse(order.placedAt)).toBe(PAYMENT_WINDOW_MS);
    expect(order.placedAt).toBe(c.h.clock.now().toISOString());

    // Stock taken, cart emptied, and only a hash of the key stored.
    expect(await stockOf(c, a.variants[0]!.variant.id)).toBe(3);
    expect(await stockOf(c, b.variants[0]!.variant.id)).toBe(4);
    expect((await client.cart.get(token)).lines).toEqual([]);
    const row = await c.h.db.order.findUniqueOrThrow({ where: { number: order.number } });
    expect(row.accessKeyHash).toBe(hashOrderKey(TEST_ENV_SOURCE.SESSION_SECRET, accessKey));
    expect(JSON.stringify(row, (_, v) => (typeof v === 'bigint' ? Number(v) : v))).not.toContain(
      accessKey,
    );

    // A double submit finds the cart empty and creates nothing.
    problem(await client.placeResponse(token, order.total), 409, 'CART_EMPTY');
  });

  it('Order needs a sellable cart', async () => {
    const before = await orderCount();
    const { token: empty } = await client.cart.create();
    problem(await client.placeResponse(empty, idr(2_000_000)), 409, 'CART_EMPTY');

    const gone = await sellableProduct(c, 'Place Gone', [{ stockQuantity: 5 }]);
    const { token } = await client.cart.create();
    await client.cart.added(token, gone.variants[0]!.key);
    const { total } = await client.summary(token);
    c.ok(await c.call('POST', `/products/${gone.product.id}/deactivate`));
    problem(await client.placeResponse(token, total), 409, 'CART_CHANGED');

    expect(await orderCount()).toBe(before);
    expect(await stockOf(c, gone.variants[0]!.variant.id)).toBe(5);
    expect((await client.cart.get(token)).lines).toHaveLength(1);
  });

  it('Prices changed since the summary', async () => {
    const p = await sellableProduct(c, 'Place Price', [{ stockQuantity: 5 }]);
    const { token } = await client.cart.create();
    await client.cart.added(token, p.variants[0]!.key);
    const { total } = await client.summary(token);
    c.ok(
      await c.call('PATCH', `/products/${p.product.id}/variants/${p.variants[0]!.variant.id}`, {
        priceOverride: idr(99_900_000),
      }),
    );
    const before = await orderCount();
    problem(await client.placeResponse(token, total), 409, 'CART_CHANGED');
    expect(await orderCount()).toBe(before);
    expect(await stockOf(c, p.variants[0]!.variant.id)).toBe(5);
    // With the new total it goes through.
    const fresh = await client.summary(token);
    expect((await client.place(token, fresh.total)).order.total).toEqual(idr(101_900_000));
    // A total in another currency is never accepted.
    const { token: other } = await client.cart.create();
    await client.cart.added(other, p.variants[0]!.key);
    const { total: t } = await client.summary(other);
    problem(
      await client.placeResponse(other, { amount: t.amount, currency: 'USD' }),
      409,
      'CART_CHANGED',
    );
  });

  it('Last unit sold once', async () => {
    const p = await sellableProduct(c, 'Place Last', [{ stockQuantity: 1 }]);
    const tokens = [];
    for (let i = 0; i < 2; i++) {
      const { token } = await client.cart.create();
      await client.cart.added(token, p.variants[0]!.key);
      tokens.push(token);
    }
    const total = (await client.summary(tokens[0]!)).total;
    const before = await orderCount();
    const results = await Promise.all(tokens.map((token) => client.placeResponse(token, total)));
    expect(results.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    problem(
      results.find((r) => r.statusCode === 409)!,
      409,
      'CART_CHANGED',
    );
    expect(await orderCount()).toBe(before + 1);
    expect(await stockOf(c, p.variants[0]!.variant.id)).toBe(0);
  });

  it('Invalid checkout details', async () => {
    const p = await sellableProduct(c, 'Place Invalid', [{ stockQuantity: 5 }]);
    const { token } = await client.cart.create();
    await client.cart.added(token, p.variants[0]!.key);
    const { total } = await client.summary(token);
    const before = await orderCount();
    const body = problem(
      await client.placeResponse(token, total, {
        ...DETAILS,
        email: 'not-an-email',
        phone: '021 555 1234',
        address: { ...DETAILS.address, province: '99', postalCode: '4011' },
        coupon: 'FREE',
      }),
      400,
      'VALIDATION_FAILED',
    );
    const paths = body.errors!.map((error) => error.path);
    for (const field of ['email', 'phone', 'address.province', 'address.postalCode', 'coupon']) {
      expect(paths.some((path) => path.endsWith(field))).toBe(true);
    }
    expect(JSON.stringify(body)).not.toContain('not-an-email');
    expect(await orderCount()).toBe(before);
    expect(await stockOf(c, p.variants[0]!.variant.id)).toBe(5);
  });
});
