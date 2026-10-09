import {
  StoreCart,
  StoreProductDetail,
  StoreProductListResponse,
  StoreCatalogFilters,
} from '@ite/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { minutes } from '../../../test/support/auth.ts';
import { cartClient, sellableProduct } from '../../../test/support/cart.ts';
import {
  createCatalogHarness,
  problem,
  type CatalogHarness,
} from '../../../test/support/catalog.ts';
import { checkoutClient } from '../../../test/support/checkout.ts';

let c: CatalogHarness;
let cart: ReturnType<typeof cartClient>;
beforeAll(async () => {
  c = await createCatalogHarness();
  cart = cartClient(c);
});
afterAll(async () => c.close());

const store = (url: string) => c.h.app.inject({ method: 'GET', url: `/api/v1/store${url}` });
/** A drop releasing `inMinutes` from the harness clock, holding `productIds`, optionally published. */
async function dropWith(
  productIds: string[],
  { inMinutes = 10, publish = true, title = 'Release Drop' } = {},
) {
  const releaseAt = new Date(c.h.clock.now().getTime() + minutes(inMinutes)).toISOString();
  const created = c.ok(
    await c.call('POST', '/drops', {
      collection: 'COLLECTION 009',
      title,
      releaseAt,
      image: { url: '/images/drops/release.jpg', alt: 'Release' },
    }),
    201,
  ) as { id: string };
  c.ok(await c.call('PUT', `/drops/${created.id}/products`, { productIds }));
  if (publish) c.ok(await c.call('POST', `/drops/${created.id}/publish`));
  return { id: created.id, releaseAt };
}
const listSlugs = async (query: string) =>
  StoreProductListResponse.parse(c.ok(await store(`/products${query}`))).data.map((p) => p.slug);

describe('drops-management: Release gating', () => {
  it('Release at the release time', async () => {
    const p = await sellableProduct(c, 'Gate Tee', [{ stockQuantity: 5 }]);
    await dropWith([p.product.id], { title: 'Gate Drop' });
    const { token } = await cart.create();
    problem(await cart.add(token, p.variants[0]!.key), 409, 'NOT_RELEASED');
    c.h.clock.advance(minutes(11));
    expect((await cart.added(token, p.variants[0]!.key)).lines).toHaveLength(1);
  });
});

describe('store-catalog-api: Active products only (drops)', () => {
  it('Unreleased products stay out of the shop', async () => {
    const category = await c.h.db.category.create({ data: { name: 'Gate Cat', slug: 'gate-cat' } });
    const published = await sellableProduct(c, 'Gate Published', [{ stockQuantity: 5 }]);
    const draft = await sellableProduct(c, 'Gate Draft Drop', [{ stockQuantity: 5 }]);
    for (const p of [published, draft]) {
      c.ok(await c.call('PATCH', `/products/${p.product.id}`, { categoryId: category.id }));
    }
    const { releaseAt } = await dropWith([published.product.id], { title: 'Gate Published Drop' });
    await dropWith([draft.product.id], { title: 'Gate Draft', publish: false });

    expect(await listSlugs('?category=gate-cat')).toEqual([]);
    expect(await listSlugs('?q=gate%20published')).toEqual([]);
    const filters = StoreCatalogFilters.parse(c.ok(await store('/catalog/filters')));
    expect(filters.categories.map((x) => x.slug)).not.toContain('gate-cat');

    const detail = StoreProductDetail.parse(
      c.ok(await store(`/products/${published.product.slug}`)),
    );
    expect(detail.releaseAt).toBe(releaseAt);
    problem(await store(`/products/${draft.product.slug}`), 404, 'NOT_FOUND');

    c.h.clock.advance(minutes(11));
    expect((await listSlugs('?category=gate-cat')).sort()).toEqual(
      [published.product.slug, draft.product.slug].sort(),
    );
  });

  it('Release time in the detail', async () => {
    const inDrop = await sellableProduct(c, 'Detail Drop Tee', [{ stockQuantity: 5 }]);
    const plain = await sellableProduct(c, 'Detail Plain Tee', [{ stockQuantity: 5 }]);
    const { releaseAt } = await dropWith([inDrop.product.id], { title: 'Detail Drop' });
    const a = StoreProductDetail.parse(c.ok(await store(`/products/${inDrop.product.slug}`)));
    expect(a.releaseAt).toBe(releaseAt);
    expect(a.drop).toEqual({ slug: 'detail-drop', title: 'Detail Drop' });
    const b = StoreProductDetail.parse(c.ok(await store(`/products/${plain.product.slug}`)));
    expect(b.releaseAt).toBeNull();
    expect(b.drop).toBeNull();
  });
});

describe('store-cart-api: Add to cart (drops)', () => {
  it('Unreleased product cannot be added', async () => {
    const p = await sellableProduct(c, 'Cart Gate Tee', [{ stockQuantity: 5 }]);
    await dropWith([p.product.id], { title: 'Cart Gate', publish: false });
    const { token } = await cart.create();
    problem(await cart.add(token, p.variants[0]!.key), 409, 'NOT_RELEASED');
    expect((await cart.get(token)).lines).toEqual([]);
    c.h.clock.advance(minutes(11));
    expect((await cart.added(token, p.variants[0]!.key)).itemCount).toBe(1);
  });
});

describe('store-cart-api: Cart view (drops)', () => {
  it('Line that became unreleased', async () => {
    const p = await sellableProduct(c, 'Cart Later Tee', [{ stockQuantity: 5 }]);
    const { token } = await cart.create();
    await cart.added(token, p.variants[0]!.key);
    await dropWith([p.product.id], { title: 'Cart Later' });
    const view = StoreCart.parse(await cart.get(token));
    expect(view.lines[0]!.status).toBe('UNAVAILABLE');
    expect(view.itemCount).toBe(0);
    expect(view.subtotal.amount).toBe(0);

    // And it cannot be ordered: checkout refuses the cart.
    const checkout = checkoutClient(c);
    const summary = await checkout.summary(token);
    expect(summary.ready).toBe(false);
    problem(await checkout.placeResponse(token, summary.total), 409, 'CART_CHANGED');
  });
});
