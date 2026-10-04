import { ROLE_PERMISSIONS } from '@ite/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ADMIN_ORIGIN, createStaff, login, sessionCookie } from '../test/support/auth.ts';
import { createTestDatabase } from '../test/support/database.ts';
import { testEnv } from '../test/support/env.ts';
import { buildApp } from './app.ts';
import type { AdminRouteRecord } from './plugins/authorize.ts';
import { createPrismaClient, type PrismaClient } from '@ite/db';
import type { FastifyInstance } from 'fastify';

/**
 * Every admin route and the permission it must declare. Adding, removing, or
 * changing a route's declaration fails this test until the table is updated
 * on purpose.
 */
const EXPECTED: Record<string, AdminRouteRecord['permission']> = {
  'POST /api/v1/admin/auth/login': 'anonymous',
  'GET /api/v1/admin/auth/me': 'authenticated',
  'HEAD /api/v1/admin/auth/me': 'authenticated',
  'POST /api/v1/admin/auth/logout': 'authenticated',
  'POST /api/v1/admin/auth/change-password': 'authenticated',
  'GET /api/v1/admin/staff': 'staff:read',
  'HEAD /api/v1/admin/staff': 'staff:read',
  'POST /api/v1/admin/staff': 'staff:manage',
  'PATCH /api/v1/admin/staff/:id/role': 'staff:manage',
  'POST /api/v1/admin/staff/:id/deactivate': 'staff:manage',
  'POST /api/v1/admin/staff/:id/reactivate': 'staff:manage',
  'GET /api/v1/admin/categories': 'catalog:read',
  'HEAD /api/v1/admin/categories': 'catalog:read',
  'POST /api/v1/admin/categories': 'catalog:manage',
  'GET /api/v1/admin/categories/:id': 'catalog:read',
  'HEAD /api/v1/admin/categories/:id': 'catalog:read',
  'PATCH /api/v1/admin/categories/:id': 'catalog:manage',
  'POST /api/v1/admin/categories/:id/archive': 'catalog:manage',
  'POST /api/v1/admin/categories/:id/restore': 'catalog:manage',
  'GET /api/v1/admin/sizes': 'catalog:read',
  'HEAD /api/v1/admin/sizes': 'catalog:read',
  'POST /api/v1/admin/sizes': 'catalog:manage',
  'PATCH /api/v1/admin/sizes/:id': 'catalog:manage',
  'DELETE /api/v1/admin/sizes/:id': 'catalog:manage',
  'GET /api/v1/admin/colors': 'catalog:read',
  'HEAD /api/v1/admin/colors': 'catalog:read',
  'POST /api/v1/admin/colors': 'catalog:manage',
  'PATCH /api/v1/admin/colors/:id': 'catalog:manage',
  'DELETE /api/v1/admin/colors/:id': 'catalog:manage',
  'GET /api/v1/admin/products': 'catalog:read',
  'HEAD /api/v1/admin/products': 'catalog:read',
  'POST /api/v1/admin/products': 'catalog:manage',
  'GET /api/v1/admin/products/:id': 'catalog:read',
  'HEAD /api/v1/admin/products/:id': 'catalog:read',
  'PATCH /api/v1/admin/products/:id': 'catalog:manage',
  'POST /api/v1/admin/products/:id/activate': 'catalog:manage',
  'POST /api/v1/admin/products/:id/deactivate': 'catalog:manage',
  'POST /api/v1/admin/products/:id/archive': 'catalog:manage',
  'POST /api/v1/admin/products/:id/restore': 'catalog:manage',
  'POST /api/v1/admin/products/:id/variants': 'catalog:manage',
  'PATCH /api/v1/admin/products/:id/variants/:variantId': 'catalog:manage',
  'POST /api/v1/admin/products/:id/variants/:variantId/activate': 'catalog:manage',
  'POST /api/v1/admin/products/:id/variants/:variantId/deactivate': 'catalog:manage',
  'POST /api/v1/admin/products/:id/variants/:variantId/stock-adjustments': 'catalog:manage',
  'POST /api/v1/admin/products/:id/images': 'catalog:manage',
  'PATCH /api/v1/admin/products/:id/images/:imageId': 'catalog:manage',
  'DELETE /api/v1/admin/products/:id/images/:imageId': 'catalog:manage',
  'PUT /api/v1/admin/products/:id/images/order': 'catalog:manage',
};

describe('admin route permission coverage', () => {
  const registry: AdminRouteRecord[] = [];
  let app: FastifyInstance;
  let db: PrismaClient;
  let adminCookie: string;
  let targetId: string;

  beforeAll(async () => {
    const url = await createTestDatabase();
    app = await buildApp({ env: testEnv({ DATABASE_URL: url }), adminRouteRegistry: registry });
    await app.ready();
    db = createPrismaClient(url);
    await createStaff(db, {
      email: 'owner@example.com',
      password: 'correct-horse-battery',
      role: 'OWNER',
    });
    targetId = (
      await createStaff(db, { email: 'target@example.com', password: 'correct-horse-battery' })
    ).id;
    await createStaff(db, {
      email: 'admin@example.com',
      password: 'correct-horse-battery',
      role: 'ADMIN',
    });
    adminCookie = sessionCookie(await login(app, 'admin@example.com', 'correct-horse-battery'));
  });
  afterAll(async () => {
    await app.close();
    await db.$disconnect();
  });

  it('every admin route declares exactly the expected permission', () => {
    const actual = Object.fromEntries(registry.map((r) => [`${r.method} ${r.url}`, r.permission]));
    expect(actual).toEqual(EXPECTED);
  });

  it('Catalog requires a session', async () => {
    const catalogRoutes = registry.filter((r) => r.permission.startsWith('catalog:'));
    expect(catalogRoutes.length).toBeGreaterThan(0);
    const counts = () =>
      Promise.all([db.category.count(), db.size.count(), db.color.count(), db.product.count()]);
    const before = await counts();

    for (const { method, url } of catalogRoutes) {
      const res = await app.inject({
        method: method as 'GET' | 'HEAD' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
        url: url.replaceAll(/:\w+/g, targetId),
        headers: { origin: ADMIN_ORIGIN },
        ...(method === 'GET' || method === 'HEAD' ? {} : { payload: { name: 'No Session' } }),
      });
      expect(res.statusCode, `${method} ${url}`).toBe(401);
      if (method !== 'HEAD') expect(res.json().code, `${method} ${url}`).toBe('UNAUTHENTICATED');
    }
    expect(await counts()).toEqual(before);
  });

  it('ADMIN is denied every staff:manage route', async () => {
    expect(ROLE_PERMISSIONS.ADMIN).not.toContain('staff:manage');
    const manageRoutes = registry.filter((r) => r.permission === 'staff:manage');
    expect(manageRoutes.length).toBeGreaterThan(0);

    for (const { method, url } of manageRoutes) {
      const res = await app.inject({
        method: method as 'POST' | 'PATCH',
        url: url.replace(':id', targetId),
        headers: { cookie: adminCookie, origin: ADMIN_ORIGIN },
        payload: {},
      });
      expect(res.statusCode, `${method} ${url}`).toBe(403);
      expect(res.json().code, `${method} ${url}`).toBe('FORBIDDEN');
    }
    // Nothing changed for the target.
    expect(await db.adminUser.findUniqueOrThrow({ where: { id: targetId } })).toMatchObject({
      role: 'ADMIN',
      status: 'ACTIVE',
    });
  });
});
