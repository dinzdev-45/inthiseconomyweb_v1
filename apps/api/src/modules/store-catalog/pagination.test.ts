import { StoreProductListResponse } from '@ite/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createCatalogHarness, idr, type CatalogHarness } from '../../../test/support/catalog.ts';

/*
 * A catalog of exactly 30 ACTIVE products (plus one draft), with known activation times and
 * prices: three price levels, so equal prices exist and need a stable order across pages.
 */
let c: CatalogHarness;
const products: { slug: string; activatedAt: Date; price: number }[] = [];
const PRICES = [50_000_000, 75_000_000, 99_000_000];

beforeAll(async () => {
  c = await createCatalogHarness();
  for (let i = 0; i < 30; i++) {
    const price = PRICES[i % 3]!;
    const { product } = await c.readyProduct({
      name: `Page Product ${String(i).padStart(2, '0')}`,
      basePrice: idr(price),
    });
    await c.activate(product.id);
    // Hours apart, in creation order, so "newest" is unambiguous.
    const activatedAt = new Date(Date.UTC(2026, 9, 1, i));
    await c.h.db.product.update({ where: { id: product.id }, data: { activatedAt } });
    products.push({ slug: product.slug, activatedAt, price });
  }
  await c.product({ name: 'Page Draft' });
}, 120_000);
afterAll(async () => c.close());

const list = async (query = '') =>
  StoreProductListResponse.parse(
    c.ok(await c.h.app.inject({ method: 'GET', url: `/api/v1/store/products${query}` })),
  );
const bothPages = async (query: string) => [
  ...(await list(`${query}&page=1`)).data,
  ...(await list(`${query}&page=2`)).data,
];
const newestFirst = (a: (typeof products)[number], b: (typeof products)[number]) =>
  b.activatedAt.getTime() - a.activatedAt.getTime() || a.slug.localeCompare(b.slug);

describe('store-catalog-api: Numbered pagination', () => {
  it('Catalog page envelope', async () => {
    const first = await list();
    expect(first).toMatchObject({ page: 1, pageSize: 24, totalItems: 30, totalPages: 2 });
    expect(first.data).toHaveLength(24);
    const second = await list('?page=2');
    expect(second).toMatchObject({ page: 2, pageSize: 24, totalItems: 30, totalPages: 2 });
    expect(second.data).toHaveLength(6);
    const all = [...first.data, ...second.data].map((item) => item.slug);
    expect(new Set(all).size).toBe(30);
  });

  it('Page beyond the last page', async () => {
    expect(await list('?page=5')).toEqual({
      data: [],
      page: 5,
      pageSize: 24,
      totalItems: 30,
      totalPages: 2,
    });
  });
});

describe('store-catalog-api: Catalog sorting', () => {
  it('Sort by newest', async () => {
    const expected = [...products].sort(newestFirst).map((product) => product.slug);
    expect((await bothPages('?sort=newest')).map((item) => item.slug)).toEqual(expected);
    expect((await list()).data[0]!.slug).toBe(expected[0]);
  });

  it('Sort by price', async () => {
    const ascending = [...products]
      .sort((a, b) => a.price - b.price || newestFirst(a, b))
      .map((product) => product.slug);
    const descending = [...products]
      .sort((a, b) => b.price - a.price || newestFirst(a, b))
      .map((product) => product.slug);

    const asc = await bothPages('?sort=price-asc');
    expect(asc.map((item) => item.slug)).toEqual(ascending);
    expect(asc.map((item) => item.price.min.amount)).toEqual(
      [...asc.map((item) => item.price.min.amount)].sort((a, b) => a - b),
    );
    expect((await bothPages('?sort=price-desc')).map((item) => item.slug)).toEqual(descending);
    // Stable: the same request returns the same order.
    expect((await bothPages('?sort=price-asc')).map((item) => item.slug)).toEqual(ascending);
  });
});
