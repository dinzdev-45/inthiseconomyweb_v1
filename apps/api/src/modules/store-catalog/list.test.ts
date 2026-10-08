import { StoreProductListResponse, StoreProductSummary } from '@ite/contracts';
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

const store = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, cookie?: string) =>
  c.h.app.inject({
    method,
    url: `/api/v1/store${url}`,
    ...(cookie ? { headers: { cookie } } : {}),
  });
const list = async (query = '') =>
  StoreProductListResponse.parse(c.ok(await store('GET', `/products${query}`)));

/** An ACTIVE product named `name`; extra variants are added before activation. */
async function activeProduct(name: string, variants: object[] = [{}]) {
  const created = await c.product({ name });
  for (const variant of variants) await c.variant(created.id, variant);
  await c.image(created.id);
  return c.activate(created.id);
}

describe('store-catalog-api: Active products only', () => {
  it('Only active products are listed', async () => {
    const active = await activeProduct('Visible Tee');
    await c.product({ name: 'Draft Tee' });
    const inactive = await activeProduct('Inactive Tee');
    c.ok(await c.call('POST', `/products/${inactive.id}/deactivate`));
    const archived = await activeProduct('Archived Tee');
    c.ok(await c.call('POST', `/products/${archived.id}/deactivate`));
    c.ok(await c.call('POST', `/products/${archived.id}/archive`));

    const page = await list();
    expect(page.data.map((item) => item.slug)).toEqual([active.slug]);
    expect(page).toMatchObject({ page: 1, pageSize: 24, totalItems: 1, totalPages: 1 });
  });
});

describe('store-catalog-api: Customer-safe product summary', () => {
  it('Customer-safe summary fields', async () => {
    const created = await c.product({ name: 'Safe Hoodie' });
    await c.variant(created.id, { stockQuantity: 4 });
    await c.image(created.id, true, 1);
    await c.image(created.id, false, 0);
    await c.image(created.id, false, 2);
    await c.activate(created.id);

    const page = await list();
    for (const item of page.data) {
      expect(StoreProductSummary.strict().safeParse(item).success).toBe(true);
      const text = JSON.stringify(item);
      for (const field of ['stockQuantity', 'sku', '"id"', 'createdBy', 'createdAt', 'activatedAt'])
        expect(text).not.toContain(field);
    }
    const item = page.data.find((entry) => entry.slug === created.slug)!;
    expect(item).toMatchObject({
      name: 'Safe Hoodie',
      category: { slug: 'apparel', name: 'Apparel' },
      availability: 'IN_STOCK',
    });
    expect(item.colors).toHaveLength(1);
    // Primary first, then the next non-primary image in display order.
    const images = await c.h.db.productImage.findMany({
      where: { productId: created.id },
      orderBy: { sortOrder: 'asc' },
    });
    expect(item.image).toEqual({ url: images[1]!.url, alt: 'Front' });
    expect(item.secondaryImage).toEqual({ url: images[0]!.url, alt: 'Front' });
  });

  it('Price range from active variants', async () => {
    const created = await c.product({ name: 'Range Jacket', basePrice: idr(89_900_000) });
    await c.variant(created.id);
    await c.variant(created.id, { priceOverride: idr(94_900_000) });
    const expensive = await c.variant(created.id, { priceOverride: idr(120_000_000) });
    await c.image(created.id);
    await c.activate(created.id);
    c.ok(await c.call('POST', `/products/${created.id}/variants/${expensive.id}/deactivate`));
    const flat = await activeProduct('Flat Jacket', [{}, {}]);

    const page = await list();
    const range = page.data.find((item) => item.slug === created.slug)!;
    expect(range.price).toEqual({ min: idr(89_900_000), max: idr(94_900_000) });
    const single = page.data.find((item) => item.slug === flat.slug)!;
    expect(single.price.min).toEqual(single.price.max);
  });
});

describe('store-catalog-api: Availability', () => {
  it('Sold-out product in the catalog', async () => {
    const soldOut = await activeProduct('Empty Shelf Tee', [
      { stockQuantity: 0 },
      { stockQuantity: 0 },
    ]);
    const item = (await list()).data.find((entry) => entry.slug === soldOut.slug)!;
    expect(item.availability).toBe('SOLD_OUT');
  });

  it('Inactive variant stock is ignored', async () => {
    const created = await c.product({ name: 'Hidden Stock Tee' });
    await c.variant(created.id, { stockQuantity: 0 });
    const stocked = await c.variant(created.id, { stockQuantity: 50 });
    await c.image(created.id);
    await c.activate(created.id);
    c.ok(await c.call('POST', `/products/${created.id}/variants/${stocked.id}/deactivate`));

    const item = (await list()).data.find((entry) => entry.slug === created.slug)!;
    expect(item.availability).toBe('SOLD_OUT');
    expect(JSON.stringify(item)).not.toContain('50');
  });
});

describe('store-catalog-api: Public, read-only catalog endpoints', () => {
  it('Catalog needs no credentials', async () => {
    const anonymous = await store('GET', '/products');
    expect(anonymous.statusCode).toBe(200);
    expect(anonymous.headers['cache-control']).toBe('public, max-age=60');
    expect(anonymous.headers['x-request-id']).toBeTruthy();
    expect(anonymous.headers['set-cookie']).toBeUndefined();

    const withSession = await store('GET', '/products', c.ownerCookie);
    expect(withSession.statusCode).toBe(200);
    expect(withSession.json()).toEqual(anonymous.json());

    const withAuthorization = await c.h.app.inject({
      method: 'GET',
      url: '/api/v1/store/products',
      headers: { authorization: 'Bearer anything' },
    });
    expect(withAuthorization.json()).toEqual(anonymous.json());

    const head = await c.h.app.inject({ method: 'HEAD', url: '/api/v1/store/products' });
    expect(head.statusCode).toBe(200);
  });

  it('Catalog is read-only', async () => {
    const before = await list();
    for (const method of ['POST', 'PATCH', 'DELETE'] as const) {
      const res = await store(method, '/products', c.ownerCookie);
      problem(res, 404, 'NOT_FOUND');
      expect(res.headers['cache-control']).not.toBe('public, max-age=60');
    }
    expect(await list()).toEqual(before);
    expect(await c.h.db.product.count({ where: { status: 'ACTIVE' } })).toBe(before.totalItems);
  });
});
