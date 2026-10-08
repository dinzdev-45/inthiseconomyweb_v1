import { StoreProductDetail } from '@ite/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createCatalogHarness, idr, type CatalogHarness } from '../../../test/support/catalog.ts';

let c: CatalogHarness;
let sizes: Record<'S' | 'M' | 'L', { id: string }>;
let colors: Record<'black' | 'white' | 'red', { id: string }>;
beforeAll(async () => {
  c = await createCatalogHarness();
  sizes = { S: await c.size('S'), M: await c.size('M'), L: await c.size('L') };
  // Display order S, M, L (not alphabetical).
  for (const [code, sortOrder] of [
    ['S', 10],
    ['M', 20],
    ['L', 30],
  ] as const) {
    await c.h.db.size.update({ where: { id: sizes[code].id }, data: { sortOrder } });
  }
  colors = {
    black: await c.color('black'),
    white: await c.color('white'),
    red: await c.color('red'),
  };
});
afterAll(async () => c.close());

const detail = async (slug: string) =>
  StoreProductDetail.parse(
    c.ok(await c.h.app.inject({ method: 'GET', url: `/api/v1/store/products/${slug}` })),
  );
const variant = (
  productId: string,
  size: 'S' | 'M' | 'L',
  color: 'black' | 'white' | 'red',
  extra = {},
) => c.variant(productId, { sizeId: sizes[size].id, colorId: colors[color].id, ...extra });
const image = (productId: string, sortOrder: number, variantId: string | null, isPrimary = false) =>
  c.h.db.productImage.create({
    data: {
      productId,
      url: `/images/${productId}/${sortOrder}.jpg`,
      alt: `Image ${sortOrder}`,
      sortOrder,
      isPrimary,
      variantId,
    },
  });

describe('store-catalog-api: Product detail', () => {
  it('Product detail fields', async () => {
    const product = await c.product({ name: 'Detail Hoodie', description: 'Heavyweight fleece.' });
    await variant(product.id, 'M', 'black', { stockQuantity: 4 });
    await image(product.id, 0, null, true);
    await c.activate(product.id);

    const res = await c.h.app.inject({
      method: 'GET',
      url: `/api/v1/store/products/${product.slug}`,
    });
    const body = c.ok(res) as Record<string, unknown>;
    expect(StoreProductDetail.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({ slug: product.slug, description: 'Heavyweight fleece.' });
    const text = JSON.stringify(body);
    for (const field of [
      '"id"',
      'sku',
      'stockQuantity',
      'createdAt',
      'updatedAt',
      'createdBy',
      'activatedAt',
      'variantId',
      'isPrimary',
      'sortOrder',
    ]) {
      expect(text).not.toContain(field);
    }
    expect(text).not.toContain('"4"');

    const plain = await c.product({ name: 'Detail Plain' });
    await variant(plain.id, 'S', 'white');
    await image(plain.id, 0, null, true);
    await c.activate(plain.id);
    expect((await detail(plain.slug)).description).toBeNull();
  });

  it('Variants in the detail', async () => {
    const product = await c.product({ name: 'Detail Variants', basePrice: idr(89_900_000) });
    const inactive = await variant(product.id, 'S', 'black', { stockQuantity: 9 });
    await variant(product.id, 'L', 'black', { stockQuantity: 0, priceOverride: idr(94_900_000) });
    await variant(product.id, 'M', 'white', { stockQuantity: 2 });
    await variant(product.id, 'M', 'black', { stockQuantity: 3 });
    await image(product.id, 0, null, true);
    await c.activate(product.id);
    c.ok(await c.call('POST', `/products/${product.id}/variants/${inactive.id}/deactivate`));

    expect((await detail(product.slug)).variants).toEqual([
      {
        size: { code: 'M', label: 'M' },
        color: { slug: 'black', name: 'black', hex: null },
        price: idr(89_900_000),
        availability: 'IN_STOCK',
      },
      {
        size: { code: 'M', label: 'M' },
        color: { slug: 'white', name: 'white', hex: null },
        price: idr(89_900_000),
        availability: 'IN_STOCK',
      },
      {
        size: { code: 'L', label: 'L' },
        color: { slug: 'black', name: 'black', hex: null },
        price: idr(94_900_000),
        availability: 'SOLD_OUT',
      },
    ]);
  });

  it('Gallery images tagged by color', async () => {
    const product = await c.product({ name: 'Detail Gallery' });
    const black = await variant(product.id, 'M', 'black');
    const red = await variant(product.id, 'S', 'red');
    // A second black variant that is later deactivated: its images keep the black tag.
    const oldBlack = await variant(product.id, 'L', 'black');
    await image(product.id, 0, black.id, true);
    await image(product.id, 1, red.id);
    await image(product.id, 2, null);
    await image(product.id, 3, oldBlack.id);
    await c.activate(product.id);
    for (const v of [red, oldBlack]) {
      c.ok(await c.call('POST', `/products/${product.id}/variants/${v.id}/deactivate`));
    }

    const { images } = await detail(product.slug);
    expect(images).toEqual([
      { url: `/images/${product.id}/0.jpg`, alt: 'Image 0', color: 'black' },
      { url: `/images/${product.id}/2.jpg`, alt: 'Image 2', color: null },
      { url: `/images/${product.id}/3.jpg`, alt: 'Image 3', color: 'black' },
    ]);
    // The red image is gone: no active variant is red.
    expect(JSON.stringify(images)).not.toContain('/1.jpg');
  });
});
