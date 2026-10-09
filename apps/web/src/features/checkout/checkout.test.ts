import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: vi.fn(),
  }),
}));
const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath }));
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

const { fieldOf, readValues, toRequest, INITIAL_STATE } = await import('./form.ts');
const { placeOrder } = await import('./actions.ts');
const { getCheckoutSummary, getOrder } = await import('./server/checkout.ts');

const TOKEN = 'a'.repeat(43);
const KEY = 'k'.repeat(43);
const idr = (amount: number) => ({ amount, currency: 'IDR' });
const VALUES = {
  email: 'Ana@Example.com',
  name: 'Ana Putri',
  phone: '0812 3456 7890',
  line1: 'Jl. Melati No. 5',
  line2: '',
  city: 'Bandung',
  province: '32',
  postalCode: '40115',
  note: '',
};
const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  data.set('expectedAmount', '154800000');
  data.set('expectedCurrency', 'IDR');
  return data;
};
const json = (status: number, body: unknown, type = 'application/json') =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': type } });
const problem = (status: number, code: string, errors?: object[]) =>
  json(
    status,
    {
      type: 'about:blank',
      title: 'x',
      status,
      detail: 'x',
      requestId: 'r',
      code,
      ...(errors ? { errors } : {}),
    },
    'application/problem+json',
  );
const ORDER = {
  number: 'ITE-7KQ2M9XA',
  status: 'AWAITING_PAYMENT',
  placedAt: '2026-10-08T05:00:00.000Z',
  paymentDeadline: '2026-10-09T05:00:00.000Z',
  lines: [],
  subtotal: idr(0),
  shippingFee: idr(0),
  total: idr(0),
  contact: { email: 'ana@example.com', name: 'Ana Putri', phone: '+6281234567890' },
  delivery: {
    line1: 'Jl. Melati No. 5',
    line2: null,
    city: 'Bandung',
    province: { code: '32', name: 'Jawa Barat' },
    postalCode: '40115',
  },
  note: null,
};

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('API_URL', 'http://api.internal:4000');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  fetchMock.mockReset();
  revalidatePath.mockReset();
  jar.clear();
});

describe('checkout form', () => {
  it('builds the order request from the form, normalizing it', () => {
    const result = toRequest(VALUES, idr(154_800_000));
    expect(result).toEqual({
      ok: true,
      request: {
        email: 'ana@example.com',
        name: 'Ana Putri',
        phone: '+6281234567890',
        address: {
          line1: 'Jl. Melati No. 5',
          city: 'Bandung',
          province: '32',
          postalCode: '40115',
        },
        expectedTotal: idr(154_800_000),
      },
    });
  });

  it('reports one customer-facing message per field', () => {
    const result = toRequest(
      { ...VALUES, email: 'nope', postalCode: '4011', province: '' },
      idr(1),
    );
    expect(result).toEqual({
      ok: false,
      errors: {
        email: 'Enter a valid email address.',
        province: 'Choose a province.',
        postalCode: 'Enter a 5-digit postal code.',
      },
    });
  });

  it('maps request paths to fields and reads only known fields', () => {
    expect(fieldOf('body.address.postalCode')).toBe('postalCode');
    expect(fieldOf('email')).toBe('email');
    expect(fieldOf('coupon')).toBeUndefined();
    const data = form(VALUES);
    data.set('coupon', 'FREE');
    expect(readValues(data)).toEqual(VALUES);
  });
});

describe('placeOrder', () => {
  it('returns field errors with the values entered, without calling the API', async () => {
    jar.set('ite_cart', TOKEN);
    const state = await placeOrder(INITIAL_STATE, form({ ...VALUES, email: 'nope' }));
    expect(state).toMatchObject({ status: 'invalid', errors: { email: expect.any(String) } });
    expect(state.status === 'invalid' && state.values.email).toBe('nope');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('places the order and redirects with only the number and key in the URL', async () => {
    jar.set('ite_cart', TOKEN);
    fetchMock.mockResolvedValueOnce(json(201, { order: ORDER, accessKey: KEY }));
    const error = await placeOrder(INITIAL_STATE, form(VALUES)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Redirect);
    const url = (error as Redirect).url;
    expect(url).toBe(`/orders/ITE-7KQ2M9XA?key=${KEY}`);
    for (const value of ['Ana', 'Melati', '0812', '40115', 'Bandung'])
      expect(url).not.toContain(value);

    const [apiUrl, init] = fetchMock.mock.calls[0]!;
    expect(apiUrl).toBe('http://api.internal:4000/api/v1/store/orders');
    expect((init!.headers as Record<string, string>)['x-cart-token']).toBe(TOKEN);
    expect(JSON.parse(String(init!.body))).toMatchObject({
      phone: '+6281234567890',
      expectedTotal: idr(154_800_000),
    });
  });

  it.each(['CART_CHANGED', 'CART_EMPTY', 'CART_NOT_FOUND'])(
    'on %s re-renders checkout with the values kept',
    async (code) => {
      jar.set('ite_cart', TOKEN);
      fetchMock.mockResolvedValueOnce(problem(code === 'CART_NOT_FOUND' ? 404 : 409, code));
      expect(await placeOrder(INITIAL_STATE, form(VALUES))).toEqual({
        status: 'changed',
        values: VALUES,
      });
      expect(revalidatePath).toHaveBeenCalledWith('/checkout');
    },
  );

  it('maps API field errors, and reports other failures as failed', async () => {
    jar.set('ite_cart', TOKEN);
    fetchMock.mockResolvedValueOnce(
      problem(400, 'VALIDATION_FAILED', [{ path: 'body.address.city', message: 'Too long' }]),
    );
    expect(await placeOrder(INITIAL_STATE, form(VALUES))).toMatchObject({
      status: 'invalid',
      errors: { city: 'Too long' },
    });
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    expect(await placeOrder(INITIAL_STATE, form(VALUES))).toEqual({
      status: 'failed',
      values: VALUES,
    });
  });

  it('without a cart cookie, shows the changed cart', async () => {
    expect(await placeOrder(INITIAL_STATE, form(VALUES))).toEqual({
      status: 'changed',
      values: VALUES,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('checkout loaders', () => {
  it('getCheckoutSummary is null without a cart, or when the API no longer knows it', async () => {
    expect(await getCheckoutSummary()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    jar.set('ite_cart', TOKEN);
    fetchMock.mockResolvedValueOnce(problem(404, 'CART_NOT_FOUND'));
    expect(await getCheckoutSummary()).toBeNull();
  });

  it('getOrder sends the key in a header, and never calls the API for malformed input', async () => {
    expect(await getOrder('nope', KEY)).toBeNull();
    expect(await getOrder('ITE-7KQ2M9XA', undefined)).toBeNull();
    expect(await getOrder('ITE-7KQ2M9XA', 'short')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValueOnce(json(200, ORDER));
    expect(await getOrder('ITE-7KQ2M9XA', KEY)).toEqual(ORDER);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://api.internal:4000/api/v1/store/orders/ITE-7KQ2M9XA');
    expect((init!.headers as Record<string, string>)['x-order-key']).toBe(KEY);

    fetchMock.mockResolvedValueOnce(problem(404, 'ORDER_NOT_FOUND'));
    expect(await getOrder('ITE-7KQ2M9XA', KEY)).toBeNull();
  });
});
