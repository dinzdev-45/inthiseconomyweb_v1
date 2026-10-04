import { LoginResponse, MeResponse } from '@ite/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const cookieStore = { get: vi.fn() };
vi.mock('next/headers', () => ({ cookies: async () => cookieStore }));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

const { apiSend } = await import('./client.ts');
const { apiGet, apiGetForPage } = await import('./server.ts');
const { ApiError, authRedirectFor } = await import('./errors.ts');

const ME = {
  id: '0199a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b',
  email: 'owner@example.com',
  role: 'OWNER',
  permissions: ['admin:access', 'staff:read', 'staff:manage'],
  mustChangePassword: false,
};

const json = (status: number, body: unknown, type = 'application/json') =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': type } });
const problem = (status: number, code: string, extra: object = {}) =>
  json(
    status,
    {
      type: 'about:blank',
      title: 'Error',
      status,
      detail: `detail ${code}`,
      requestId: 'req-1',
      code,
      ...extra,
    },
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
  cookieStore.get.mockReset();
});

describe('apiGet (server)', () => {
  it('forwards only the session cookie to the API and parses the response', async () => {
    cookieStore.get.mockReturnValue({ name: 'ite_admin_session', value: 'tok123' });
    fetchMock.mockResolvedValue(json(200, ME));

    expect(await apiGet('/api/v1/admin/auth/me', MeResponse)).toEqual(ME);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://api.internal:4000/api/v1/admin/auth/me');
    expect(init).toMatchObject({
      method: 'GET',
      cache: 'no-store',
      headers: { cookie: 'ite_admin_session=tok123' },
    });
    expect(cookieStore.get).toHaveBeenCalledWith('ite_admin_session');
  });

  it('sends no cookie header without a session', async () => {
    cookieStore.get.mockReturnValue(undefined);
    fetchMock.mockResolvedValue(json(200, ME));
    await apiGet('/api/v1/admin/auth/me', MeResponse);
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ headers: {} });
  });

  it('rejects a response that does not match the schema', async () => {
    fetchMock.mockResolvedValue(json(200, { ...ME, passwordHash: 'x' }));
    await expect(apiGet('/api/v1/admin/auth/me', MeResponse)).rejects.toThrow();
  });

  it('turns problem+json into a typed ApiError', async () => {
    fetchMock.mockResolvedValue(problem(403, 'FORBIDDEN'));
    const error = await apiGet('/api/v1/admin/staff', MeResponse).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
      detail: 'detail FORBIDDEN',
      requestId: 'req-1',
    });
  });
});

describe('apiGetForPage (server)', () => {
  it('redirects to /login on 401', async () => {
    fetchMock.mockResolvedValue(problem(401, 'UNAUTHENTICATED'));
    await expect(apiGetForPage('/api/v1/admin/auth/me', MeResponse)).rejects.toThrow(
      'REDIRECT:/login',
    );
  });

  it('redirects to /account/password on PASSWORD_CHANGE_REQUIRED', async () => {
    fetchMock.mockResolvedValue(problem(403, 'PASSWORD_CHANGE_REQUIRED'));
    await expect(apiGetForPage('/api/v1/admin/staff', MeResponse)).rejects.toThrow(
      'REDIRECT:/account/password',
    );
  });

  it('rethrows other errors', async () => {
    fetchMock.mockResolvedValue(problem(500, 'INTERNAL_ERROR'));
    await expect(apiGetForPage('/api/v1/admin/auth/me', MeResponse)).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});

describe('apiSend (browser)', () => {
  it('posts JSON to the same-origin path with credentials', async () => {
    fetchMock.mockResolvedValue(json(200, ME));

    const staff = await apiSend('POST', '/api/v1/admin/auth/login', {
      body: { email: 'owner@example.com', password: 'pw' },
      schema: LoginResponse,
    });

    expect(staff).toEqual(ME);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/v1/admin/auth/login');
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'owner@example.com', password: 'pw' }),
    });
  });

  it('sends no body or content-type when there is no body, and handles 204', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    expect(await apiSend('POST', '/api/v1/admin/auth/logout')).toBeUndefined();
    expect(fetchMock.mock.calls[0]![1]).toEqual({
      method: 'POST',
      credentials: 'same-origin',
      headers: {},
    });
  });

  it('exposes field errors from a validation problem', async () => {
    fetchMock.mockResolvedValue(
      problem(400, 'VALIDATION_FAILED', {
        errors: [{ path: 'newPassword', message: 'Too short' }],
      }),
    );
    const error = await apiSend('POST', '/api/v1/admin/auth/change-password', { body: {} }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect((error as InstanceType<typeof ApiError>).fieldErrors()).toEqual({
      newPassword: 'Too short',
    });
  });

  it('falls back to a generic ApiError for a non-problem error body', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 }));
    const error = await apiSend('POST', '/api/v1/admin/auth/logout').catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 502, code: undefined });
  });
});

describe('authRedirectFor', () => {
  it('maps auth errors to pages', () => {
    expect(authRedirectFor(new ApiError(401))).toBe('/login');
    expect(
      authRedirectFor(
        new ApiError(403, {
          type: 'about:blank',
          title: 'Forbidden',
          status: 403,
          detail: 'x',
          requestId: 'r',
          code: 'PASSWORD_CHANGE_REQUIRED',
        }),
      ),
    ).toBe('/account/password');
    expect(authRedirectFor(new ApiError(409))).toBeNull();
    expect(authRedirectFor(new Error('x'))).toBeNull();
  });
});
