import type { FastifyInstance } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { afterEach, describe, expect, it } from 'vitest';

import { buildTestApp } from '../../test/support/app.ts';
import { testEnv } from '../../test/support/env.ts';

const ADMIN_ORIGIN = 'http://localhost:3001';
const FOREIGN_ORIGIN = 'https://evil.example';

let app: FastifyInstance;
afterEach(async () => app?.close());

const adminRoutes: FastifyPluginAsyncZod = async (zone) => {
  zone.get('/test/me', { config: { permission: 'anonymous' } }, async () => ({ ok: true }));
};
const storeRoutes: FastifyPluginAsyncZod = async (zone) => {
  zone.get('/test/catalog', async () => ({ ok: true }));
};
const build = (overrides: Record<string, string> = {}) =>
  buildTestApp({
    env: testEnv(overrides),
    routes: { admin: [adminRoutes], store: [storeRoutes] },
  });

describe('security headers', () => {
  it('sets nosniff and the referrer policy on every response, including errors', async () => {
    app = await build();
    for (const url of ['/health', '/api/v1/store/test/catalog', '/api/v1/missing']) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    }
  });

  it('sends Strict-Transport-Security only in production', async () => {
    app = await build();
    expect((await app.inject({ method: 'GET', url: '/health' })).headers).not.toHaveProperty(
      'strict-transport-security',
    );
    await app.close();

    app = await build({ NODE_ENV: 'production', SHIPPING_FLAT_FEE: '2000000' });
    expect(
      (await app.inject({ method: 'GET', url: '/health' })).headers['strict-transport-security'],
    ).toBe('max-age=63072000; includeSubDomains');
  });
});

describe('api-conventions: Security headers and CORS', () => {
  it('Foreign origin calls admin zone', async () => {
    app = await build();

    const simple = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/test/me',
      headers: { origin: FOREIGN_ORIGIN, cookie: 'ite_admin_session=abc' },
    });
    expect(simple.headers).not.toHaveProperty('access-control-allow-origin');
    expect(simple.headers).not.toHaveProperty('access-control-allow-credentials');

    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/admin/test/me',
      headers: { origin: FOREIGN_ORIGIN, 'access-control-request-method': 'POST' },
    });
    expect(preflight.headers).not.toHaveProperty('access-control-allow-origin');
    expect(preflight.headers).not.toHaveProperty('access-control-allow-credentials');
  });

  it('allows credentialed requests from the configured admin origin', async () => {
    app = await build();

    const simple = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/test/me',
      headers: { origin: ADMIN_ORIGIN },
    });
    expect(simple.headers['access-control-allow-origin']).toBe(ADMIN_ORIGIN);
    expect(simple.headers['access-control-allow-credentials']).toBe('true');

    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/admin/test/me',
      headers: { origin: ADMIN_ORIGIN, 'access-control-request-method': 'PATCH' },
    });
    expect(preflight.statusCode).toBe(204);
    expect(preflight.headers['access-control-allow-origin']).toBe(ADMIN_ORIGIN);
    expect(preflight.headers['access-control-allow-methods']).toContain('PATCH');
  });

  it('gives no CORS allowance outside the admin zone', async () => {
    app = await build();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/store/test/catalog',
      headers: { origin: ADMIN_ORIGIN },
    });
    expect(res.headers).not.toHaveProperty('access-control-allow-origin');
  });
});
