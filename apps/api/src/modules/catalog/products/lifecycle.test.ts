import { ProductDetail } from '@ite/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { minutes } from '../../../../test/support/auth.ts';
import {
  createCatalogHarness,
  idr,
  problem,
  UNKNOWN_ID,
  type CatalogHarness,
} from '../../../../test/support/catalog.ts';

let c: CatalogHarness;
beforeAll(async () => {
  c = await createCatalogHarness();
});
afterAll(async () => c.close());

const action = (productId: string, name: string, cookie?: string) =>
  c.call('POST', `/products/${productId}/${name}`, undefined, cookie);
const statusOf = async (productId: string) =>
  (await c.h.db.product.findUniqueOrThrow({ where: { id: productId } })).status;
const archivedCategory = () =>
  c.h.db.category.create({
    data: {
      name: 'Archived',
      slug: `archived-${Math.random().toString(36).slice(2, 8)}`,
      status: 'ARCHIVED',
    },
  });

describe('product-management: Product lifecycle', () => {
  it('Activate ready product', async () => {
    const { product } = await c.readyProduct();
    expect(product.status).toBe('DRAFT');
    c.h.clock.advance(minutes(1));

    const res = await action(product.id, 'activate', c.adminCookie);
    expect(res.statusCode).toBe(200);
    const active = ProductDetail.parse(res.json());
    expect(active).toMatchObject({
      status: 'ACTIVE',
      activatedAt: c.h.clock.now().toISOString(),
      updatedBy: c.admin.id,
      updatedAt: c.h.clock.now().toISOString(),
      createdBy: c.owner.id,
      createdAt: product.createdAt,
    });
  });

  it('Activate product without variants', async () => {
    const product = await c.product();
    await c.image(product.id);
    const body = problem(await action(product.id, 'activate'), 409, 'PRODUCT_NOT_READY');
    expect(body.detail).toContain('no active variant');
    expect(await statusOf(product.id)).toBe('DRAFT');

    // Only an inactive variant does not count either.
    const variant = await c.variant(product.id);
    c.ok(await c.call('POST', `/products/${product.id}/variants/${variant.id}/deactivate`));
    expect(
      problem(await action(product.id, 'activate'), 409, 'PRODUCT_NOT_READY').detail,
    ).toContain('no active variant');
  });

  it('rejects activation when every active variant is free', async () => {
    const product = await c.product({ basePrice: idr(0) });
    await c.variant(product.id);
    await c.image(product.id);
    const body = problem(await action(product.id, 'activate'), 409, 'PRODUCT_NOT_READY');
    expect(body.detail).toContain('no active variant is priced above zero');
    // A positive override qualifies even with a free base price.
    await c.variant(product.id, { priceOverride: idr(10_000) });
    expect((await action(product.id, 'activate')).statusCode).toBe(200);
  });

  it('Activate product without an image', async () => {
    const product = await c.product();
    await c.variant(product.id);
    const body = problem(await action(product.id, 'activate'), 409, 'PRODUCT_NOT_READY');
    expect(body.detail).toBe('The product is not ready to activate: it has no images.');
    expect(await statusOf(product.id)).toBe('DRAFT');
  });

  it('Activate product without a primary image', async () => {
    const { product } = await c.readyProduct();
    await c.image(product.id, false, 1);
    // Written outside the API: no image is primary.
    await c.h.db
      .$executeRaw`UPDATE product_images SET is_primary = false WHERE product_id = ${product.id}::uuid`;
    const body = problem(await action(product.id, 'activate'), 409, 'PRODUCT_NOT_READY');
    expect(body.detail).toBe('The product is not ready to activate: it has no primary image.');
    expect(await statusOf(product.id)).toBe('DRAFT');
  });

  it('Activation reports every unmet condition', async () => {
    const category = await archivedCategory();
    const product = await c.product({ categoryId: category.id });
    const body = problem(await action(product.id, 'activate'), 409, 'PRODUCT_NOT_READY');
    expect(body.detail).toBe(
      'The product is not ready to activate: its category is archived; it has no active variant; it has no images.',
    );
  });

  it('Activate product in archived category', async () => {
    const category = await archivedCategory();
    const { product } = await c.readyProduct({ categoryId: category.id });
    const body = problem(await action(product.id, 'activate'), 409, 'PRODUCT_NOT_READY');
    expect(body.detail).toBe('The product is not ready to activate: its category is archived.');
    expect(await statusOf(product.id)).toBe('DRAFT');
  });

  it('Deactivate and reactivate product', async () => {
    const { product } = await c.readyProduct();
    const first = await c.activate(product.id);
    c.h.clock.advance(minutes(5));

    const inactive = ProductDetail.parse(c.ok(await action(product.id, 'deactivate')));
    expect(inactive.status).toBe('INACTIVE');
    c.h.clock.advance(minutes(5));

    const again = ProductDetail.parse(c.ok(await action(product.id, 'activate')));
    expect(again.status).toBe('ACTIVE');
    expect(again.activatedAt).toBe(first.activatedAt);
    expect(Date.parse(again.updatedAt)).toBeGreaterThan(Date.parse(first.updatedAt));
  });

  it('Archive active product rejected', async () => {
    const { product } = await c.readyProduct();
    await c.activate(product.id);
    const body = problem(await action(product.id, 'archive'), 409, 'INVALID_STATE_TRANSITION');
    expect(body.detail).toContain('Deactivate it first');
    expect(await statusOf(product.id)).toBe('ACTIVE');
  });

  it('Archived product stays addressable', async () => {
    const { product, variant } = await c.readyProduct();
    await c.activate(product.id);
    c.ok(await action(product.id, 'deactivate'));
    const archived = ProductDetail.parse(c.ok(await action(product.id, 'archive')));
    expect(archived.status).toBe('ARCHIVED');

    const res = await c.call('GET', `/products/${product.id}`);
    expect(res.statusCode).toBe(200);
    const detail = ProductDetail.parse(res.json());
    expect(detail.status).toBe('ARCHIVED');
    expect(detail.variants.map((v) => v.id)).toEqual([variant.id]);
    expect(detail.images).toHaveLength(1);
    // No delete endpoint for products.
    expect((await c.call('DELETE', `/products/${product.id}`)).statusCode).toBe(404);
    expect(await c.h.db.product.count({ where: { id: product.id } })).toBe(1);
  });

  it('archives a draft, restores to INACTIVE, and can then activate', async () => {
    const { product } = await c.readyProduct();
    expect(ProductDetail.parse(c.ok(await action(product.id, 'archive'))).status).toBe('ARCHIVED');
    const restored = ProductDetail.parse(c.ok(await action(product.id, 'restore'), 200));
    expect(restored).toMatchObject({ status: 'INACTIVE', activatedAt: null });
    expect(ProductDetail.parse(c.ok(await action(product.id, 'activate'))).status).toBe('ACTIVE');
  });

  it.each([
    ['DRAFT', 'deactivate'],
    ['DRAFT', 'restore'],
    ['ACTIVE', 'activate'],
    ['ACTIVE', 'archive'],
    ['ACTIVE', 'restore'],
    ['INACTIVE', 'deactivate'],
    ['INACTIVE', 'restore'],
    ['ARCHIVED', 'activate'],
    ['ARCHIVED', 'deactivate'],
    ['ARCHIVED', 'archive'],
  ] as const)('rejects %s → %s with INVALID_STATE_TRANSITION', async (from, name) => {
    const { product } = await c.readyProduct();
    if (from === 'ACTIVE' || from === 'INACTIVE') await c.activate(product.id);
    if (from === 'INACTIVE') c.ok(await action(product.id, 'deactivate'));
    if (from === 'ARCHIVED') c.ok(await action(product.id, 'archive'));
    expect(await statusOf(product.id)).toBe(from);

    problem(await action(product.id, name), 409, 'INVALID_STATE_TRANSITION');
    expect(await statusOf(product.id)).toBe(from);
  });

  it('returns 404 for lifecycle actions on unknown products', async () => {
    for (const name of ['activate', 'deactivate', 'archive', 'restore']) {
      problem(await action(UNKNOWN_ID, name), 404, 'NOT_FOUND');
    }
  });
});

describe('product-management: slug lock and archived edits through the lifecycle API', () => {
  it('locks the slug after a real activation, even once INACTIVE', async () => {
    const { product } = await c.readyProduct({ name: 'Lifecycle Slug' });
    c.ok(await c.call('PATCH', `/products/${product.id}`, { slug: 'lifecycle-slug-final' }));
    await c.activate(product.id);
    c.ok(await action(product.id, 'deactivate'));
    problem(
      await c.call('PATCH', `/products/${product.id}`, { slug: 'changed' }),
      409,
      'SLUG_LOCKED',
    );
    // Restoring an archived product keeps the lock (activatedAt is never cleared).
    c.ok(await action(product.id, 'archive'));
    c.ok(await action(product.id, 'restore'));
    problem(
      await c.call('PATCH', `/products/${product.id}`, { slug: 'changed' }),
      409,
      'SLUG_LOCKED',
    );
  });

  it('rejects edits of a product archived through the API until it is restored', async () => {
    const product = await c.product();
    c.ok(await action(product.id, 'archive'));
    problem(
      await c.call('PATCH', `/products/${product.id}`, { name: 'x' }),
      409,
      'INVALID_STATE_TRANSITION',
    );
    c.ok(await action(product.id, 'restore'));
    expect(
      c.ok(await c.call('PATCH', `/products/${product.id}`, { name: 'Edited' })),
    ).toMatchObject({
      name: 'Edited',
    });
  });
});

describe('product-management: lifecycle concurrency', () => {
  it('never leaves an ACTIVE product in an archived category (activate vs. archive category)', async () => {
    for (let round = 0; round < 10; round++) {
      const category = await c.h.db.category.create({
        data: { name: `Race ${round}`, slug: `race-category-${round}` },
      });
      const { product } = await c.readyProduct({ categoryId: category.id });
      const [activation, archiving] = await Promise.all([
        action(product.id, 'activate'),
        c.call('POST', `/categories/${category.id}/archive`),
      ]);
      const finalCategory = await c.h.db.category.findUniqueOrThrow({ where: { id: category.id } });
      const finalStatus = await statusOf(product.id);
      expect(
        finalCategory.status === 'ARCHIVED' && finalStatus === 'ACTIVE',
        `round ${round}`,
      ).toBe(false);
      expect([`${activation.statusCode}/${archiving.statusCode}`]).toEqual([
        expect.stringMatching(/^(200\/409|409\/200)$/),
      ]);
    }
  });

  it('lets exactly one of two conflicting transitions win (activate vs. archive)', async () => {
    for (let round = 0; round < 10; round++) {
      const { product } = await c.readyProduct();
      const results = await Promise.all([
        action(product.id, 'activate'),
        action(product.id, 'archive'),
      ]);
      const statuses = results.map((res) => res.statusCode).sort();
      expect(statuses, `round ${round}`).toEqual([200, 409]);
      const loser = results.find((res) => res.statusCode === 409)!;
      expect((loser.json() as { code: string }).code).toBe('INVALID_STATE_TRANSITION');
      expect(['ACTIVE', 'ARCHIVED']).toContain(await statusOf(product.id));
    }
  });

  it('keeps an ACTIVE product ready under concurrent variant deactivations', async () => {
    for (let round = 0; round < 5; round++) {
      const { product, variant } = await c.readyProduct();
      const second = await c.variant(product.id);
      await c.activate(product.id);
      const results = await Promise.all([
        c.call('POST', `/products/${product.id}/variants/${variant.id}/deactivate`),
        c.call('POST', `/products/${product.id}/variants/${second.id}/deactivate`),
      ]);
      expect(results.map((res) => res.statusCode).sort(), `round ${round}`).toEqual([200, 409]);
      expect(
        await c.h.db.productVariant.count({ where: { productId: product.id, status: 'ACTIVE' } }),
      ).toBe(1);
    }
  });
});
