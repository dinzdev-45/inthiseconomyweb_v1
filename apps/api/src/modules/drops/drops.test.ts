import { AdminDrop, AdminDropListResponse, DropCandidatesResponse } from '@ite/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ADMIN_ORIGIN } from '../../../test/support/auth.ts';
import {
  createCatalogHarness,
  problem,
  UNKNOWN_ID,
  type CatalogHarness,
} from '../../../test/support/catalog.ts';
import { testEnv } from '../../../test/support/env.ts';
import { createTestDatabase } from '../../../test/support/database.ts';
import { buildApp } from '../../app.ts';
import type { AdminRouteRecord } from '../../plugins/authorize.ts';

let c: CatalogHarness;
beforeAll(async () => {
  c = await createCatalogHarness();
});
afterAll(async () => c.close());

const RELEASE = '2026-11-01T03:00:00.000Z';
const IMAGE = { url: '/images/drops/overtime.jpg', alt: 'Overtime campaign' };
const drop = async (body: object = {}) =>
  AdminDrop.parse(
    c.ok(
      await c.call('POST', '/drops', {
        collection: 'COLLECTION 002',
        title: 'Overtime',
        releaseAt: RELEASE,
        ...body,
      }),
      201,
    ),
  );
const setProducts = (id: string, productIds: string[]) =>
  c.call('PUT', `/drops/${id}/products`, { productIds });

describe('drops-management: Drops', () => {
  it('Create a drop', async () => {
    const created = await drop({ description: 'Late shifts.' });
    expect(created).toMatchObject({
      slug: 'overtime',
      collection: 'COLLECTION 002',
      title: 'Overtime',
      description: 'Late shifts.',
      releaseAt: RELEASE,
      image: null,
      status: 'DRAFT',
      products: [],
      createdBy: c.owner.id,
      updatedBy: c.owner.id,
    });
    // Generated slugs get a suffix; reads list newest release first.
    expect((await drop()).slug).toBe('overtime-2');
    const list = AdminDropListResponse.parse(c.ok(await c.call('GET', '/drops')));
    expect(list.data[0]).toMatchObject({ title: 'Overtime', productCount: 0, status: 'DRAFT' });
    expect(AdminDrop.parse(c.ok(await c.call('GET', `/drops/${created.id}`))).id).toBe(created.id);
    problem(await c.call('GET', `/drops/${UNKNOWN_ID}`), 404, 'NOT_FOUND');
  });

  it('Drop slug conflict', async () => {
    const first = await drop({ title: 'Conflict', slug: 'conflict-drop' });
    problem(
      await c.call('POST', '/drops', {
        collection: 'C',
        title: 'X',
        releaseAt: RELEASE,
        slug: 'conflict-drop',
      }),
      409,
      'SLUG_EXISTS',
    );
    const second = await drop({ title: 'Other' });
    problem(await c.call('PATCH', `/drops/${second.id}`, { slug: first.slug }), 409, 'SLUG_EXISTS');
    // Edits otherwise apply, with attribution.
    const edited = AdminDrop.parse(
      c.ok(
        await c.call(
          'PATCH',
          `/drops/${second.id}`,
          { title: 'Renamed', image: IMAGE },
          c.adminCookie,
        ),
      ),
    );
    expect(edited).toMatchObject({ title: 'Renamed', image: IMAGE, updatedBy: c.admin.id });
  });

  it('Drops need catalog permissions', async () => {
    // Every drop route declares catalog:read (reads) or catalog:manage (changes); the generic
    // permission check that refuses staff without them is covered by "Insufficient role".
    const registry: AdminRouteRecord[] = [];
    const app = await buildApp({
      env: testEnv({ DATABASE_URL: await createTestDatabase() }),
      adminRouteRegistry: registry,
    });
    await app.ready();
    const dropRoutes = registry.filter((r) => r.url.startsWith('/api/v1/admin/drops'));
    expect(dropRoutes.length).toBeGreaterThan(0);
    for (const { method, url, permission } of dropRoutes) {
      expect(permission, `${method} ${url}`).toBe(
        method === 'GET' || method === 'HEAD' ? 'catalog:read' : 'catalog:manage',
      );
    }
    await app.close();

    // Without a session nothing is read or changed.
    const before = await c.h.db.drop.count();
    const anonymous = await c.h.app.inject({
      method: 'POST',
      url: '/api/v1/admin/drops',
      headers: { origin: ADMIN_ORIGIN },
      payload: { collection: 'C', title: 'Nope', releaseAt: RELEASE },
    });
    problem(anonymous, 401, 'UNAUTHENTICATED');
    problem(
      await c.h.app.inject({ method: 'GET', url: '/api/v1/admin/drops' }),
      401,
      'UNAUTHENTICATED',
    );
    expect(await c.h.db.drop.count()).toBe(before);
  });
});

describe('drops-management: Drop products', () => {
  it("Set a drop's products", async () => {
    const d = await drop({ title: 'Products One' });
    const [a, b, x] = [await c.product(), await c.product(), await c.product()];
    const set = AdminDrop.parse(c.ok(await setProducts(d.id, [b.id, x.id, a.id])));
    expect(set.products.map((p) => p.id)).toEqual([b.id, x.id, a.id]);
    const again = AdminDrop.parse(c.ok(await setProducts(d.id, [a.id, b.id])));
    expect(again.products.map((p) => p.id)).toEqual([a.id, b.id]);
    expect(await c.h.db.dropProduct.count({ where: { productId: x.id } })).toBe(0);
    problem(await setProducts(d.id, [UNKNOWN_ID]), 422, 'UNKNOWN_REFERENCE');
  });

  it('Product in another drop', async () => {
    const one = await drop({ title: 'Owner Drop' });
    const two = await drop({ title: 'Other Drop' });
    const p = await c.product();
    c.ok(await setProducts(one.id, [p.id]));
    const body = problem(await setProducts(two.id, [p.id]), 409, 'PRODUCT_IN_OTHER_DROP');
    expect(body.errors?.[0]?.path).toBe('productIds.0');
    expect(AdminDrop.parse(c.ok(await c.call('GET', `/drops/${one.id}`))).products).toHaveLength(1);
    expect(AdminDrop.parse(c.ok(await c.call('GET', `/drops/${two.id}`))).products).toHaveLength(0);
  });

  it('Find products for a drop', async () => {
    const d = await drop({ title: 'Candidates' });
    const other = await drop({ title: 'Taken By' });
    const free = await c.product({ name: 'Candidate Tee One' });
    const taken = await c.product({ name: 'Candidate Tee Two' });
    c.ok(await setProducts(other.id, [taken.id]));
    const found = DropCandidatesResponse.parse(
      c.ok(await c.call('GET', `/drops/${d.id}/candidates?q=candidate%20tee`)),
    );
    expect(found.data.map((p) => [p.name, p.drop?.title ?? null])).toEqual([
      ['Candidate Tee One', null],
      ['Candidate Tee Two', 'Taken By'],
    ]);
    expect(found.data[0]!.id).toBe(free.id);
    problem(await c.call('GET', `/drops/${UNKNOWN_ID}/candidates?q=tee`), 404, 'NOT_FOUND');
  });
});

describe('drops-management: Drop publishing', () => {
  it('Publish a ready drop', async () => {
    const d = await drop({ title: 'Ready', image: IMAGE });
    c.ok(await setProducts(d.id, [(await c.product()).id, (await c.product()).id]));
    const published = AdminDrop.parse(c.ok(await c.call('POST', `/drops/${d.id}/publish`)));
    expect(published.status).toBe('PUBLISHED');
    problem(await c.call('POST', `/drops/${d.id}/publish`), 409, 'INVALID_STATE_TRANSITION');
  });

  it('Drop not ready to publish', async () => {
    const d = await drop({ title: 'Not Ready' });
    const body = problem(await c.call('POST', `/drops/${d.id}/publish`), 409, 'DROP_NOT_READY');
    expect(body.errors?.map((e) => e.path)).toEqual(['image', 'products']);
    expect(body.detail).toContain('an image');
    expect(AdminDrop.parse(c.ok(await c.call('GET', `/drops/${d.id}`))).status).toBe('DRAFT');
  });

  it('Unpublish and delete', async () => {
    const d = await drop({ title: 'Lifecycle', image: IMAGE });
    const p = await c.product();
    c.ok(await setProducts(d.id, [p.id]));
    c.ok(await c.call('POST', `/drops/${d.id}/publish`));
    problem(await c.call('DELETE', `/drops/${d.id}`), 409, 'INVALID_STATE_TRANSITION');
    expect(AdminDrop.parse(c.ok(await c.call('POST', `/drops/${d.id}/unpublish`))).status).toBe(
      'DRAFT',
    );
    expect((await c.call('DELETE', `/drops/${d.id}`)).statusCode).toBe(204);
    problem(await c.call('GET', `/drops/${d.id}`), 404, 'NOT_FOUND');
    expect(await c.h.db.dropProduct.count({ where: { productId: p.id } })).toBe(0);
  });
});
