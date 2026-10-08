import { StoreProductSummary } from '@ite/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createCatalogHarness,
  idr,
  problem,
  type CatalogHarness,
} from '../../../test/support/catalog.ts';

let c: CatalogHarness;
beforeAll(async () => {
  c = await createCatalogHarness();
});
afterAll(async () => c.close());

const get = (url: string) => c.h.app.inject({ method: 'GET', url: `/api/v1/store${url}` });

async function activeProduct(name: string, variants: object[] = [{}], categoryId?: string) {
  const created = await c.product({ name, ...(categoryId ? { categoryId } : {}) });
  const made = [];
  for (const variant of variants) made.push(await c.variant(created.id, variant));
  await c.image(created.id);
  return { product: await c.activate(created.id), variants: made };
}

describe('store-catalog-api: Active products only (by slug)', () => {
  it('Active product by slug', async () => {
    const { product } = await activeProduct('Slug Hoodie', [
      { stockQuantity: 2 },
      { priceOverride: idr(94_900_000) },
    ]);
    const res = await get(`/products/${product.slug}`);
    expect(res.headers['cache-control']).toBe('public, max-age=60');
    const summary = StoreProductSummary.parse(c.ok(res));
    expect(summary).toMatchObject({
      slug: product.slug,
      name: 'Slug Hoodie',
      category: { slug: 'apparel', name: 'Apparel' },
      price: { min: idr(89_900_000), max: idr(94_900_000) },
      availability: 'IN_STOCK',
    });
    expect(summary.colors).toHaveLength(2);
    expect(summary.image).not.toBeNull();
  });

  it('Non-active product is not found', async () => {
    const draft = await c.product({ name: 'Slug Draft' });
    const { product: inactive } = await activeProduct('Slug Inactive');
    c.ok(await c.call('POST', `/products/${inactive.id}/deactivate`));
    const { product: archived } = await activeProduct('Slug Archived');
    c.ok(await c.call('POST', `/products/${archived.id}/deactivate`));
    c.ok(await c.call('POST', `/products/${archived.id}/archive`));

    const details = new Set<string>();
    for (const slug of [draft.slug, inactive.slug, archived.slug, 'no-such-product']) {
      const res = await get(`/products/${slug}`);
      const body = problem(res, 404, 'NOT_FOUND');
      expect(res.headers['cache-control']).not.toBe('public, max-age=60');
      details.add(body.detail);
    }
    expect(details.size).toBe(1);
  });
});
