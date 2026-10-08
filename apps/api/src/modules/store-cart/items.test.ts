import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { cartClient, sellableProduct } from '../../../test/support/cart.ts';
import {
  createCatalogHarness,
  idr,
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

describe('store-cart-api: Add to cart', () => {
  it('Add a variant', async () => {
    const { product, variants } = await sellableProduct(c, 'Cart Hoodie');
    const { token } = await cart.create();
    const res = await cart.add(token, variants[0]!.key);
    expect(res.headers['cache-control']).toBe('no-store');
    const updated = await cart.get(token);
    expect(updated.lines).toHaveLength(1);
    expect(updated.lines[0]).toMatchObject({
      product: { slug: product.slug, name: 'Cart Hoodie' },
      color: { slug: variants[0]!.key.colorSlug },
      size: { code: variants[0]!.key.sizeCode },
      quantity: 1,
      unitPrice: idr(89_900_000),
      lineTotal: idr(89_900_000),
      status: 'AVAILABLE',
    });
    expect(updated.lines[0]!.product.image).not.toBeNull();
    expect(updated).toMatchObject({ itemCount: 1, subtotal: idr(89_900_000) });
  });

  it('Add the same variant again', async () => {
    const { variants } = await sellableProduct(c, 'Cart Repeat');
    const { token } = await cart.create();
    await cart.added(token, { ...variants[0]!.key, quantity: 2 });
    const after = await cart.added(token, variants[0]!.key);
    expect(after.lines).toHaveLength(1);
    expect(after.lines[0]!.quantity).toBe(3);
    expect(after.itemCount).toBe(3);
  });

  it('Variant that cannot be sold', async () => {
    const draft = await c.product({ name: 'Cart Draft' });
    const draftSize = await c.size();
    const draftColor = await c.color();
    await c.variant(draft.id, { sizeId: draftSize.id, colorId: draftColor.id });

    const inactive = await sellableProduct(c, 'Cart Inactive');
    c.ok(await c.call('POST', `/products/${inactive.product.id}/deactivate`));
    const archived = await sellableProduct(c, 'Cart Archived');
    c.ok(await c.call('POST', `/products/${archived.product.id}/deactivate`));
    c.ok(await c.call('POST', `/products/${archived.product.id}/archive`));
    const twoVariants = await sellableProduct(c, 'Cart Two', [
      { stockQuantity: 5 },
      { stockQuantity: 5 },
    ]);
    const [first, second] = twoVariants.variants;
    c.ok(
      await c.call(
        'POST',
        `/products/${twoVariants.product.id}/variants/${second!.variant.id}/deactivate`,
      ),
    );

    const { token } = await cart.create();
    for (const key of [
      { productSlug: draft.slug, colorSlug: draftColor.slug, sizeCode: draftSize.code },
      inactive.variants[0]!.key,
      archived.variants[0]!.key,
      second!.key, // inactive variant
      { ...first!.key, sizeCode: second!.key.sizeCode }, // combination that does not exist
      { productSlug: 'no-such-product', colorSlug: 'black', sizeCode: 'M' },
    ]) {
      problem(await cart.add(token, key), 409, 'VARIANT_UNAVAILABLE');
    }
    expect((await cart.get(token)).lines).toEqual([]);
  });

  it('Quantity and stock limits', async () => {
    const { variants } = await sellableProduct(c, 'Cart Limits', [
      { stockQuantity: 20 },
      { stockQuantity: 4 },
      { stockQuantity: 0 },
    ]);
    const [plenty, four, none] = variants;
    const { token } = await cart.create();

    await cart.added(token, { ...plenty!.key, quantity: 10 });
    problem(await cart.add(token, plenty!.key), 409, 'QUANTITY_LIMIT');

    const stock = problem(
      await cart.add(token, { ...four!.key, quantity: 5 }),
      409,
      'INSUFFICIENT_STOCK',
    );
    expect(stock.detail).not.toMatch(/\d/);
    problem(await cart.add(token, none!.key), 409, 'INSUFFICIENT_STOCK');

    const after = await cart.get(token);
    expect(after.lines.map((line) => line.quantity)).toEqual([10]);
    expect(JSON.stringify(after)).not.toMatch(/stock/i);
  });
});

describe('store-cart-api: Add to cart (robustness)', () => {
  it('serializes concurrent adds to the same line', async () => {
    const { variants } = await sellableProduct(c, 'Cart Concurrent', [{ stockQuantity: 10 }]);
    const { token } = await cart.create();
    const [a, b] = await Promise.all([
      cart.add(token, { ...variants[0]!.key, quantity: 6 }),
      cart.add(token, { ...variants[0]!.key, quantity: 6 }),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
    expect((await cart.get(token)).lines[0]!.quantity).toBe(6);

    await Promise.all([
      cart.added(token, { ...variants[0]!.key, quantity: 2 }),
      cart.added(token, { ...variants[0]!.key, quantity: 2 }),
    ]);
    expect((await cart.get(token)).lines[0]!.quantity).toBe(10);
  });

  it('holds at most 50 lines', async () => {
    const product = await c.product({ name: 'Cart Many' });
    const keys = [];
    for (let i = 0; i < 51; i++) {
      const size = await c.size();
      const color = await c.color();
      const variant = await c.variant(product.id, {
        sizeId: size.id,
        colorId: color.id,
        stockQuantity: 3,
      });
      keys.push({
        variant,
        key: { productSlug: product.slug, colorSlug: color.slug, sizeCode: size.code },
      });
    }
    await c.image(product.id);
    await c.activate(product.id);
    const { token } = await cart.create();
    const cartRow = (await c.h.db.cart.findUnique({
      where: { tokenHash: hashCartToken(TEST_ENV_SOURCE.SESSION_SECRET, token) },
    }))!;
    await c.h.db.cartLine.createMany({
      data: keys
        .slice(0, 50)
        .map(({ variant }) => ({ cartId: cartRow.id, variantId: variant.id, quantity: 1 })),
    });
    problem(await cart.add(token, keys[50]!.key), 409, 'CART_FULL');
    // Adding to an existing line is still fine.
    expect((await cart.added(token, keys[0]!.key)).lines).toHaveLength(50);
  });

  it('pushes expiry out on every change', async () => {
    const { variants } = await sellableProduct(c, 'Cart Expiry');
    const { token } = await cart.create();
    c.h.clock.advance(CART_TTL_MS - 60_000);
    await cart.added(token, variants[0]!.key);
    c.h.clock.advance(120_000); // past the first 30 days, within 30 days of the change
    expect((await cart.get(token)).itemCount).toBe(1);
  });
});
