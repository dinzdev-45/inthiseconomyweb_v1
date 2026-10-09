import { PassThrough } from 'node:stream';

import { StoreOrder } from '@ite/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { sellableProduct } from '../../../test/support/cart.ts';
import {
  createCatalogHarness,
  idr,
  problem,
  type CatalogHarness,
} from '../../../test/support/catalog.ts';
import { checkoutClient, DETAILS } from '../../../test/support/checkout.ts';

let c: CatalogHarness;
let client: ReturnType<typeof checkoutClient>;
const logs: string[] = [];
beforeAll(async () => {
  const logStream = new PassThrough();
  logStream.on('data', (chunk: Buffer) => logs.push(chunk.toString()));
  // Log everything (info and up), so the test can prove guest details never reach the log.
  c = await createCatalogHarness({ LOG_LEVEL: 'trace' }, { logStream });
  client = checkoutClient(c);
});
afterAll(async () => c.close());

async function placedOrder(name: string) {
  const p = await sellableProduct(c, name, [{ stockQuantity: 5 }]);
  const { token } = await client.cart.create();
  await client.cart.added(token, p.variants[0]!.key);
  return { product: p, ...(await client.placeCart(token)) };
}

describe('store-checkout-api: Guest order view', () => {
  it('View an order with its key', async () => {
    const { order, accessKey } = await placedOrder('View Key');
    const res = await client.orderResponse(order.number, accessKey);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(StoreOrder.parse(c.ok(res))).toEqual(order);
  });

  it('Wrong or missing order key', async () => {
    const mine = await placedOrder('View Mine');
    const theirs = await placedOrder('View Theirs');
    const details = new Set<string>();
    for (const res of [
      await client.orderResponse(mine.order.number),
      await client.orderResponse(mine.order.number, theirs.accessKey),
      await client.orderResponse(mine.order.number, 'short'),
      await client.orderResponse('ITE-00000000', mine.accessKey),
      await client.orderResponse('not-a-number', mine.accessKey),
      await c.h.app.inject({
        method: 'GET',
        url: `/api/v1/store/orders/${mine.order.number}?key=${mine.accessKey}`,
      }),
    ]) {
      details.add(problem(res, 404, 'ORDER_NOT_FOUND').detail);
    }
    expect(details.size).toBe(1);
  });

  it('Order keeps what was ordered', async () => {
    const { order, accessKey, product } = await placedOrder('View Snapshot');
    c.ok(await c.call('PATCH', `/products/${product.product.id}`, { name: 'Renamed Snapshot' }));
    c.ok(
      await c.call(
        'PATCH',
        `/products/${product.product.id}/variants/${product.variants[0]!.variant.id}`,
        {
          priceOverride: idr(10_000_000),
        },
      ),
    );
    c.ok(await c.call('POST', `/products/${product.product.id}/deactivate`));
    const again = StoreOrder.parse(c.ok(await client.orderResponse(order.number, accessKey)));
    expect(again.lines[0]).toMatchObject({
      productName: 'View Snapshot',
      unitPrice: idr(89_900_000),
    });
    expect(again.total).toEqual(order.total);
  });
});

describe('store-checkout-api: Guest order view (privacy)', () => {
  it('never writes guest contact or address details to the log', async () => {
    const { order, accessKey } = await placedOrder('View Logs');
    c.ok(await client.orderResponse(order.number, accessKey));
    // A rejected request with invalid details is logged too, and must not echo them either.
    await client.placeResponse('x'.repeat(43), idr(1), { ...DETAILS, email: 'leak@example.com' });
    const text = logs.join('');
    expect(text.length).toBeGreaterThan(0);
    for (const secret of [
      'ana@example.com',
      'Ana@Example.com',
      'leak@example.com',
      'Ana Putri',
      '+6281234567890',
      '0812 3456 7890',
      'Jl. Melati',
      '40115',
      'Leave with the guard',
      accessKey,
    ]) {
      expect(text).not.toContain(secret);
    }
  });
});
