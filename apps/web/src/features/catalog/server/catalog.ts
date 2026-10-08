import 'server-only';

import { StoreCatalogFilters, StoreProductListResponse } from '@ite/contracts';

import { loadEnv } from '@/env';
import { storeGet } from '@/lib/api/store';

import type { ProductSummary } from '../types.ts';
import { toSearchParams, type CatalogState } from '../url-state.ts';
import { toProductSummary } from './mapper.ts';

/** Matches the API's `Cache-Control: max-age=60` (design D5). */
const REVALIDATE_SECONDS = 60;

export type CatalogPage = {
  products: ProductSummary[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

/**
 * One catalog page for `state`: exactly one product-list request and, when `withFilters`, one
 * filter-options request, sent in parallel. Never a request per product. API failures throw
 * (`StoreApiError` or a network error) for the route's error boundary.
 */
export async function getCatalogPage(
  state: CatalogState,
  { withFilters = false }: { withFilters?: boolean } = {},
): Promise<{ page: CatalogPage; filters: StoreCatalogFilters | null }> {
  const query = toSearchParams(state).toString();
  const [list, filters] = await Promise.all([
    storeGet(`/api/v1/store/products${query ? `?${query}` : ''}`, StoreProductListResponse, {
      revalidate: REVALIDATE_SECONDS,
    }),
    withFilters ? getCatalogFilters() : Promise.resolve(null),
  ]);
  const hosts = loadEnv().STOREFRONT_IMAGE_HOSTS;
  return {
    page: {
      products: list.data.map((product) => toProductSummary(product, hosts)),
      page: list.page,
      pageSize: list.pageSize,
      totalItems: list.totalItems,
      totalPages: list.totalPages,
    },
    filters,
  };
}

/** Filter options for the shop (categories with counts, sizes, colors of active products). */
export function getCatalogFilters(): Promise<StoreCatalogFilters> {
  return storeGet('/api/v1/store/catalog/filters', StoreCatalogFilters, {
    revalidate: REVALIDATE_SECONDS,
  });
}
