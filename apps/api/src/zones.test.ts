import { ProblemDetails } from '@ite/contracts';
import type { FastifyInstance } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildTestApp } from '../test/support/app.ts';
import { createTestDatabase } from '../test/support/database.ts';
import { testEnv } from '../test/support/env.ts';

let app: FastifyInstance;
let calls: string[];

beforeEach(async () => {
  calls = [];
  const store: FastifyPluginAsyncZod = async (zone) => {
    zone.get('/test/catalog', async () => {
      calls.push('store');
      return { items: [] };
    });
  };
  const admin: FastifyPluginAsyncZod = async (zone) => {
    zone.post('/test/staff', { config: { permission: 'authenticated' } }, async () => {
      calls.push('admin');
      return { created: true };
    });
    zone.post('/test/login', { config: { permission: 'anonymous' } }, async () => {
      calls.push('login');
      return { ok: true };
    });
  };
  const webhooks: FastifyPluginAsyncZod = async (zone) => {
    zone.post('/test/provider', async () => ({ received: true }));
  };
  app = await buildTestApp({
    env: testEnv({ DATABASE_URL: await createTestDatabase() }),
    routes: { store: [store], admin: [admin], webhooks: [webhooks] },
  });
});
afterEach(async () => app.close());

describe('api-conventions: Versioned API zones', () => {
  it('Store zone is public', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/store/test/catalog' });
    expect(res.statusCode).toBe(200);
    expect(calls).toEqual(['store']);
  });

  it('Admin zone without session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/test/staff',
      headers: { cookie: 'ite_admin_session=forged', origin: 'http://localhost:3001' },
    });
    expect(res.statusCode).toBe(401);
    expect(ProblemDetails.parse(res.json()).code).toBe('UNAUTHENTICATED');
    expect(calls).toEqual([]);
  });

  it('lets explicitly anonymous admin routes (login) through', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/test/login',
      headers: { origin: 'http://localhost:3001' },
    });
    expect(res.statusCode).toBe(200);
    expect(calls).toEqual(['login']);
  });

  it('mounts the webhooks zone', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/webhooks/test/provider' });
    expect(res.statusCode).toBe(200);
  });

  it('does not expose store routes under the admin prefix or vice versa', async () => {
    expect(
      (await app.inject({ method: 'GET', url: '/api/v1/admin/test/catalog' })).statusCode,
    ).toBe(404);
    expect((await app.inject({ method: 'POST', url: '/api/v1/store/test/staff' })).statusCode).toBe(
      404,
    );
  });
});
