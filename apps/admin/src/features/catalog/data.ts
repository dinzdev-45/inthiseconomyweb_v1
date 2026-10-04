import 'server-only';

import {
  CatalogSettings,
  CategoryListResponse,
  ColorListResponse,
  ProductDetail,
  ProductListResponse,
  SizeListResponse,
  type CategoryStatus,
  type ProductStatus,
} from '@ite/contracts';

import { ApiError, apiGetForPage } from '@/lib/api/server';
import { getCurrentStaff } from '@/lib/session';

import { guardCatalogPage, type CatalogAccess, type CatalogPage } from './shared/access.ts';

/*
 * Server-only catalog reads for pages (design D2). Each goes through `apiGetForPage`, so the
 * session cookie is forwarded and a missing session or temporary password redirects. Responses
 * are parsed with the published @ite/contracts schemas.
 */

const ADMIN = '/api/v1/admin';

/** Runs the catalog page guard for the signed-in staff member (no data is loaded when refused). */
export async function loadCatalogPage<T>(
  load: (access: CatalogAccess) => Promise<T>,
  options?: { requireManage?: boolean },
): Promise<CatalogPage<T>> {
  const staff = await getCurrentStaff();
  return guardCatalogPage(staff.permissions, load, options);
}

export function getCatalogSettings() {
  return apiGetForPage(`${ADMIN}/catalog/settings`, CatalogSettings);
}

export function listCategories(status?: CategoryStatus) {
  const query = status ? `?status=${status}` : '';
  return apiGetForPage(`${ADMIN}/categories${query}`, CategoryListResponse);
}

export function listSizes() {
  return apiGetForPage(`${ADMIN}/sizes`, SizeListResponse);
}

export function listColors() {
  return apiGetForPage(`${ADMIN}/colors`, ColorListResponse);
}

export type ProductListParams = {
  q?: string | undefined;
  status?: ProductStatus | undefined;
  categoryId?: string | undefined;
  cursor?: string | undefined;
  limit?: number | undefined;
};

/** One page of products; an invalid cursor surfaces as an ApiError with status 400. */
export function listProducts(params: ProductListParams = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  const search = query.size > 0 ? `?${query}` : '';
  return apiGetForPage(`${ADMIN}/products${search}`, ProductListResponse);
}

/**
 * One page of the product list for the page's URL state. A cursor the API refuses (tampered,
 * signed with an old secret, or from another list) is reported as `invalid-cursor` so the page
 * can explain it and link to the first page; any other failure propagates to the error page.
 */
export async function loadProductPage(
  params: ProductListParams,
): Promise<{ ok: true; page: ProductListResponse } | { ok: false; reason: 'invalid-cursor' }> {
  try {
    return { ok: true, page: await listProducts(params) };
  } catch (error) {
    if (params.cursor && error instanceof ApiError && error.status === 400) {
      return { ok: false, reason: 'invalid-cursor' };
    }
    throw error;
  }
}

/** A product's detail, or null when no product has this id (including a malformed id). */
export async function getProduct(id: string): Promise<ProductDetail | null> {
  try {
    return await apiGetForPage(`${ADMIN}/products/${encodeURIComponent(id)}`, ProductDetail);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}
