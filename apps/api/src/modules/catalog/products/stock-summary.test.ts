import { ProductListResponse } from '@ite/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createCatalogHarness, type CatalogHarness } from '../../../../test/support/catalog.ts';

let c: CatalogHarness;
beforeAll(async () => {
  c = await createCatalogHarness();
});
afterAll(async () => c.close());

const list = async (query = '') =>
  ProductListResponse.parse(c.ok(await c.call('GET', `/products${query}`)));
const itemFor = async (productId: string, query = '?limit=100') =>
  (await list(query)).data.find((item) => item.id === productId)!;

describe('product-management: Product listing and detail (stock summary)', () => {
  it('Stock summary in the product list', async () => {
    const product = await c.product({ name: 'Summary Hoodie' });
    await c.variant(product.id, { stockQuantity: 5 });
    await c.variant(product.id, { stockQuantity: 7 });
    await c.variant(product.id, { stockQuantity: 0 });
    const inactive = await c.variant(product.id, { stockQuantity: 100 });
    c.ok(await c.call('POST', `/products/${product.id}/variants/${inactive.id}/deactivate`));

    const item = await itemFor(product.id);
    expect(item.stock).toEqual({
      totalQuantity: 12,
      activeVariantCount: 3,
      outOfStockVariantCount: 1,
    });
    // variantCount still counts every variant, inactive included.
    expect(item.variantCount).toBe(4);

    const empty = await c.product({ name: 'Summary Empty' });
    expect((await itemFor(empty.id)).stock).toEqual({
      totalQuantity: 0,
      activeVariantCount: 0,
      outOfStockVariantCount: 0,
    });
  });

  it('reports zeros when every variant is inactive', async () => {
    const product = await c.product({ name: 'Summary Inactive Only' });
    const variant = await c.variant(product.id, { stockQuantity: 9 });
    c.ok(await c.call('POST', `/products/${product.id}/variants/${variant.id}/deactivate`));
    const item = await itemFor(product.id);
    expect(item.stock).toEqual({
      totalQuantity: 0,
      activeVariantCount: 0,
      outOfStockVariantCount: 0,
    });
    expect(item.variantCount).toBe(1);
  });

  it('follows stock adjustments', async () => {
    const product = await c.product({ name: 'Summary Adjusted' });
    const variant = await c.variant(product.id, { stockQuantity: 3 });
    c.ok(
      await c.call('POST', `/products/${product.id}/variants/${variant.id}/stock-adjustments`, {
        delta: -3,
      }),
    );
    expect((await itemFor(product.id)).stock).toEqual({
      totalQuantity: 0,
      activeVariantCount: 1,
      outOfStockVariantCount: 1,
    });
  });

  it('sums beyond a single variant maximum', async () => {
    const product = await c.product({ name: 'Summary Huge' });
    await c.variant(product.id, { stockQuantity: 2_147_483_647 });
    await c.variant(product.id, { stockQuantity: 2_147_483_647 });
    expect((await itemFor(product.id)).stock.totalQuantity).toBe(4_294_967_294);
  });

  it('keeps filters, search, and pagination unchanged, with a summary on every item of every page', async () => {
    const category = await c.h.db.category.create({
      data: { name: 'Summary Paged', slug: 'summary-paged' },
    });
    const created = [];
    for (let n = 0; n < 5; n++) {
      const product = await c.product({ name: `Paged Summary ${n}`, categoryId: category.id });
      await c.variant(product.id, { stockQuantity: n });
      created.push(product.id);
    }
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const query: string = `?categoryId=${category.id}&q=paged%20summary&limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
      const page = await list(query);
      expect(page.data.length).toBeLessThanOrEqual(2);
      for (const item of page.data) {
        const n = Number(item.name.at(-1));
        expect(item.stock).toEqual({
          totalQuantity: n,
          activeVariantCount: 1,
          outOfStockVariantCount: n === 0 ? 1 : 0,
        });
        seen.push(item.id);
      }
      cursor = page.nextCursor;
    } while (cursor);
    expect(seen).toEqual([...created].reverse());
    // Archived products stay hidden by default, as before.
    c.ok(await c.call('POST', `/products/${created[0]}/archive`));
    expect((await list(`?categoryId=${category.id}`)).data.map((i) => i.id)).not.toContain(
      created[0],
    );
  });
});
