import { createPrismaClient, type PrismaClient } from '@ite/db';
import { DEV_PRODUCTS, seedCatalog } from '@ite/db/seed';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestDatabase } from '../../test/support/database.ts';

let db: PrismaClient;
beforeAll(async () => {
  db = createPrismaClient(await createTestDatabase());
});
afterAll(async () => db.$disconnect());

/** Every catalog row, in a stable order, for before/after comparison. */
async function snapshot() {
  return {
    categories: await db.category.findMany({ orderBy: { slug: 'asc' } }),
    sizes: await db.size.findMany({ orderBy: { code: 'asc' } }),
    colors: await db.color.findMany({ orderBy: { slug: 'asc' } }),
    products: await db.product.findMany({ orderBy: { slug: 'asc' } }),
    variants: await db.productVariant.findMany({ orderBy: { sku: 'asc' } }),
    images: await db.productImage.findMany({ orderBy: { url: 'asc' } }),
  };
}

describe('dev catalog seed', () => {
  it('is idempotent: a second run creates nothing and changes nothing', async () => {
    const first = await seedCatalog(db);
    const before = await snapshot();
    const second = await seedCatalog(db);
    const after = await snapshot();

    expect(Object.values(first).every((r) => r.created > 0 && r.existing === 0)).toBe(true);
    expect(Object.values(second).every((r) => r.created === 0)).toBe(true);
    expect(after).toEqual(before);
  });

  it('seeds letter, one-size, and waist sizes in explicit order', async () => {
    const codes = (
      await db.size.findMany({ orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] })
    ).map((s) => s.code);
    expect(codes).toEqual(['XS', 'S', 'M', 'L', 'XL', 'XXL', 'OS', '28', '30', '32', '34']);
  });

  it('leaves every seeded ACTIVE product ready: active category, priced active variant, one primary image', async () => {
    const active = await db.product.findMany({
      where: { status: 'ACTIVE' },
      include: { category: true, variants: true, images: true },
    });
    expect(active.map((p) => p.slug).sort()).toEqual(
      DEV_PRODUCTS.filter((p) => p.status === 'ACTIVE')
        .map((p) => p.slug)
        .sort(),
    );
    for (const product of active) {
      expect(product.category.status).toBe('ACTIVE');
      expect(product.activatedAt).not.toBeNull();
      expect(
        product.variants.some(
          (v) => v.status === 'ACTIVE' && (v.priceOverrideAmount ?? product.basePriceAmount) > 0,
        ),
      ).toBe(true);
      expect(product.images.filter((i) => i.isPrimary)).toHaveLength(1);
    }
  });

  it('includes draft and inactive products, a price override, and system attribution', async () => {
    const statuses = (await db.product.findMany()).map((p) => p.status);
    expect(statuses).toContain('DRAFT');
    expect(statuses).toContain('INACTIVE');
    expect(
      await db.productVariant.count({ where: { priceOverrideAmount: { not: null } } }),
    ).toBeGreaterThan(0);
    expect(await db.product.count({ where: { createdById: { not: null } } })).toBe(0);
    expect(await db.product.count({ where: { currency: { not: 'IDR' } } })).toBe(0);
  });
});
