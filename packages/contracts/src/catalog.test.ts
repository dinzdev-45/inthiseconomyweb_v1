import { describe, expect, it } from 'vitest';

import {
  CATALOG_PRICE_MAX,
  CatalogSettings,
  Category,
  CreateColorRequest,
  CreateImageRequest,
  CreateProductRequest,
  CreateSizeRequest,
  CreateVariantRequest,
  HexColor,
  ImageUrl,
  Price,
  ProductDetail,
  ProductListItem,
  ProductListQuery,
  ProductListResponse,
  ProductStatus,
  ProductStockSummary,
  ReorderImagesRequest,
  SizeCode,
  Sku,
  Slug,
  StockAdjustmentRequest,
  UpdateImageRequest,
  UpdateProductRequest,
  UpdateVariantRequest,
  VariantStatus,
  CategoryStatus,
} from './catalog.ts';

const ID = '0199a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b';
const ID2 = '0199a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2c';
const ATTRIBUTION = {
  createdAt: '2026-10-04T08:00:00.000Z',
  updatedAt: '2026-10-04T08:00:00.000Z',
  createdBy: ID,
  updatedBy: null,
};
const PRICE = { amount: 89_900_000, currency: 'IDR' };
const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) =>
  schema.safeParse(v).success;

describe('catalog primitives', () => {
  it.each(['outerwear', 'rent-due-coach-jacket', 'inflation-tee-2', 'a'])('Slug accepts %s', (v) =>
    expect(ok(Slug, v)).toBe(true),
  );
  it.each(['Outerwear', 'two--dashes', '-lead', 'trail-', 'spa ce', 'é', 'x'.repeat(81), ''])(
    'Slug rejects %j',
    (v) => expect(ok(Slug, v)).toBe(false),
  );

  it('Sku normalizes to uppercase and trims', () => {
    expect(Sku.parse(' ite-oh-wb-m ')).toBe('ITE-OH-WB-M');
  });
  it.each(['ite oh/wb', '-ITE', 'A', 'X'.repeat(65), 'ITE_OH'])('Sku rejects %j', (v) =>
    expect(ok(Sku, v)).toBe(false),
  );

  it.each([
    ['m', 'M'],
    [' xl ', 'XL'],
    ['os', 'OS'],
    ['28', '28'],
    ['30/32', '30/32'],
    ['eu-42', 'EU-42'],
    ['10.5', '10.5'],
  ])('SizeCode accepts %j as %s (generic, not a fixed list)', (input, normalized) => {
    expect(SizeCode.parse(input)).toBe(normalized);
  });
  it.each(['M L', '--', '30//32', '/M', 'M/', 'ABCDEFGHIJKLM', ''])('SizeCode rejects %j', (v) =>
    expect(ok(SizeCode, v)).toBe(false),
  );

  it('HexColor accepts #RRGGBB and uppercases it', () => {
    expect(HexColor.parse('#2b2a28')).toBe('#2B2A28');
  });
  it.each(['#12345', 'red', '2B2A28', '#2B2A28FF', '#GGGGGG'])('HexColor rejects %j', (v) =>
    expect(ok(HexColor, v)).toBe(false),
  );

  it('Price enforces the catalog business limit and integer minor units', () => {
    expect(CATALOG_PRICE_MAX).toBe(2_000_000_000);
    expect(ok(Price, { amount: 0, currency: 'IDR' })).toBe(true);
    expect(ok(Price, { amount: CATALOG_PRICE_MAX, currency: 'IDR' })).toBe(true);
    for (const amount of [-1, CATALOG_PRICE_MAX + 1, 899.5, '899000']) {
      expect(ok(Price, { amount, currency: 'IDR' })).toBe(false);
    }
    expect(ok(Price, { amount: 1, currency: 'idr' })).toBe(false);
    expect(ok(Price, { amount: 1, currency: 'IDR', display: 'Rp 0,01' })).toBe(false);
  });

  it.each([
    ['/images/products/front.jpg', true],
    ['https://cdn.example.com/a.jpg', true],
    ['http://cdn.example.com/a.jpg', false],
    ['//cdn.example.com/a.jpg', false],
    ['javascript:alert(1)', false],
    ['images/a.jpg', false],
  ])('ImageUrl %s → %s', (url, expected) => expect(ok(ImageUrl, url)).toBe(expected));

  it('statuses match the spec', () => {
    expect(ProductStatus.options).toEqual(['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED']);
    expect(VariantStatus.options).toEqual(['ACTIVE', 'INACTIVE']);
    expect(CategoryStatus.options).toEqual(['ACTIVE', 'ARCHIVED']);
  });
});

describe('catalog requests', () => {
  it('CreateProductRequest: required fields, optional slug and description, strict', () => {
    const body = { name: 'Overdraft Hoodie', categoryId: ID, basePrice: PRICE };
    expect(ok(CreateProductRequest, body)).toBe(true);
    expect(ok(CreateProductRequest, { ...body, slug: 'overdraft-hoodie', description: null })).toBe(
      true,
    );
    expect(ok(CreateProductRequest, { ...body, status: 'ACTIVE' })).toBe(false); // lifecycle is action-only
    expect(ok(CreateProductRequest, { ...body, name: '  ' })).toBe(false);
    expect(ok(CreateProductRequest, { ...body, basePrice: { amount: -1, currency: 'IDR' } })).toBe(
      false,
    );
    expect(ok(CreateProductRequest, { name: 'X', basePrice: PRICE })).toBe(false);
  });

  it('update bodies require at least one known field', () => {
    expect(ok(UpdateProductRequest, { name: 'New name' })).toBe(true);
    expect(ok(UpdateProductRequest, {})).toBe(false);
    expect(ok(UpdateProductRequest, { status: 'ARCHIVED' })).toBe(false);
    expect(ok(UpdateVariantRequest, { priceOverride: null })).toBe(true);
    expect(ok(UpdateVariantRequest, { stockQuantity: 5 })).toBe(false); // stock only via adjustments
  });

  it('CreateVariantRequest defaults stock to 0 and rejects negative stock', () => {
    const body = { sizeId: ID, colorId: ID2, sku: 'ite-oh-wb-m' };
    expect(CreateVariantRequest.parse(body)).toMatchObject({
      sku: 'ITE-OH-WB-M',
      stockQuantity: 0,
    });
    expect(ok(CreateVariantRequest, { ...body, stockQuantity: -1 })).toBe(false);
    expect(ok(CreateVariantRequest, { ...body, stockQuantity: 1.5 })).toBe(false);
  });

  it('StockAdjustmentRequest: non-zero integer delta within ±100,000', () => {
    for (const delta of [1, -3, 100_000, -100_000])
      expect(ok(StockAdjustmentRequest, { delta })).toBe(true);
    for (const delta of [0, 100_001, -100_001, 0.5])
      expect(ok(StockAdjustmentRequest, { delta })).toBe(false);
  });

  it('reference-data requests', () => {
    expect(
      CreateSizeRequest.parse({ code: ' 30/32 ', label: 'Waist 30 / Leg 32', sortOrder: 20 }),
    ).toMatchObject({
      code: '30/32',
    });
    expect(ok(CreateSizeRequest, { code: 'M', label: 'Medium' })).toBe(false); // sortOrder is explicit
    expect(CreateColorRequest.parse({ name: 'Washed Black', hex: '#2b2a28' }).hex).toBe('#2B2A28');
    expect(ok(CreateColorRequest, { name: 'Red', hex: 'red' })).toBe(false);
  });

  it('image requests', () => {
    expect(ok(CreateImageRequest, { url: '/img/a.jpg', alt: 'Front view' })).toBe(true);
    expect(ok(CreateImageRequest, { url: '/img/a.jpg', alt: '' })).toBe(false);
    expect(ok(CreateImageRequest, { url: '/img/a.jpg', alt: 'x'.repeat(301) })).toBe(false);
    expect(ok(UpdateImageRequest, { isPrimary: true })).toBe(true);
    expect(ok(UpdateImageRequest, { isPrimary: false })).toBe(false);
    expect(ok(ReorderImagesRequest, { imageIds: [ID, ID2] })).toBe(true);
    expect(ok(ReorderImagesRequest, { imageIds: [ID, ID] })).toBe(false);
    expect(ok(ReorderImagesRequest, { imageIds: [] })).toBe(false);
  });

  it('ProductListQuery coerces limit, defaults to 20, and caps at 100', () => {
    expect(ProductListQuery.parse({}).limit).toBe(20);
    expect(ProductListQuery.parse({ limit: '50', status: 'ARCHIVED' })).toMatchObject({
      limit: 50,
    });
    expect(ok(ProductListQuery, { limit: '101' })).toBe(false);
    expect(ok(ProductListQuery, { status: 'DELETED' })).toBe(false);
  });
});

describe('catalog responses', () => {
  const category = { id: ID, name: 'Apparel', slug: 'apparel', status: 'ACTIVE' };
  const image = {
    id: ID,
    url: '/img/a.jpg',
    alt: 'Front',
    variantId: null,
    sortOrder: 0,
    isPrimary: true,
    ...ATTRIBUTION,
  };
  const variant = {
    id: ID,
    sku: 'ITE-OH-WB-M',
    size: { id: ID, code: 'M', label: 'Medium' },
    color: { id: ID2, name: 'Washed Black', slug: 'washed-black', hex: '#2B2A28' },
    priceOverride: null,
    effectivePrice: PRICE,
    stockQuantity: 12,
    status: 'ACTIVE',
    ...ATTRIBUTION,
  };
  const detail = {
    id: ID,
    name: 'Overdraft Hoodie',
    slug: 'overdraft-hoodie',
    description: null,
    status: 'DRAFT',
    category,
    basePrice: PRICE,
    activatedAt: null,
    variants: [variant],
    images: [image],
    ...ATTRIBUTION,
  };

  it('ProductDetail accepts the documented shape', () => {
    expect(ok(ProductDetail, detail)).toBe(true);
    expect(ok(ProductDetail, { ...detail, images: [], variants: [] })).toBe(true); // drafts may be empty
  });

  it.each(['basePriceAmount', 'currency', 'firstActivatedAt', 'categoryId'])(
    'ProductDetail rejects database-only field %s',
    (field) => expect(ok(ProductDetail, { ...detail, [field]: 1 })).toBe(false),
  );

  it('variants never expose raw amount columns', () => {
    expect(
      ok(ProductDetail, { ...detail, variants: [{ ...variant, priceOverrideAmount: 1 }] }),
    ).toBe(false);
  });

  it('ProductListResponse uses the paginated envelope', () => {
    const item = {
      id: ID,
      name: 'Overdraft Hoodie',
      slug: 'overdraft-hoodie',
      status: 'ACTIVE',
      category,
      basePrice: PRICE,
      variantCount: 3,
      stock: { totalQuantity: 12, activeVariantCount: 2, outOfStockVariantCount: 1 },
      primaryImage: { id: ID, url: '/img/a.jpg', alt: 'Front' },
      activatedAt: '2026-10-04T08:00:00.000Z',
      ...ATTRIBUTION,
    };
    expect(ok(ProductListItem, item)).toBe(true);
    expect(ok(ProductListResponse, { data: [item], nextCursor: 'abc' })).toBe(true);
    expect(ok(ProductListResponse, { data: [item], nextCursor: null })).toBe(true);
    expect(ok(ProductListResponse, { data: [item] })).toBe(false);
  });

  it('ProductListItem carries a strict, non-negative stock summary', () => {
    expect(
      ok(ProductStockSummary, {
        totalQuantity: 0,
        activeVariantCount: 0,
        outOfStockVariantCount: 0,
      }),
    ).toBe(true);
    // Totals may exceed one variant's maximum (2,147,483,647).
    expect(
      ok(ProductStockSummary, {
        totalQuantity: 4_294_967_294,
        activeVariantCount: 2,
        outOfStockVariantCount: 0,
      }),
    ).toBe(true);
    for (const bad of [
      { totalQuantity: -1, activeVariantCount: 0, outOfStockVariantCount: 0 },
      { totalQuantity: 1.5, activeVariantCount: 1, outOfStockVariantCount: 0 },
      { totalQuantity: 1, activeVariantCount: 1 },
      { totalQuantity: 1, activeVariantCount: 1, outOfStockVariantCount: 0, extra: 1 },
    ]) {
      expect(ok(ProductStockSummary, bad)).toBe(false);
    }
  });

  it('CatalogSettings exposes only the store currency', () => {
    expect(ok(CatalogSettings, { storeCurrency: 'IDR' })).toBe(true);
    expect(ok(CatalogSettings, { storeCurrency: 'idr' })).toBe(false);
    expect(ok(CatalogSettings, { storeCurrency: 'IDR', priceMax: 1 })).toBe(false);
    expect(ok(CatalogSettings, {})).toBe(false);
  });

  it('Category requires attribution and a known status', () => {
    expect(ok(Category, { ...category, ...ATTRIBUTION })).toBe(true);
    expect(ok(Category, { ...category, ...ATTRIBUTION, status: 'DELETED' })).toBe(false);
    expect(ok(Category, category)).toBe(false);
  });
});
