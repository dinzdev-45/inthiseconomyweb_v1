import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const jar = new Map<string, string>();
const setCookie = vi.fn();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: setCookie,
  }),
}));

const { CART_COOKIE, cartCookieOptions, readCartToken, writeCartToken } =
  await import('./cookie.ts');
const { getCart } = await import('./cart.ts');

const TOKEN = 'a'.repeat(43);
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('API_URL', 'http://api.internal:4000');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  fetchMock.mockReset();
  setCookie.mockReset();
  jar.clear();
});
const json = (status: number, body: unknown, type = 'application/json') =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': type } });
const EMPTY = { lines: [], itemCount: 0, subtotal: { amount: 0, currency: 'IDR' } };

describe('cart cookie', () => {
  it('is HTTP-only, SameSite Lax, site-wide, kept 30 days, and Secure in production', () => {
    expect(cartCookieOptions(true)).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });
    expect(cartCookieOptions(false).secure).toBe(false);
  });

  it('reads only a well-formed token and writes it with those attributes', async () => {
    expect(await readCartToken()).toBeUndefined();
    jar.set(CART_COOKIE, 'not-a-token');
    expect(await readCartToken()).toBeUndefined();
    jar.set(CART_COOKIE, TOKEN);
    expect(await readCartToken()).toBe(TOKEN);

    await writeCartToken(TOKEN);
    expect(setCookie).toHaveBeenCalledWith(
      CART_COOKIE,
      TOKEN,
      expect.objectContaining({ httpOnly: true, path: '/' }),
    );
  });
});

describe('getCart', () => {
  it('is null without a cart cookie, and calls no API', async () => {
    expect(await getCart()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reads the cart with the token header', async () => {
    jar.set(CART_COOKIE, TOKEN);
    fetchMock.mockResolvedValue(json(200, EMPTY));
    expect(await getCart()).toEqual(EMPTY);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://api.internal:4000/api/v1/store/cart');
    expect((init!.headers as Record<string, string>)['x-cart-token']).toBe(TOKEN);
  });

  it('treats an unknown or expired cart as no cart, and throws on other failures', async () => {
    jar.set(CART_COOKIE, TOKEN);
    fetchMock.mockResolvedValue(
      json(
        404,
        {
          type: 'about:blank',
          title: 'Not Found',
          status: 404,
          detail: 'Cart not found.',
          requestId: 'r',
          code: 'CART_NOT_FOUND',
        },
        'application/problem+json',
      ),
    );
    expect(await getCart()).toBeNull();
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    await expect(getCart()).rejects.toThrow('fetch failed');
  });
});
