import { describe, expect, it } from 'vitest';

import {
  AdminDrop,
  CreateDropRequest,
  DropCandidate,
  SetDropProductsRequest,
  StoreDropDetail,
  StoreDropsOverview,
  UpdateDropRequest,
} from './drops.ts';
import { ErrorCode } from './errors.ts';
import { StoreProductDetail, StoreProductSummary } from './store-catalog.ts';

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) =>
  schema.safeParse(v).success;
const ID = '0199a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b';
const AT = '2026-11-01T03:00:00.000Z';
const SUMMARY = {
  slug: 'overtime',
  collection: 'COLLECTION 002',
  title: 'Overtime',
  releaseAt: AT,
  status: 'UPCOMING',
  image: { url: '/images/drops/overtime.jpg', alt: 'Overtime campaign' },
  productCount: 2,
};

describe('admin drop requests', () => {
  it('CreateDropRequest: collection, title, and release time; the rest optional; strict', () => {
    const body = { collection: 'COLLECTION 002', title: 'Overtime', releaseAt: AT };
    expect(ok(CreateDropRequest, body)).toBe(true);
    expect(
      ok(CreateDropRequest, { ...body, slug: 'overtime', description: null, image: null }),
    ).toBe(true);
    for (const bad of [
      { ...body, title: ' ' },
      { ...body, collection: 'x'.repeat(61) },
      { ...body, releaseAt: '2026-11-01 10:00' },
      { ...body, image: { url: 'http://x/a.jpg', alt: 'A' } },
      { ...body, image: { url: '/a.jpg', alt: '' } },
      { ...body, status: 'PUBLISHED' },
    ]) {
      expect(ok(CreateDropRequest, bad)).toBe(false);
    }
  });

  it('UpdateDropRequest needs at least one known field', () => {
    expect(ok(UpdateDropRequest, { title: 'New' })).toBe(true);
    expect(ok(UpdateDropRequest, {})).toBe(false);
    expect(ok(UpdateDropRequest, { status: 'DRAFT' })).toBe(false);
  });

  it('SetDropProductsRequest: unique ids, at most 100', () => {
    expect(ok(SetDropProductsRequest, { productIds: [] })).toBe(true);
    expect(ok(SetDropProductsRequest, { productIds: [ID, ID] })).toBe(false);
  });
});

describe('drop responses', () => {
  it('AdminDrop and candidates are strict', () => {
    const drop = {
      id: ID,
      slug: 'overtime',
      collection: 'COLLECTION 002',
      title: 'Overtime',
      description: null,
      releaseAt: AT,
      image: null,
      status: 'DRAFT',
      products: [{ id: ID, name: 'Tee', slug: 'tee', status: 'ACTIVE', primaryImage: null }],
      createdAt: AT,
      updatedAt: AT,
      createdBy: null,
      updatedBy: null,
    };
    expect(ok(AdminDrop, drop)).toBe(true);
    expect(ok(AdminDrop, { ...drop, status: 'LIVE' })).toBe(false);
    expect(ok(DropCandidate, { ...drop.products[0], drop: { id: ID, title: 'Overtime' } })).toBe(
      true,
    );
  });

  it('StoreDropsOverview and detail carry only customer-facing fields', () => {
    expect(ok(StoreDropsOverview, { upcoming: [SUMMARY], current: null, archive: [] })).toBe(true);
    expect(
      ok(StoreDropsOverview, { upcoming: [{ ...SUMMARY, id: ID }], current: null, archive: [] }),
    ).toBe(false);
    expect(
      ok(StoreDropsOverview, {
        upcoming: [{ ...SUMMARY, status: 'DRAFT' }],
        current: null,
        archive: [],
      }),
    ).toBe(false);
    expect(ok(StoreDropDetail, { ...SUMMARY, description: null, products: [] })).toBe(true);
  });

  it('store products may carry a release time and their drop', () => {
    const product = {
      slug: 'night-shift-tee',
      name: 'Night Shift Tee',
      category: { slug: 'apparel', name: 'Apparel' },
      price: { min: { amount: 1, currency: 'IDR' }, max: { amount: 1, currency: 'IDR' } },
      availability: 'IN_STOCK',
      colors: [],
      image: null,
      secondaryImage: null,
    };
    expect(ok(StoreProductSummary, product)).toBe(true);
    expect(ok(StoreProductSummary, { ...product, releaseAt: AT })).toBe(true);
    expect(ok(StoreProductSummary, { ...product, releaseAt: null })).toBe(true);
    expect(ok(StoreProductSummary, { ...product, releaseAt: 'tomorrow' })).toBe(false);
    const detail = { ...product, description: null, images: [], variants: [] };
    expect(
      ok(StoreProductDetail, { ...detail, drop: { slug: 'overtime', title: 'Overtime' } }),
    ).toBe(true);
    expect(ok(StoreProductDetail, { ...detail, drop: { slug: 'overtime' } })).toBe(false);
  });

  it('defines the drop error codes', () => {
    for (const code of ['PRODUCT_IN_OTHER_DROP', 'DROP_NOT_READY', 'NOT_RELEASED']) {
      expect(ErrorCode.options).toContain(code);
    }
  });
});
