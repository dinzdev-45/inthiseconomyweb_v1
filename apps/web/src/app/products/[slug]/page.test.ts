import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DETAIL } from '@/features/product-detail/__fixtures__/detail';

vi.mock('server-only', () => ({}));
const route = await import('./page.tsx');

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('API_URL', 'http://api.internal:4000');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  fetchMock.mockReset();
});

describe('storefront-product-detail: Product page layout and performance', () => {
  it('One product request per page', async () => {
    fetchMock.mockImplementation(
      async () =>
        new Response(JSON.stringify(DETAIL), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const params = Promise.resolve({ slug: 'two-tone-hoodie' });

    // One render: metadata, then the page.
    await route.generateMetadata({ params, searchParams: Promise.resolve({}) });
    await route.default({ params, searchParams: Promise.resolve({}) });

    // Next memoizes identical fetches within a render (design D3): every call here must be the
    // same GET, so the API sees exactly one request, and it is the product endpoint.
    const distinct = new Set(
      fetchMock.mock.calls.map(([url, init]) => JSON.stringify([String(url), init])),
    );
    expect(distinct.size).toBe(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('http://api.internal:4000/api/v1/store/products/two-tone-hoodie');
    expect(init).toMatchObject({ method: 'GET', next: { revalidate: 60 } });
  });
});
