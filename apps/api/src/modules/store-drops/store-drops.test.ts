import { StoreDropDetail, StoreDropsOverview } from '@ite/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { minutes } from '../../../test/support/auth.ts';
import { sellableProduct } from '../../../test/support/cart.ts';
import {
  createCatalogHarness,
  problem,
  type CatalogHarness,
} from '../../../test/support/catalog.ts';

let c: CatalogHarness;
beforeAll(async () => {
  c = await createCatalogHarness();
});
afterAll(async () => c.close());

const store = (url: string) => c.h.app.inject({ method: 'GET', url: `/api/v1/store${url}` });
const overview = async () => StoreDropsOverview.parse(c.ok(await store('/drops')));
const at = (offsetMinutes: number) =>
  new Date(c.h.clock.now().getTime() + minutes(offsetMinutes)).toISOString();

async function drop(title: string, releaseAt: string, productIds: string[], publish = true) {
  const created = c.ok(
    await c.call('POST', '/drops', {
      collection: 'COLLECTION',
      title,
      releaseAt,
      image: { url: `/images/drops/${title}.jpg`, alt: title },
    }),
    201,
  ) as { id: string; slug: string };
  if (productIds.length) c.ok(await c.call('PUT', `/drops/${created.id}/products`, { productIds }));
  if (publish) c.ok(await c.call('POST', `/drops/${created.id}/publish`));
  return created;
}

describe('store-drops-api: Drops overview', () => {
  it('No drops yet', async () => {
    const res = await store('/drops');
    expect(res.headers['cache-control']).toBe('public, max-age=60');
    expect(await overview()).toEqual({ upcoming: [], current: null, archive: [] });
  });

  it('Drops overview', async () => {
    const product = async () => (await sellableProduct(c, `Overview ${Math.random()}`)).product.id;
    await drop('Last Month', at(-60 * 24 * 30), [await product()]);
    await drop('Last Week', at(-60 * 24 * 7), [await product()]);
    await drop('Next Week', at(60 * 24 * 7), [await product(), await product()]);
    await drop('Draft Tomorrow', at(60 * 24), [await product()], false);

    const { upcoming, current, archive } = await overview();
    expect(upcoming.map((d) => [d.title, d.status, d.productCount])).toEqual([
      ['Next Week', 'UPCOMING', 2],
    ]);
    expect(current).toMatchObject({ title: 'Last Week', status: 'LIVE' });
    expect(archive.map((d) => [d.title, d.status])).toEqual([['Last Month', 'PAST']]);
    expect(JSON.stringify({ upcoming, current, archive })).not.toContain('Draft Tomorrow');
  });
});

describe('store-drops-api: Drop detail', () => {
  it('Upcoming drop detail', async () => {
    const a = await sellableProduct(c, 'Detail A');
    const b = await sellableProduct(c, 'Detail B');
    const x = await sellableProduct(c, 'Detail C');
    const draft = await c.product({ name: 'Detail Draft' });
    const releaseAt = at(60 * 24);
    const d = await drop('Tomorrow Drop', releaseAt, [
      b.product.id,
      draft.id,
      x.product.id,
      a.product.id,
    ]);
    const res = await store(`/drops/${d.slug}`);
    expect(res.headers['cache-control']).toBe('public, max-age=60');
    const detail = StoreDropDetail.parse(c.ok(res));
    expect(detail).toMatchObject({ title: 'Tomorrow Drop', status: 'UPCOMING', productCount: 3 });
    expect(detail.products.map((p) => p.name)).toEqual(['Detail B', 'Detail C', 'Detail A']);
    for (const p of detail.products) expect(p.releaseAt).toBe(releaseAt);
  });

  it('Draft drop is not found', async () => {
    const d = await drop('Hidden Draft', at(60), [], false);
    const details = new Set<string>();
    for (const slug of [d.slug, 'no-such-drop']) {
      details.add(problem(await store(`/drops/${slug}`), 404, 'NOT_FOUND').detail);
    }
    expect(details.size).toBe(1);
  });
});
