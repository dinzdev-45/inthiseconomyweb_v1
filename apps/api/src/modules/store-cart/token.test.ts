import { CART_TOKEN_HEADER, CartToken } from '@ite/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { cartClient } from '../../../test/support/cart.ts';
import {
  createCatalogHarness,
  problem,
  type CatalogHarness,
} from '../../../test/support/catalog.ts';
import { TEST_ENV_SOURCE } from '../../../test/support/env.ts';
import { CART_TTL_MS, hashCartToken } from './token.ts';

let c: CatalogHarness;
let cart: ReturnType<typeof cartClient>;
beforeAll(async () => {
  c = await createCatalogHarness();
  cart = cartClient(c);
});
afterAll(async () => c.close());

describe('store-cart-api: Guest cart tokens', () => {
  it('Create a cart', async () => {
    const res = await cart.call('POST', '/cart');
    expect(res.statusCode).toBe(201);
    expect(res.headers['cache-control']).toBe('no-store');
    const { token, cart: created } = res.json() as { token: string; cart: unknown };
    expect(CartToken.safeParse(token).success).toBe(true);
    expect(created).toEqual({ lines: [], itemCount: 0, subtotal: { amount: 0, currency: 'IDR' } });

    // Only a keyed hash is stored; the token itself appears nowhere in the table.
    const rows = await c.h.db.cart.findMany();
    const row = rows.find(
      (r) => r.tokenHash === hashCartToken(TEST_ENV_SOURCE.SESSION_SECRET, token),
    );
    expect(row).toBeDefined();
    expect(JSON.stringify(rows)).not.toContain(token);
    expect(row!.expiresAt.getTime() - row!.createdAt.getTime()).toBe(CART_TTL_MS);
  });

  it('Cart token in a header only', async () => {
    const { token } = await cart.create();
    expect((await cart.call('GET', '/cart', token)).statusCode).toBe(200);
    for (const url of [`/cart?token=${token}`, `/cart?${CART_TOKEN_HEADER}=${token}`]) {
      problem(await cart.call('GET', url), 404, 'CART_NOT_FOUND');
    }
    // Cookies and authorization headers are not read.
    const viaCookie = await c.h.app.inject({
      method: 'GET',
      url: '/api/v1/store/cart',
      headers: { cookie: `${CART_TOKEN_HEADER}=${token}`, authorization: `Bearer ${token}` },
    });
    problem(viaCookie, 404, 'CART_NOT_FOUND');
  });

  it('Unknown or expired cart', async () => {
    const { token } = await cart.create();
    const details = new Set<string>();
    for (const bad of [undefined, 'not-a-token', 'b'.repeat(43)]) {
      details.add(problem(await cart.call('GET', '/cart', bad), 404, 'CART_NOT_FOUND').detail);
    }
    // A change pushes expiry out; 30 days without one expires the cart.
    c.h.clock.advance(CART_TTL_MS - 1000);
    expect((await cart.call('GET', '/cart', token)).statusCode).toBe(200);
    c.h.clock.advance(2000);
    const expired = problem(await cart.call('GET', '/cart', token), 404, 'CART_NOT_FOUND');
    details.add(expired.detail);
    problem(
      await cart.add(token, { productSlug: 'x', colorSlug: 'y', sizeCode: 'M' }),
      404,
      'CART_NOT_FOUND',
    );
    expect(details.size).toBe(1);
  });
});
