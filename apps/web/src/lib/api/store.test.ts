import { HealthResponse } from '@ite/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { StoreApiError, getApiHealth, storeGet } = await import('./store.ts');

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

const json = (status: number, body: unknown, type = 'application/json') =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': type } });

describe('storeGet', () => {
  it('calls the API server-side without credentials and validates the response', async () => {
    fetchMock.mockResolvedValue(json(200, { status: 'ok' }));

    expect(await getApiHealth()).toEqual({ status: 'ok' });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://api.internal:4000/health');
    expect(init).toEqual({
      method: 'GET',
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
  });

  it('supports time-based revalidation for cacheable store data', async () => {
    fetchMock.mockResolvedValue(json(200, { status: 'ok' }));
    await storeGet('/api/v1/store/anything', HealthResponse, { revalidate: 60 });
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ next: { revalidate: 60 } });
  });

  it('rejects a response that does not match the contract', async () => {
    fetchMock.mockResolvedValue(json(200, { status: 'ok', version: '1.2.3' }));
    await expect(getApiHealth()).rejects.toThrow();
  });

  it('turns a problem response into a StoreApiError', async () => {
    fetchMock.mockResolvedValue(
      json(
        404,
        {
          type: 'about:blank',
          title: 'Not Found',
          status: 404,
          detail: 'Nope',
          requestId: 'r-1',
          code: 'NOT_FOUND',
        },
        'application/problem+json',
      ),
    );
    const error = await storeGet('/api/v1/store/missing', HealthResponse).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(StoreApiError);
    expect(error).toMatchObject({ status: 404, code: 'NOT_FOUND', requestId: 'r-1' });
  });

  it('propagates network failures (the error page handles them)', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    await expect(getApiHealth()).rejects.toThrow('fetch failed');
  });
});
