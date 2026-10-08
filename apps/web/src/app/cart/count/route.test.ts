import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
  }),
}));
const { GET } = await import('./route.ts');

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('API_URL', 'http://api.internal:4000');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  fetchMock.mockReset();
  jar.clear();
});
const idr = (amount: number) => ({ amount, currency: 'IDR' });

describe('/cart/count', () => {
  it('answers 0 without calling the API when there is no cart cookie', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ count: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers the cart's item count, or 503 when the API fails", async () => {
    jar.set('ite_cart', 'a'.repeat(43));
    fetchMock.mockResolvedValueOnce(Response.json({ lines: [], itemCount: 3, subtotal: idr(0) }));
    expect(await (await GET()).json()).toEqual({ count: 3 });

    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    const failed = await GET();
    expect(failed.status).toBe(503);
    expect(await failed.json()).toEqual({ count: null });
  });
});
