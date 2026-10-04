import { ProblemDetails } from '@ite/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  ADMIN_ORIGIN,
  createAuthHarness,
  createStaff,
  login,
  sessionCookie,
  type AuthHarness,
} from '../../test/support/auth.ts';
import { createTestDatabase } from '../../test/support/database.ts';
import { testEnv } from '../../test/support/env.ts';
import { buildApp } from '../app.ts';

const PASSWORD = 'correct-horse-battery';

describe('admin-access-control: Server-side permission enforcement', () => {
  let h: AuthHarness;
  beforeEach(async () => {
    h = await createAuthHarness();
    await createStaff(h.db, { email: 'owner@example.com', password: PASSWORD, role: 'OWNER' });
    await createStaff(h.db, { email: 'admin@example.com', password: PASSWORD, role: 'ADMIN' });
  });
  afterEach(async () => h.close());

  const createStaffAs = async (email: string) =>
    h.app.inject({
      method: 'POST',
      url: '/api/v1/admin/staff',
      headers: { cookie: sessionCookie(await login(h.app, email, PASSWORD)), origin: ADMIN_ORIGIN },
      payload: { email: 'new@example.com', role: 'ADMIN', temporaryPassword: 'temporary-password' },
    });

  it('Insufficient role', async () => {
    const res = await createStaffAs('admin@example.com');

    expect(res.statusCode).toBe(403);
    expect(ProblemDetails.parse(res.json()).code).toBe('FORBIDDEN');
    expect(await h.db.adminUser.count({ where: { email: 'new@example.com' } })).toBe(0);
  });

  it('Sufficient role', async () => {
    const res = await createStaffAs('owner@example.com');

    expect(res.statusCode).toBe(201);
    expect(await h.db.adminUser.count({ where: { email: 'new@example.com' } })).toBe(1);
  });

  it('Undeclared permission', async () => {
    const undeclared: FastifyPluginAsyncZod = async (admin) => {
      admin.get('/test/undeclared', async () => ({ ok: true }));
    };
    const start = async () => {
      const app = await buildApp({
        env: testEnv({ DATABASE_URL: await createTestDatabase() }),
        routes: { admin: [undeclared] },
      });
      try {
        await app.ready();
      } finally {
        await app.close();
      }
    };

    await expect(start()).rejects.toThrow(
      /\/api\/v1\/admin\/test\/undeclared has no permission declaration/,
    );
  });
});
