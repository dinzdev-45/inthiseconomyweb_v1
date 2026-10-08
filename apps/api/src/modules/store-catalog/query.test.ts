import { StoreProductListResponse } from '@ite/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createCatalogHarness,
  problem,
  type CatalogHarness,
} from '../../../test/support/catalog.ts';

let c: CatalogHarness;
let sizes: Record<'M' | 'L', { id: string }>;
let colors: Record<'black' | 'white', { id: string }>;
beforeAll(async () => {
  c = await createCatalogHarness();
  sizes = { M: await c.size('M'), L: await c.size('L') };
  colors = { black: await c.color('black'), white: await c.color('white') };
});
afterAll(async () => c.close());

const get = (query: string) =>
  c.h.app.inject({ method: 'GET', url: `/api/v1/store/products${query}` });
const slugs = async (query: string) =>
  StoreProductListResponse.parse(c.ok(await get(query))).data.map((item) => item.slug);

let categories = 0;
/** A fresh ACTIVE category, so each test sees only its own products. */
async function category(slug = `cat-${++categories}`) {
  return c.h.db.category.create({ data: { name: slug, slug } });
}

/** An ACTIVE product with the given variants (size/color keys and stock). */
async function activeProduct(
  name: string,
  categoryId: string,
  variants: { size?: 'M' | 'L'; color?: 'black' | 'white'; stockQuantity?: number }[] = [{}],
) {
  const created = await c.product({ name, categoryId });
  for (const { size, color, stockQuantity } of variants) {
    await c.variant(created.id, {
      ...(size ? { sizeId: sizes[size].id } : {}),
      ...(color ? { colorId: colors[color].id } : {}),
      ...(stockQuantity === undefined ? {} : { stockQuantity }),
    });
  }
  await c.image(created.id);
  return c.activate(created.id);
}

describe('store-catalog-api: Catalog filters', () => {
  it('Filter the catalog by category', async () => {
    const outerwear = await category('outerwear');
    const tops = await category();
    const jacket = await activeProduct('Filter Jacket', outerwear.id);
    await activeProduct('Filter Tee', tops.id);
    const draft = await c.product({ name: 'Filter Draft Coat', categoryId: outerwear.id });

    const result = await slugs('?category=outerwear');
    expect(result).toEqual([jacket.slug]);
    expect(result).not.toContain(draft.slug);
  });

  it('Size and color match the same variant', async () => {
    const cat = await category();
    const product = await activeProduct('Two Tone Tee', cat.id, [
      { size: 'M', color: 'black' },
      { size: 'L', color: 'white' },
    ]);
    expect(await slugs(`?category=${cat.slug}&size=M&color=white`)).toEqual([]);
    expect(await slugs(`?category=${cat.slug}&size=M&color=black`)).toEqual([product.slug]);
    expect(await slugs(`?category=${cat.slug}&size=m`)).toEqual([product.slug]);
  });

  it('In-stock filter', async () => {
    const cat = await category();
    const soldOut = await activeProduct('Gone Tee', cat.id, [{ stockQuantity: 0 }]);
    const partial = await activeProduct('Partly Stocked Tee', cat.id, [
      { size: 'M', color: 'black', stockQuantity: 0 },
      { size: 'L', color: 'black', stockQuantity: 5 },
    ]);
    expect(await slugs(`?category=${cat.slug}`)).toHaveLength(2);
    const inStock = await slugs(`?category=${cat.slug}&availability=in-stock`);
    expect(inStock).toEqual([partial.slug]);
    expect(inStock).not.toContain(soldOut.slug);
    expect(await slugs(`?category=${cat.slug}&size=M&availability=in-stock`)).toEqual([]);
    expect(await slugs(`?category=${cat.slug}&size=L&availability=in-stock`)).toEqual([
      partial.slug,
    ]);
  });

  it('Unknown filter value', async () => {
    const res = StoreProductListResponse.parse(c.ok(await get('?category=no-such-category')));
    expect(res).toEqual({ data: [], page: 1, pageSize: 24, totalItems: 0, totalPages: 0 });
    for (const query of ['?size=XXXL', '?color=no-such-color']) {
      expect(StoreProductListResponse.parse(c.ok(await get(query))).totalItems).toBe(0);
    }
  });
});

describe('store-catalog-api: Catalog search', () => {
  it('Search the catalog by name', async () => {
    const cat = await category();
    const lower = await activeProduct('Overdraft hoodie', cat.id);
    const upper = await activeProduct('ZIP HOODIE', cat.id);
    await activeProduct('Rent Due Tee', cat.id);
    const draft = await c.product({ name: 'Draft Hoodie', categoryId: cat.id });

    const result = await slugs('?q=hoodie');
    expect(result.sort()).toEqual([lower.slug, upper.slug].sort());
    expect(result).not.toContain(draft.slug);
    // Search combines with filters.
    expect(await slugs(`?q=%20HOODIE%20&category=${cat.slug}&sort=price-asc`)).toHaveLength(2);
  });

  it('Search treats wildcards literally', async () => {
    const cat = await category();
    const percent = await activeProduct('100% Cotton Tee', cat.id);
    const underscore = await activeProduct('Snake_case Tee', cat.id);
    await activeProduct('Plain Cotton Tee', cat.id);

    expect(await slugs('?q=%25')).toEqual([percent.slug]);
    expect(await slugs('?q=_')).toEqual([underscore.slug]);
    expect(await slugs('?q=%5C')).toEqual([]);
  });
});

describe('store-catalog-api: Query validation', () => {
  it.each([
    ['?sort=popular', 'sort'],
    ['?page=0', 'page'],
    ['?page=1.5', 'page'],
    ['?category=Not%20A%20Slug', 'category'],
    ['?color=Black!', 'color'],
    ['?size=M%20L', 'size'],
    ['?availability=sold-out', 'availability'],
    ['?q=%20%20', 'q'],
    [`?q=${'x'.repeat(101)}`, 'q'],
    ['?debug=1', 'debug'],
  ])('Invalid catalog query (%s)', async (query, field) => {
    const body = problem(await get(query), 400, 'VALIDATION_FAILED');
    expect(body.errors?.map((error) => error.path)).toContain(`query.${field}`);
  });
});
