import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const jar = new Map<string, string>();
const setCookie = vi.fn((name: string, value: string) => jar.set(name, value));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: setCookie,
  }),
}));
class Redirect extends Error {
  constructor(readonly url: string) {
    super(url);
  }
}
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Redirect(url);
  },
}));

const { addToCart, removeLine, updateLine } = await import('./actions.ts');
const { addFailure, safeReturnTo, withParam } = await import('./outcome.ts');

const OLD = 'o'.repeat(43);
const NEW = 'n'.repeat(43);
const LINE_ID = '0199a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b';
const idr = (amount: number) => ({ amount, currency: 'IDR' });
const CART = {
  lines: [
    {
      id: LINE_ID,
      product: { slug: 'two-tone-hoodie', name: 'Two Tone Hoodie', image: null },
      color: { slug: 'black', name: 'Black' },
      size: { code: 'M', label: 'Medium' },
      quantity: 1,
      unitPrice: idr(1),
      lineTotal: idr(1),
      status: 'AVAILABLE',
    },
  ],
  itemCount: 1,
  subtotal: idr(1),
};
const EMPTY = { lines: [], itemCount: 0, subtotal: idr(0) };
const json = (status: number, body: unknown, type = 'application/json') =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': type } });
const problem = (status: number, code: string) =>
  json(
    status,
    { type: 'about:blank', title: 'x', status, detail: 'x', requestId: 'r', code },
    'application/problem+json',
  );

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('API_URL', 'http://api.internal:4000');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  fetchMock.mockReset();
  setCookie.mockClear();
  jar.clear();
});

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};
const ADD = form({
  productSlug: 'two-tone-hoodie',
  colorSlug: 'black',
  sizeCode: 'M',
  returnTo: '/products/two-tone-hoodie?color=black&size=M',
});
/** The URL an action redirected to. */
async function redirectOf(action: Promise<void>): Promise<string> {
  const error = await action.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(Redirect);
  return (error as Redirect).url;
}

describe('addToCart', () => {
  it('creates the cart on the first add, sets the cookie, and lands on /cart', async () => {
    fetchMock
      .mockResolvedValueOnce(json(201, { token: NEW, cart: EMPTY }))
      .mockResolvedValueOnce(json(200, CART));
    expect(await redirectOf(addToCart(ADD))).toBe(`/cart?added=${LINE_ID}`);
    expect(setCookie).toHaveBeenCalledWith(
      'ite_cart',
      NEW,
      expect.objectContaining({ httpOnly: true }),
    );
    const [createUrl] = fetchMock.mock.calls[0]!;
    const [addUrl, addInit] = fetchMock.mock.calls[1]!;
    expect(createUrl).toBe('http://api.internal:4000/api/v1/store/cart');
    expect(addUrl).toBe('http://api.internal:4000/api/v1/store/cart/items');
    expect(JSON.parse(String(addInit!.body))).toEqual({
      productSlug: 'two-tone-hoodie',
      colorSlug: 'black',
      sizeCode: 'M',
      quantity: 1,
    });
    expect((addInit!.headers as Record<string, string>)['x-cart-token']).toBe(NEW);
  });

  it('reuses the cookie cart, and replaces an expired one once', async () => {
    jar.set('ite_cart', OLD);
    fetchMock
      .mockResolvedValueOnce(problem(404, 'CART_NOT_FOUND'))
      .mockResolvedValueOnce(json(201, { token: NEW, cart: EMPTY }))
      .mockResolvedValueOnce(json(200, CART));
    expect(await redirectOf(addToCart(ADD))).toBe(`/cart?added=${LINE_ID}`);
    expect(jar.get('ite_cart')).toBe(NEW);
    expect((fetchMock.mock.calls[0]![1]!.headers as Record<string, string>)['x-cart-token']).toBe(
      OLD,
    );
  });

  it.each([
    ['VARIANT_UNAVAILABLE', 'unavailable'],
    ['INSUFFICIENT_STOCK', 'stock'],
    ['QUANTITY_LIMIT', 'limit'],
    ['CART_FULL', 'full'],
    ['INTERNAL_ERROR', 'failed'],
  ])('returns to the product page on %s with cart=%s', async (code, reason) => {
    jar.set('ite_cart', OLD);
    fetchMock.mockResolvedValueOnce(problem(code === 'INTERNAL_ERROR' ? 500 : 409, code));
    expect(await redirectOf(addToCart(ADD))).toBe(
      `/products/two-tone-hoodie?color=black&size=M&cart=${reason}`,
    );
  });

  it('reports a network failure as failed', async () => {
    jar.set('ite_cart', OLD);
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    expect(await redirectOf(addToCart(ADD))).toContain('cart=failed');
  });

  it('never calls the API for malformed input, and never redirects off the product pages', async () => {
    const bad = form({
      productSlug: 'tee',
      colorSlug: 'black',
      sizeCode: '',
      returnTo: 'https://evil.example/',
    });
    expect(await redirectOf(addToCart(bad))).toBe('/products/tee?cart=unavailable');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('updateLine and removeLine', () => {
  it('update a line and report the outcome on /cart', async () => {
    jar.set('ite_cart', OLD);
    fetchMock.mockResolvedValueOnce(json(200, CART));
    expect(await redirectOf(updateLine(form({ lineId: LINE_ID, quantity: '3' })))).toBe(
      '/cart?status=updated',
    );
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`http://api.internal:4000/api/v1/store/cart/items/${LINE_ID}`);
    expect(init).toMatchObject({ method: 'PATCH', body: '{"quantity":3}' });

    fetchMock.mockResolvedValueOnce(problem(409, 'INSUFFICIENT_STOCK'));
    expect(await redirectOf(updateLine(form({ lineId: LINE_ID, quantity: '6' })))).toBe(
      '/cart?status=stock',
    );
    expect(await redirectOf(updateLine(form({ lineId: LINE_ID, quantity: '11' })))).toBe(
      '/cart?status=limit',
    );
  });

  it('remove a line; a gone line or cart just shows the cart', async () => {
    jar.set('ite_cart', OLD);
    fetchMock.mockResolvedValueOnce(json(200, EMPTY));
    expect(await redirectOf(removeLine(form({ lineId: LINE_ID })))).toBe('/cart?status=removed');
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ method: 'DELETE' });
    fetchMock.mockResolvedValueOnce(problem(404, 'NOT_FOUND'));
    expect(await redirectOf(removeLine(form({ lineId: LINE_ID })))).toBe('/cart');
  });

  it('do nothing without a cart cookie or with a malformed line id', async () => {
    expect(await redirectOf(removeLine(form({ lineId: LINE_ID })))).toBe('/cart');
    jar.set('ite_cart', OLD);
    expect(await redirectOf(removeLine(form({ lineId: 'x' })))).toBe('/cart');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('cart outcomes', () => {
  it('maps unknown codes to failed, and only allows product page return paths', () => {
    expect(addFailure(undefined)).toBe('failed');
    expect(safeReturnTo('/products/tee?color=black&size=M', 'tee')).toBe(
      '/products/tee?color=black&size=M',
    );
    for (const bad of [
      '//evil.example',
      'https://evil.example',
      '/cart',
      '/products/../admin',
      42,
    ]) {
      expect(safeReturnTo(bad, 'tee')).toBe('/products/tee');
    }
    expect(withParam('/products/tee?cart=stock&size=M', 'cart', 'limit')).toBe(
      '/products/tee?cart=limit&size=M',
    );
  });
});
