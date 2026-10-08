import type { StoreProductSummary } from '@ite/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_STATE } from '../url-state.ts';

vi.mock('server-only', () => ({}));
const { getCatalogPage, getStoreProduct } = await import('./catalog.ts');
const { StoreApiError } = await import('@/lib/api/store');

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('API_URL', 'http://api.internal:4000');
  vi.stubEnv('STOREFRONT_IMAGE_HOSTS', 'cdn.example.com');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  fetchMock.mockReset();
});

const json = (status: number, body: unknown, type = 'application/json') =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': type } });
const summary = (i: number): StoreProductSummary => ({
  slug: `product-${i}`,
  name: `Product ${i}`,
  category: { slug: 'tops', name: 'Tops' },
  price: { min: { amount: 100, currency: 'IDR' }, max: { amount: 100, currency: 'IDR' } },
  availability: 'IN_STOCK',
  colors: [],
  image: null,
  secondaryImage: null,
});
const FILTERS = { categories: [], sizes: [], colors: [] };

/** Answers list and filter requests by URL, like the API. */
function serveCatalog(count: number) {
  fetchMock.mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes('/catalog/filters')) return json(200, FILTERS);
    return json(200, {
      data: Array.from({ length: count }, (_, i) => summary(i)),
      page: 1,
      pageSize: 24,
      totalItems: 30,
      totalPages: 2,
    });
  });
}

describe('storefront-catalog: Catalog performance', () => {
  it('One catalog request per page', async () => {
    serveCatalog(24);
    const { page, filters } = await getCatalogPage(
      { ...DEFAULT_STATE, category: 'tops', sort: 'price-asc' },
      { withFilters: true },
    );

    expect(page.products).toHaveLength(24);
    expect(filters).toEqual(FILTERS);
    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls).toHaveLength(2);
    expect(urls.filter((url) => url.includes('/api/v1/store/products'))).toEqual([
      'http://api.internal:4000/api/v1/store/products?category=tops&sort=price-asc',
    ]);
    expect(urls.filter((url) => url.endsWith('/api/v1/store/catalog/filters'))).toHaveLength(1);
    // Both are cacheable for 60 seconds, like the API's Cache-Control.
    for (const [, init] of fetchMock.mock.calls) {
      expect(init).toMatchObject({ next: { revalidate: 60 } });
    }
  });
});

describe('catalog loaders', () => {
  it('search pages skip the filter options', async () => {
    serveCatalog(3);
    const { page, filters } = await getCatalogPage({ ...DEFAULT_STATE, q: 'hoodie' });
    expect(filters).toBeNull();
    expect(page).toMatchObject({ page: 1, pageSize: 24, totalItems: 30, totalPages: 2 });
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      'http://api.internal:4000/api/v1/store/products?q=hoodie',
    ]);
  });

  it('propagates API failures to the error boundary', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    await expect(getCatalogPage(DEFAULT_STATE, { withFilters: true })).rejects.toThrow(
      'fetch failed',
    );
  });

  it('getStoreProduct maps an active product', async () => {
    fetchMock.mockResolvedValue(json(200, { ...summary(1), availability: 'SOLD_OUT' }));
    expect(await getStoreProduct('product-1')).toMatchObject({
      slug: 'product-1',
      availability: 'SOLD_OUT',
    });
    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      'http://api.internal:4000/api/v1/store/products/product-1',
    );
  });

  it('getStoreProduct returns null for 404 and malformed slugs, and throws otherwise', async () => {
    fetchMock.mockResolvedValue(
      json(
        404,
        {
          type: 'about:blank',
          title: 'Not Found',
          status: 404,
          detail: 'Product not found.',
          requestId: 'r-1',
          code: 'NOT_FOUND',
        },
        'application/problem+json',
      ),
    );
    expect(await getStoreProduct('draft-product')).toBeNull();
    expect(await getStoreProduct('Not A Slug/../x')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValue(json(500, {}));
    await expect(getStoreProduct('product-1')).rejects.toBeInstanceOf(StoreApiError);
  });
});
