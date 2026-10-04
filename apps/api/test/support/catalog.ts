import { ProblemDetails, ProductDetail, ProductVariant } from '@ite/contracts';
import { expect } from 'vitest';

import {
  ADMIN_ORIGIN,
  createAuthHarness,
  createStaff,
  login,
  sessionCookie,
  type AuthHarness,
} from './auth.ts';

const PASSWORD = 'correct-horse-battery';
export const UNKNOWN_ID = '0190a000-0000-7000-8000-000000000000';
export const idr = (amount: number) => ({ amount, currency: 'IDR' });

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
type Response = { statusCode: number; body: string; json: () => unknown };

/**
 * A signed-in OWNER and ADMIN on their own migrated database, with helpers for the admin
 * catalog API. Products are built through the API; setup images go straight into the database.
 */
export async function createCatalogHarness() {
  const h: AuthHarness = await createAuthHarness();
  const owner = await createStaff(h.db, {
    email: 'owner@example.com',
    password: PASSWORD,
    role: 'OWNER',
  });
  const admin = await createStaff(h.db, {
    email: 'admin@example.com',
    password: PASSWORD,
    role: 'ADMIN',
  });
  const ownerCookie = sessionCookie(await login(h.app, 'owner@example.com', PASSWORD));
  const adminCookie = sessionCookie(await login(h.app, 'admin@example.com', PASSWORD));
  const category = await h.db.category.create({ data: { name: 'Apparel', slug: 'apparel' } });
  let sequence = 0;

  const call = (method: Method, url: string, payload?: object, cookie = ownerCookie) =>
    h.app.inject({
      method,
      url: `/api/v1/admin${url}`,
      headers: { cookie, ...(method === 'GET' ? {} : { origin: ADMIN_ORIGIN }) },
      ...(payload ? { payload } : {}),
    });

  function ok(res: Response, status = 200) {
    expect(res.statusCode, res.body).toBe(status);
    return res.json();
  }

  async function size(code = `S${++sequence}`) {
    return h.db.size.create({ data: { code, label: code, sortOrder: sequence } });
  }
  async function color(slug = `color-${++sequence}`) {
    return h.db.color.create({ data: { name: slug, slug } });
  }

  async function product(overrides: object = {}) {
    const res = await call('POST', '/products', {
      name: `Product ${++sequence}`,
      categoryId: category.id,
      basePrice: idr(89_900_000),
      ...overrides,
    });
    return ProductDetail.parse(ok(res, 201));
  }

  async function variant(productId: string, overrides: object = {}) {
    const [s, c] = [await size(), await color()];
    const res = await call('POST', `/products/${productId}/variants`, {
      sizeId: s.id,
      colorId: c.id,
      sku: `SKU-${++sequence}`,
      ...overrides,
    });
    return ProductVariant.parse(ok(res, 201));
  }

  /** Image metadata written directly (fast setup; the image API is tested in images.test.ts). */
  function image(productId: string, isPrimary = true, sortOrder = 0) {
    return h.db.productImage.create({
      data: { productId, url: `/images/${++sequence}.jpg`, alt: 'Front', sortOrder, isPrimary },
    });
  }

  /** A DRAFT product meeting every activation condition: one active priced variant, one primary image. */
  async function readyProduct(overrides: object = {}) {
    const created = await product(overrides);
    const v = await variant(created.id);
    await image(created.id);
    return { product: created, variant: v };
  }

  async function activate(productId: string) {
    return ProductDetail.parse(ok(await call('POST', `/products/${productId}/activate`)));
  }

  return {
    h,
    owner,
    admin,
    ownerCookie,
    adminCookie,
    category,
    call,
    ok,
    size,
    color,
    product,
    variant,
    image,
    readyProduct,
    activate,
    close: () => h.close(),
  };
}

export type CatalogHarness = Awaited<ReturnType<typeof createCatalogHarness>>;

/** Asserts a problem+json response with `status` (and `code`) and returns it. */
export function problem(res: Response, status: number, code?: string) {
  expect(res.statusCode, res.body).toBe(status);
  const body = ProblemDetails.parse(res.json());
  if (code) expect(body.code).toBe(code);
  return body;
}
