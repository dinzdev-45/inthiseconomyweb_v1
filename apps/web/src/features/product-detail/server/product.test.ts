import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { getProductDetail } = await import('./product.ts');
const { StoreApiError } = await import('@/lib/api/store');

import { DETAIL } from '../__fixtures__/detail.ts';

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

const idr = (amount: number) => ({ amount, currency: 'IDR' });
const json = (status: number, body: unknown, type = 'application/json') =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': type } });

describe('getProductDetail', () => {
  it('fetches the product once, cacheable for 60 seconds, and maps it', async () => {
    fetchMock.mockResolvedValue(json(200, DETAIL));
    const product = await getProductDetail('two-tone-hoodie');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://api.internal:4000/api/v1/store/products/two-tone-hoodie');
    expect(init).toMatchObject({ method: 'GET', next: { revalidate: 60 } });
    expect(product).toMatchObject({
      slug: 'two-tone-hoodie',
      description: 'Two-tone fleece.',
      price: { min: idr(69_900_000), max: idr(69_900_000) },
      variants: DETAIL.variants,
    });
    // Images on hosts that are not allowed are dropped; the rest keep their color tag.
    expect(product!.images).toEqual([
      { src: '/images/front.jpg', alt: 'Front', width: 1200, height: 1500, color: 'black' },
      {
        src: 'https://cdn.example.com/detail.jpg',
        alt: 'Detail',
        width: 1200,
        height: 1500,
        color: null,
      },
    ]);
  });

  it('returns null for 404 and malformed slugs, and throws otherwise', async () => {
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
    expect(await getProductDetail('draft-product')).toBeNull();
    expect(await getProductDetail('Not A Slug/../x')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValue(json(500, {}));
    await expect(getProductDetail('two-tone-hoodie')).rejects.toBeInstanceOf(StoreApiError);
  });

  it('rejects a response that is not the product detail contract', async () => {
    const { description: _description, ...summaryOnly } = DETAIL;
    fetchMock.mockResolvedValue(json(200, summaryOnly));
    await expect(getProductDetail('two-tone-hoodie')).rejects.toThrow();
  });
});
