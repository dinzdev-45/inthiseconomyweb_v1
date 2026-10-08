import { describe, expect, it } from 'vitest';

import {
  STORE_PAGE_SIZE,
  StoreCatalogFilters,
  StoreProductDetail,
  StoreProductListQuery,
  StoreProductListResponse,
  StoreProductSummary,
} from './store-catalog.ts';

const PRICE = { amount: 89_900_000, currency: 'IDR' };
const SUMMARY = {
  slug: 'overdraft-hoodie',
  name: 'Overdraft Hoodie',
  category: { slug: 'tops', name: 'Tops' },
  price: { min: PRICE, max: { amount: 94_900_000, currency: 'IDR' } },
  availability: 'IN_STOCK',
  colors: [{ slug: 'washed-black', name: 'Washed Black', hex: '#2B2A28' }],
  image: { url: '/images/products/overdraft-hoodie/front.jpg', alt: 'Front' },
  secondaryImage: null,
};
const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) =>
  schema.safeParse(v).success;

describe('StoreProductListQuery', () => {
  it('defaults to the newest first page', () => {
    expect(StoreProductListQuery.parse({})).toEqual({ sort: 'newest', page: 1 });
  });

  it('accepts every filter, sort, search, and page from the query string', () => {
    expect(
      StoreProductListQuery.parse({
        category: 'outerwear',
        size: 'm',
        color: 'washed-black',
        availability: 'in-stock',
        sort: 'price-desc',
        q: '  hoodie ',
        page: '3',
      }),
    ).toEqual({
      category: 'outerwear',
      size: 'M',
      color: 'washed-black',
      availability: 'in-stock',
      sort: 'price-desc',
      q: 'hoodie',
      page: 3,
    });
  });

  it.each([
    ['unknown parameter', { debug: '1' }],
    ['bad sort', { sort: 'popular' }],
    ['bad availability', { availability: 'sold-out' }],
    ['page 0', { page: '0' }],
    ['negative page', { page: '-1' }],
    ['fractional page', { page: '1.5' }],
    ['non-numeric page', { page: 'two' }],
    ['malformed category slug', { category: 'Not A Slug' }],
    ['malformed color slug', { color: 'black!' }],
    ['malformed size code', { size: 'M L' }],
    ['empty q', { q: '   ' }],
    ['over-long q', { q: 'x'.repeat(101) }],
  ])('rejects %s', (_, query) => expect(ok(StoreProductListQuery, query)).toBe(false));

  it('accepts q of exactly 100 characters', () => {
    expect(ok(StoreProductListQuery, { q: 'x'.repeat(100) })).toBe(true);
  });
});

describe('store catalog responses', () => {
  it('StoreProductSummary is strict and customer-safe', () => {
    expect(ok(StoreProductSummary, SUMMARY)).toBe(true);
    for (const extra of [
      { id: '0199a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b' },
      { stockQuantity: 3 },
      { sku: 'ITE-OH-WB-M' },
      { createdAt: '2026-10-04T08:00:00.000Z' },
      { createdBy: null },
    ]) {
      expect(ok(StoreProductSummary, { ...SUMMARY, ...extra })).toBe(false);
    }
    expect(ok(StoreProductSummary, { ...SUMMARY, availability: 'LOW_STOCK' })).toBe(false);
    expect(ok(StoreProductSummary, { ...SUMMARY, category: { slug: 'tops' } })).toBe(false);
  });

  it('StoreProductListResponse is the numbered page envelope', () => {
    expect(STORE_PAGE_SIZE).toBe(24);
    const page = { data: [SUMMARY], page: 1, pageSize: 24, totalItems: 1, totalPages: 1 };
    expect(ok(StoreProductListResponse, page)).toBe(true);
    expect(ok(StoreProductListResponse, { ...page, nextCursor: null })).toBe(false);
    expect(
      ok(StoreProductListResponse, {
        data: [],
        page: 5,
        pageSize: 24,
        totalItems: 30,
        totalPages: 2,
      }),
    ).toBe(true);
  });

  it('StoreCatalogFilters lists categories with counts, sizes, and colors', () => {
    expect(
      ok(StoreCatalogFilters, {
        categories: [{ slug: 'tops', name: 'Tops', productCount: 4 }],
        sizes: [{ code: 'M', label: 'Medium' }],
        colors: [{ slug: 'bone', name: 'Bone', hex: null }],
      }),
    ).toBe(true);
    expect(
      ok(StoreCatalogFilters, {
        categories: [{ slug: 'tops', name: 'Tops', productCount: 4, id: 'x' }],
        sizes: [],
        colors: [],
      }),
    ).toBe(false);
  });
});

describe('StoreProductDetail', () => {
  const DETAIL = {
    ...SUMMARY,
    description: 'Heavyweight fleece hoodie.',
    images: [
      { url: '/images/front.jpg', alt: 'Front', color: 'washed-black' },
      { url: '/images/detail.jpg', alt: 'Detail', color: null },
    ],
    variants: [
      {
        size: { code: 'M', label: 'Medium' },
        color: { slug: 'washed-black', name: 'Washed Black', hex: '#2B2A28' },
        price: PRICE,
        availability: 'SOLD_OUT',
      },
    ],
  };

  it('accepts the summary fields plus description, color-tagged images, and variants', () => {
    expect(ok(StoreProductDetail, DETAIL)).toBe(true);
    expect(ok(StoreProductDetail, { ...DETAIL, description: null, images: [], variants: [] })).toBe(
      true,
    );
  });

  it('is strict and customer-safe at every level', () => {
    const variant = DETAIL.variants[0]!;
    for (const detail of [
      { ...DETAIL, id: '0199a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b' },
      { ...DETAIL, updatedAt: '2026-10-04T08:00:00.000Z' },
      { ...DETAIL, variants: [{ ...variant, sku: 'ITE-OH-WB-M' }] },
      { ...DETAIL, variants: [{ ...variant, stockQuantity: 3 }] },
      { ...DETAIL, variants: [{ ...variant, id: 'x' }] },
      { ...DETAIL, variants: [{ ...variant, availability: 'LOW_STOCK' }] },
      { ...DETAIL, images: [{ url: '/a.jpg', alt: 'A', color: null, isPrimary: true }] },
      { ...DETAIL, images: [{ url: '/a.jpg', alt: 'A' }] }, // color is required (nullable)
      { ...DETAIL, images: [{ url: '/a.jpg', alt: 'A', color: 'Not A Slug' }] },
    ]) {
      expect(ok(StoreProductDetail, detail)).toBe(false);
    }
    const { description: _description, ...withoutDescription } = DETAIL;
    expect(ok(StoreProductDetail, withoutDescription)).toBe(false);
  });
});
