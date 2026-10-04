import {
  Category,
  Color,
  LoginResponse,
  ProductDetail,
  ProductImage,
  ProductVariant,
  Size,
} from '@ite/contracts';
import {
  expect,
  request as playwrightRequest,
  type APIRequestContext,
  type Page,
  type Cookie,
} from '@playwright/test';

import { E2E } from '../config.ts';
import { CATALOG_STAFF, OWNER_NEW_PASSWORD } from './accounts.ts';

/*
 * Catalog E2E helpers. Setup data is created through the API (via the admin's /api proxy) with
 * a signed-in session, so UI tests only drive the screens under test. Mutations carry the admin
 * Origin, as a browser would, so the API's Origin check passes.
 */

const ADMIN = '/api/v1/admin';
const originHeaders = { origin: E2E.adminOrigin };

async function login(request: APIRequestContext, email: string, password: string) {
  const res = await request.post(`${ADMIN}/auth/login`, {
    data: { email, password },
    headers: originHeaders,
  });
  return res.ok() ? LoginResponse.parse(await res.json()) : null;
}

async function signInOwner(request: APIRequestContext) {
  for (const password of [process.env.E2E_OWNER_PASSWORD!, OWNER_NEW_PASSWORD]) {
    if (await login(request, E2E.ownerEmail, password)) return password;
  }
  throw new Error('Could not sign in as the bootstrapped Owner.');
}

/**
 * Makes sure the dedicated catalog ADMIN exists with its final password (created by the Owner,
 * then its temporary password changed), regardless of which spec files ran before.
 */
export async function ensureCatalogStaff(): Promise<void> {
  const request = await playwrightRequest.newContext({ baseURL: E2E.adminOrigin });
  try {
    const first = await request.post(`${ADMIN}/auth/login`, {
      data: { email: CATALOG_STAFF.email, password: CATALOG_STAFF.password },
      headers: originHeaders,
    });
    expect(first.status(), 'catalog staff sign-in was rate limited').not.toBe(429);
    if (first.ok() && !LoginResponse.parse(await first.json()).mustChangePassword) return;

    await signInOwner(request);
    const created = await request.post(`${ADMIN}/staff`, {
      data: {
        email: CATALOG_STAFF.email,
        role: 'ADMIN',
        temporaryPassword: CATALOG_STAFF.temporaryPassword,
      },
      headers: originHeaders,
    });
    expect(created.status(), await created.text()).toBe(201);

    await request.post(`${ADMIN}/auth/logout`, { headers: originHeaders });
    expect(
      await login(request, CATALOG_STAFF.email, CATALOG_STAFF.temporaryPassword),
    ).not.toBeNull();
    const changed = await request.post(`${ADMIN}/auth/change-password`, {
      data: {
        currentPassword: CATALOG_STAFF.temporaryPassword,
        newPassword: CATALOG_STAFF.password,
      },
      headers: originHeaders,
    });
    expect(changed.status(), await changed.text()).toBe(204);
  } finally {
    await request.dispose();
  }
}

/**
 * The catalog ADMIN's session cookies, from one sign-in per test run. The API rate-limits
 * sign-ins (10 per account and address per 15 minutes, successful ones included), so tests
 * reuse one session instead of signing in each time.
 */
let catalogSession: Cookie[] | undefined;

/** Signs the page's browser context in as the catalog ADMIN (one API sign-in per run). */
export async function signInAsCatalogStaff(page: Page): Promise<void> {
  if (!catalogSession) {
    await ensureCatalogStaff();
    const staff = await login(page.request, CATALOG_STAFF.email, CATALOG_STAFF.password);
    expect(staff?.mustChangePassword, 'catalog staff sign-in').toBe(false);
    catalogSession = await page.context().cookies();
    return;
  }
  await page.context().addCookies(catalogSession);
}

/** Signs the page's browser context in as the bootstrapped Owner. */
export async function signInAsOwner(page: Page): Promise<void> {
  await signInOwner(page.request);
}

let sequence = 0;
/** A name unique within this E2E run, e.g. `Tee 3-k2x9`. */
export const unique = (base: string) =>
  `${base} ${++sequence}-${Date.now().toString(36).slice(-4)}`;

/** A size code unique within this E2E run (letters and digits, at most 12 characters). */
export const uniqueCode = () => `T${++sequence}${Date.now().toString(36).slice(-4)}`.toUpperCase();

/**
 * Catalog data builders using the page's signed-in session. Each parses the API response with
 * the published contract, so a contract drift fails the test at setup.
 */
export function catalogApi(page: Page) {
  async function send<T>(
    method: 'POST' | 'PATCH' | 'PUT',
    path: string,
    data: unknown,
    parse: (v: unknown) => T,
  ) {
    const res = await page.request.fetch(`${ADMIN}${path}`, {
      method,
      data,
      headers: originHeaders,
    });
    expect(res.ok(), `${method} ${path}: ${await res.text()}`).toBe(true);
    return parse(await res.json());
  }

  return {
    createCategory: (name = unique('Category')) =>
      send('POST', '/categories', { name }, (v) => Category.parse(v)),
    createSize: (code: string, sortOrder = 1, label = `Size ${code}`) =>
      send('POST', '/sizes', { code, label, sortOrder }, (v) => Size.parse(v)),
    createColor: (name = unique('Color'), hex?: string) =>
      send('POST', '/colors', { name, ...(hex ? { hex } : {}) }, (v) => Color.parse(v)),
    createProduct: (categoryId: string, fields: Record<string, unknown> = {}) =>
      send(
        'POST',
        '/products',
        {
          name: unique('Product'),
          categoryId,
          basePrice: { amount: 89_900_000, currency: 'IDR' },
          ...fields,
        },
        (v) => ProductDetail.parse(v),
      ),
    createVariant: (
      productId: string,
      fields: { sizeId: string; colorId: string; sku: string } & Record<string, unknown>,
    ) => send('POST', `/products/${productId}/variants`, fields, (v) => ProductVariant.parse(v)),
    addImage: (productId: string, fields: Record<string, unknown> = {}) =>
      send(
        'POST',
        `/products/${productId}/images`,
        { url: '/images/e2e/front.jpg', alt: 'Front view', ...fields },
        (v) => ProductImage.parse(v),
      ),
    lifecycle: (productId: string, action: 'activate' | 'deactivate' | 'archive' | 'restore') =>
      send('POST', `/products/${productId}/${action}`, undefined, (v) => ProductDetail.parse(v)),
    variantStatus: (productId: string, variantId: string, action: 'activate' | 'deactivate') =>
      send('POST', `/products/${productId}/variants/${variantId}/${action}`, undefined, (v) =>
        ProductVariant.parse(v),
      ),
    archiveCategory: (categoryId: string) =>
      send('POST', `/categories/${categoryId}/archive`, undefined, (v) => Category.parse(v)),
  };
}

/**
 * A product with one variant (using `sizeId`/`colorId`, or new ones) and one primary image,
 * activated when `activate` is true. Returns everything created.
 */
export async function createProductWithVariant(
  page: Page,
  categoryId: string,
  {
    sizeId,
    colorId,
    activate = false,
    fields = {},
  }: {
    sizeId?: string;
    colorId?: string;
    activate?: boolean;
    /** Product fields, e.g. `{ name }`. */
    fields?: Record<string, unknown>;
  } = {},
) {
  const api = catalogApi(page);
  const size = sizeId ?? (await api.createSize(uniqueCode())).id;
  const color = colorId ?? (await api.createColor()).id;
  const product = await api.createProduct(categoryId, fields);
  const variant = await api.createVariant(product.id, {
    sizeId: size,
    colorId: color,
    sku: `SKU-${uniqueCode()}`,
    stockQuantity: 5,
  });
  await api.addImage(product.id);
  const final = activate ? await api.lifecycle(product.id, 'activate') : product;
  return { product: final, variant, sizeId: size, colorId: color };
}
