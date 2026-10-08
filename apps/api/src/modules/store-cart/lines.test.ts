import { StoreCart } from '@ite/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { cartClient, sellableProduct } from '../../../test/support/cart.ts';
import {
  createCatalogHarness,
  idr,
  problem,
  UNKNOWN_ID,
  type CatalogHarness,
} from '../../../test/support/catalog.ts';

let c: CatalogHarness;
let cart: ReturnType<typeof cartClient>;
beforeAll(async () => {
  c = await createCatalogHarness();
  cart = cartClient(c);
});
afterAll(async () => c.close());

/** A new cart holding `quantity` of the product's first variant; returns the token and line id. */
async function cartWith(key: object, quantity = 1) {
  const { token } = await cart.create();
  const added = await cart.added(token, { ...key, quantity });
  return { token, lineId: added.lines[0]!.id };
}

describe('store-cart-api: Change and remove cart lines', () => {
  it('Change a quantity', async () => {
    const { variants } = await sellableProduct(c, 'Lines Change', [{ stockQuantity: 5 }]);
    const { token, lineId } = await cartWith(variants[0]!.key);
    const changed = StoreCart.parse(c.ok(await cart.update(token, lineId, 3)));
    expect(changed.lines[0]!.quantity).toBe(3);
    expect(changed.subtotal).toEqual(idr(3 * 89_900_000));
    problem(await cart.update(token, lineId, 6), 409, 'INSUFFICIENT_STOCK');
    problem(await cart.update(token, lineId, 11), 400, 'VALIDATION_FAILED');
    problem(await cart.update(token, lineId, 0), 400, 'VALIDATION_FAILED');
    expect((await cart.get(token)).lines[0]!.quantity).toBe(3);
  });

  it('Remove a line', async () => {
    const { variants } = await sellableProduct(c, 'Lines Remove');
    const { token, lineId } = await cartWith(variants[0]!.key);
    const removed = StoreCart.parse(c.ok(await cart.remove(token, lineId)));
    expect(removed).toEqual({ lines: [], itemCount: 0, subtotal: idr(0) });
    problem(await cart.remove(token, lineId), 404, 'NOT_FOUND');
    problem(await cart.remove(token, UNKNOWN_ID), 404, 'NOT_FOUND');
  });

  it("Another cart's line", async () => {
    const { variants } = await sellableProduct(c, 'Lines Other');
    const a = await cartWith(variants[0]!.key, 2);
    const b = await cartWith(variants[0]!.key, 1);
    problem(await cart.update(b.token, a.lineId, 1), 404, 'NOT_FOUND');
    problem(await cart.remove(b.token, a.lineId), 404, 'NOT_FOUND');
    expect((await cart.get(a.token)).lines[0]!.quantity).toBe(2);
    expect((await cart.get(b.token)).lines[0]!.quantity).toBe(1);
  });
});

describe('store-cart-api: Cart view', () => {
  it('Current prices in the cart', async () => {
    const { product, variants } = await sellableProduct(c, 'View Price', [{ stockQuantity: 5 }]);
    const { token } = await cartWith(variants[0]!.key, 2);
    c.ok(
      await c.call('PATCH', `/products/${product.id}/variants/${variants[0]!.variant.id}`, {
        priceOverride: idr(79_900_000),
      }),
    );
    const view = await cart.get(token);
    expect(view.lines[0]).toMatchObject({
      unitPrice: idr(79_900_000),
      lineTotal: idr(159_800_000),
    });
    expect(view.subtotal).toEqual(idr(159_800_000));
  });

  it('Line that is no longer available', async () => {
    const gone = await sellableProduct(c, 'View Gone', [{ stockQuantity: 5 }]);
    const low = await sellableProduct(c, 'View Low', [{ stockQuantity: 5 }]);
    const fine = await sellableProduct(c, 'View Fine', [{ stockQuantity: 5 }]);
    const { token } = await cart.create();
    await cart.added(token, { ...gone.variants[0]!.key, quantity: 2 });
    await cart.added(token, { ...low.variants[0]!.key, quantity: 4 });
    await cart.added(token, fine.variants[0]!.key);

    c.ok(await c.call('POST', `/products/${gone.product.id}/deactivate`));
    c.ok(
      await c.call(
        'POST',
        `/products/${low.product.id}/variants/${low.variants[0]!.variant.id}/stock-adjustments`,
        { delta: -3 },
      ),
    );

    const view = await cart.get(token);
    expect(view.lines.map((line) => line.status)).toEqual([
      'UNAVAILABLE',
      'INSUFFICIENT_STOCK',
      'AVAILABLE',
    ]);
    expect(view.itemCount).toBe(1);
    expect(view.subtotal).toEqual(idr(89_900_000));
    expect(JSON.stringify(view)).not.toMatch(/stock"|"2"|stockQuantity/);

    // Lowering is always allowed, raising an unavailable line is not, and removing always works.
    const [goneLine, lowLine] = view.lines;
    c.ok(await cart.update(token, goneLine!.id, 1));
    problem(await cart.update(token, goneLine!.id, 2), 409, 'VARIANT_UNAVAILABLE');
    const lowered = StoreCart.parse(c.ok(await cart.update(token, lowLine!.id, 2)));
    expect(lowered.lines[1]!.status).toBe('AVAILABLE');
    c.ok(await cart.remove(token, goneLine!.id));
  });

  it('Customer-safe cart fields', async () => {
    const { product, variants } = await sellableProduct(c, 'View Safe');
    const { token } = await cartWith(variants[0]!.key);
    const res = await cart.call('GET', '/cart', token);
    const body = c.ok(res) as Record<string, unknown>;
    expect(StoreCart.safeParse(body).success).toBe(true);
    const text = JSON.stringify(body);
    for (const field of [
      'sku',
      'stock',
      'variantId',
      'productId',
      'createdBy',
      'updatedBy',
      'createdAt',
      'expiresAt',
      'token',
    ]) {
      expect(text).not.toContain(field);
    }
    expect(text).not.toContain(product.id);
    expect(text).not.toContain(variants[0]!.variant.id);
  });
});
