import { StoreCatalogFilters } from '@ite/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createCatalogHarness, type CatalogHarness } from '../../../test/support/catalog.ts';

let c: CatalogHarness;
beforeAll(async () => {
  c = await createCatalogHarness();
});
afterAll(async () => c.close());

const get = (url: string) => c.h.app.inject({ method: 'GET', url: `/api/v1/store${url}` });

async function activeProduct(name: string, variants: object[] = [{}], categoryId?: string) {
  const created = await c.product({ name, ...(categoryId ? { categoryId } : {}) });
  const made = [];
  for (const variant of variants) made.push(await c.variant(created.id, variant));
  await c.image(created.id);
  return { product: await c.activate(created.id), variants: made };
}

describe('store-catalog-api: Filter options', () => {
  it('Filter options reflect active products', async () => {
    const outerwear = await c.h.db.category.create({
      data: { name: 'Outerwear', slug: 'outerwear' },
    });
    const [m, l, draftOnly] = [await c.size('M'), await c.size('L'), await c.size('DRAFT-ONLY')];
    const [black, white, hiddenColor] = [
      await c.color('black'),
      await c.color('white'),
      await c.color('inactive-only'),
    ];
    await c.h.db.color.update({ where: { id: black.id }, data: { hex: '#111111' } });
    // Display order differs from alphabetical order on purpose.
    await c.h.db.size.update({ where: { id: m.id }, data: { sortOrder: 1 } });
    await c.h.db.size.update({ where: { id: l.id }, data: { sortOrder: 2 } });

    await activeProduct('Options Tee', [
      { sizeId: l.id, colorId: white.id },
      { sizeId: m.id, colorId: black.id },
    ]);
    await activeProduct('Options Coat', [{ sizeId: m.id, colorId: white.id }], outerwear.id);
    const { product: twoVariant, variants } = await activeProduct('Options Shirt', [
      { sizeId: m.id, colorId: black.id },
      { sizeId: l.id, colorId: hiddenColor.id },
    ]);
    c.ok(await c.call('POST', `/products/${twoVariant.id}/variants/${variants[1]!.id}/deactivate`));
    const draft = await c.product({ name: 'Options Draft' });
    await c.variant(draft.id, { sizeId: draftOnly.id, colorId: white.id });
    const hiddenCategory = await c.h.db.category.create({
      data: { name: 'Hidden', slug: 'hidden' },
    });
    await c.product({ name: 'Options Hidden', categoryId: hiddenCategory.id });

    const res = await get('/catalog/filters');
    expect(res.headers['cache-control']).toBe('public, max-age=60');
    const options = StoreCatalogFilters.parse(c.ok(res));
    expect(options.categories).toEqual([
      { slug: 'apparel', name: 'Apparel', productCount: 2 },
      { slug: 'outerwear', name: 'Outerwear', productCount: 1 },
    ]);
    // Display order (sortOrder), not alphabetical.
    expect(options.sizes.map((size) => size.code)).toEqual(['M', 'L']);
    expect(options.colors).toEqual([
      { slug: 'black', name: 'black', hex: '#111111' },
      { slug: 'white', name: 'white', hex: null },
    ]);
    expect(JSON.stringify(options)).not.toContain('DRAFT-ONLY');
    expect(JSON.stringify(options)).not.toContain('inactive-only');
    expect(JSON.stringify(options)).not.toContain('hidden');
  });
});
