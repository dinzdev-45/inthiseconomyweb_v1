import { ProductDetail, ProductImage, ProductImageListResponse } from '@ite/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { minutes } from '../../../../test/support/auth.ts';
import {
  createCatalogHarness,
  problem,
  UNKNOWN_ID,
  type CatalogHarness,
} from '../../../../test/support/catalog.ts';

let c: CatalogHarness;
beforeAll(async () => {
  c = await createCatalogHarness();
});
afterAll(async () => c.close());

const imagesUrl = (productId: string) => `/products/${productId}/images`;
const imageUrl = (productId: string, imageId: string) => `/products/${productId}/images/${imageId}`;
let counter = 0;

async function addImage(productId: string, overrides: object = {}, cookie?: string) {
  const res = await c.call(
    'POST',
    imagesUrl(productId),
    { url: `/images/p/${++counter}.jpg`, alt: `Image ${counter}`, ...overrides },
    cookie,
  );
  return ProductImage.parse(c.ok(res, 201));
}

/** The product's images as stored, in display order. */
const stored = (productId: string) =>
  c.h.db.productImage.findMany({
    where: { productId },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });
const primaries = async (productId: string) =>
  (await stored(productId)).filter((image) => image.isPrimary).map((image) => image.id);

/** A product made ACTIVE through the API: one variant, images added through the image API. */
async function activeProduct(imageCount = 1) {
  const product = await c.product();
  await c.variant(product.id);
  const added = [];
  for (let n = 0; n < imageCount; n++) added.push(await addImage(product.id));
  await c.activate(product.id);
  return { product, images: added };
}

describe('product-management: Product images', () => {
  it('Draft product without images', async () => {
    const product = await c.product();
    const detail = ProductDetail.parse(c.ok(await c.call('GET', `/products/${product.id}`)));
    expect(detail).toMatchObject({ status: 'DRAFT', images: [] });
  });

  it('First image becomes primary', async () => {
    const product = await c.product();
    // Even when the request says otherwise: the first image is always primary.
    const first = await addImage(product.id, { isPrimary: false });
    expect(first).toMatchObject({ isPrimary: true, sortOrder: 0, createdBy: c.owner.id });
  });

  it('adds later images at the end without a second primary', async () => {
    const product = await c.product();
    const first = await addImage(product.id);
    const second = await addImage(product.id);
    const third = await addImage(product.id, { alt: 'Detail shot' });
    expect([second, third].map((i) => [i.sortOrder, i.isPrimary])).toEqual([
      [1, false],
      [2, false],
    ]);
    expect(await primaries(product.id)).toEqual([first.id]);

    const detail = ProductDetail.parse(c.ok(await c.call('GET', `/products/${product.id}`)));
    expect(detail.images.map((i) => i.id)).toEqual([first.id, second.id, third.id]);
  });

  it('adds a new image as primary when asked, moving the primary', async () => {
    const product = await c.product();
    const first = await addImage(product.id);
    const second = await addImage(product.id, { isPrimary: true });
    expect(second.isPrimary).toBe(true);
    expect(await primaries(product.id)).toEqual([second.id]);
    expect((await stored(product.id)).find((i) => i.id === first.id)?.isPrimary).toBe(false);
  });

  it('Switch primary image', async () => {
    const product = await c.product();
    const first = await addImage(product.id);
    const second = await addImage(product.id);
    c.h.clock.advance(minutes(1));

    const res = await c.call(
      'PATCH',
      imageUrl(product.id, second.id),
      { isPrimary: true },
      c.adminCookie,
    );
    expect(ProductImage.parse(c.ok(res))).toMatchObject({
      id: second.id,
      isPrimary: true,
      updatedBy: c.admin.id,
      createdBy: c.owner.id,
    });
    expect(await primaries(product.id)).toEqual([second.id]);
    // The previous primary was changed too, so it records who changed it.
    const previous = (await stored(product.id)).find((i) => i.id === first.id)!;
    expect(previous).toMatchObject({ isPrimary: false, updatedById: c.admin.id });

    // Marking the current primary again is a no-op success.
    c.ok(await c.call('PATCH', imageUrl(product.id, second.id), { isPrimary: true }));
    expect(await primaries(product.id)).toEqual([second.id]);
    // isPrimary: false is not accepted (the primary only moves by marking another image).
    problem(
      await c.call('PATCH', imageUrl(product.id, second.id), { isPrimary: false }),
      400,
      'VALIDATION_FAILED',
    );
  });

  it('Switch primary image (concurrent switches leave exactly one primary)', async () => {
    for (let round = 0; round < 8; round++) {
      const product = await c.product();
      const images = [
        await addImage(product.id),
        await addImage(product.id),
        await addImage(product.id),
      ];
      const results = await Promise.all(
        images
          .slice(1)
          .map((image) => c.call('PATCH', imageUrl(product.id, image.id), { isPrimary: true })),
      );
      expect(
        results.map((res) => res.statusCode),
        `round ${round}`,
      ).toEqual([200, 200]);
      const primary = await primaries(product.id);
      expect(primary, `round ${round}`).toHaveLength(1);
      expect([images[1]!.id, images[2]!.id]).toContain(primary[0]);
    }
  });

  it('updates url, alt text, and variant, and clears the variant with null', async () => {
    const product = await c.product();
    const variant = await c.variant(product.id);
    const image = await addImage(product.id, { variantId: variant.id });
    expect(image.variantId).toBe(variant.id);
    const updated = ProductImage.parse(
      c.ok(
        await c.call('PATCH', imageUrl(product.id, image.id), {
          url: 'https://cdn.example.com/a.jpg',
          alt: 'Front, washed black',
          variantId: null,
        }),
      ),
    );
    expect(updated).toMatchObject({
      url: 'https://cdn.example.com/a.jpg',
      alt: 'Front, washed black',
      variantId: null,
      isPrimary: true,
    });
  });

  it('validates image metadata', async () => {
    const product = await c.product();
    for (const body of [
      { url: 'http://insecure.example.com/a.jpg', alt: 'x' },
      { url: '//cdn.example.com/a.jpg', alt: 'x' },
      { url: 'images/relative.jpg', alt: 'x' },
      { url: '/a.jpg', alt: '' },
      { url: '/a.jpg', alt: 'x'.repeat(301) },
      { url: '/a.jpg' },
      { url: '/a.jpg', alt: 'x', sortOrder: 3 },
    ]) {
      problem(await c.call('POST', imagesUrl(product.id), body), 400, 'VALIDATION_FAILED');
    }
    expect(await stored(product.id)).toEqual([]);
    const image = await addImage(product.id);
    problem(await c.call('PATCH', imageUrl(product.id, image.id), {}), 400, 'VALIDATION_FAILED');
  });

  it("Image for another product's variant", async () => {
    const product = await c.product();
    const other = await c.product();
    const foreign = await c.variant(other.id);
    problem(
      await c.call('POST', imagesUrl(product.id), {
        url: '/x.jpg',
        alt: 'x',
        variantId: foreign.id,
      }),
      422,
      'VARIANT_MISMATCH',
    );
    const image = await addImage(product.id);
    problem(
      await c.call('PATCH', imageUrl(product.id, image.id), { variantId: foreign.id }),
      422,
      'VARIANT_MISMATCH',
    );
    problem(
      await c.call('POST', imagesUrl(product.id), {
        url: '/y.jpg',
        alt: 'y',
        variantId: UNKNOWN_ID,
      }),
      422,
      'UNKNOWN_REFERENCE',
    );
    expect(await stored(product.id)).toHaveLength(1);
  });

  it('Image limit', async () => {
    const product = await c.product();
    for (let n = 0; n < 20; n++) await addImage(product.id);
    problem(
      await c.call('POST', imagesUrl(product.id), { url: '/21.jpg', alt: '21st' }),
      409,
      'IMAGE_LIMIT',
    );
    expect(await stored(product.id)).toHaveLength(20);
  });

  it('returns 404 for unknown products and images, and images of another product', async () => {
    const product = await c.product();
    const other = await c.product();
    const image = await addImage(other.id);
    problem(
      await c.call('POST', imagesUrl(UNKNOWN_ID), { url: '/a.jpg', alt: 'a' }),
      404,
      'NOT_FOUND',
    );
    problem(await c.call('PATCH', imageUrl(product.id, image.id), { alt: 'x' }), 404, 'NOT_FOUND');
    problem(await c.call('DELETE', imageUrl(product.id, image.id)), 404, 'NOT_FOUND');
    problem(await c.call('DELETE', imageUrl(product.id, UNKNOWN_ID)), 404, 'NOT_FOUND');
    expect(await stored(other.id)).toHaveLength(1);
  });

  it('keeps images of archived products read-only', async () => {
    const product = await c.product();
    const image = await addImage(product.id);
    c.ok(await c.call('POST', `/products/${product.id}/archive`));
    problem(
      await c.call('POST', imagesUrl(product.id), { url: '/a.jpg', alt: 'a' }),
      409,
      'INVALID_STATE_TRANSITION',
    );
    problem(
      await c.call('PATCH', imageUrl(product.id, image.id), { alt: 'x' }),
      409,
      'INVALID_STATE_TRANSITION',
    );
    problem(
      await c.call('DELETE', imageUrl(product.id, image.id)),
      409,
      'INVALID_STATE_TRANSITION',
    );
    problem(
      await c.call('PUT', `${imagesUrl(product.id)}/order`, { imageIds: [image.id] }),
      409,
      'INVALID_STATE_TRANSITION',
    );
    expect(await stored(product.id)).toHaveLength(1);
  });
});

describe('product-management: Deleting images', () => {
  it('deletes a non-primary image and keeps the primary', async () => {
    const product = await c.product();
    const first = await addImage(product.id);
    const second = await addImage(product.id);
    const res = await c.call('DELETE', imageUrl(product.id, second.id));
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
    expect((await stored(product.id)).map((i) => i.id)).toEqual([first.id]);
    expect(await primaries(product.id)).toEqual([first.id]);
  });

  it('Delete primary image promotes next', async () => {
    const product = await c.product();
    const images = [
      await addImage(product.id),
      await addImage(product.id),
      await addImage(product.id),
    ];
    // Reorder so the lowest remaining sortOrder is not simply the next one created.
    c.ok(
      await c.call('PUT', `${imagesUrl(product.id)}/order`, {
        imageIds: [images[0]!.id, images[2]!.id, images[1]!.id],
      }),
    );
    c.h.clock.advance(minutes(1));
    expect(
      (await c.call('DELETE', imageUrl(product.id, images[0]!.id), undefined, c.adminCookie))
        .statusCode,
    ).toBe(204);
    expect(await primaries(product.id)).toEqual([images[2]!.id]);
    const promoted = (await stored(product.id)).find((i) => i.id === images[2]!.id)!;
    expect(promoted.updatedById).toBe(c.admin.id);
  });

  it('deleting the only image of a draft leaves no images', async () => {
    const product = await c.product();
    const image = await addImage(product.id);
    expect((await c.call('DELETE', imageUrl(product.id, image.id))).statusCode).toBe(204);
    expect(await stored(product.id)).toEqual([]);
    // The next image added becomes primary again.
    expect((await addImage(product.id)).isPrimary).toBe(true);
  });

  it('Delete last image of active product rejected', async () => {
    const { product, images } = await activeProduct(1);
    const only = images[0]!;
    problem(await c.call('DELETE', imageUrl(product.id, only.id)), 409, 'LAST_IMAGE');
    expect((await stored(product.id)).map((i) => i.id)).toEqual([only.id]);

    c.ok(await c.call('POST', `/products/${product.id}/deactivate`));
    expect((await c.call('DELETE', imageUrl(product.id, only.id))).statusCode).toBe(204);
    expect(await stored(product.id)).toEqual([]);
    // It cannot be activated again until it has an image.
    problem(await c.call('POST', `/products/${product.id}/activate`), 409, 'PRODUCT_NOT_READY');
  });

  it('lets an ACTIVE product delete images while one remains, keeping a primary', async () => {
    const { product, images } = await activeProduct(2);
    expect((await c.call('DELETE', imageUrl(product.id, images[0]!.id))).statusCode).toBe(204);
    expect(await primaries(product.id)).toEqual([images[1]!.id]);
    problem(await c.call('DELETE', imageUrl(product.id, images[1]!.id)), 409, 'LAST_IMAGE');
  });
});

describe('product-management: Reordering images', () => {
  it('Reorder images', async () => {
    const product = await c.product();
    const [a, b, c3] = [
      await addImage(product.id),
      await addImage(product.id),
      await addImage(product.id),
    ];
    c.h.clock.advance(minutes(1));

    const res = await c.call(
      'PUT',
      `${imagesUrl(product.id)}/order`,
      { imageIds: [c3.id, a.id, b.id] },
      c.adminCookie,
    );
    const body = ProductImageListResponse.parse(c.ok(res));
    expect(body.data.map((i) => [i.id, i.sortOrder])).toEqual([
      [c3.id, 0],
      [a.id, 1],
      [b.id, 2],
    ]);
    expect(body.data.every((i) => i.updatedBy === c.admin.id)).toBe(true);
    // Reordering does not move the primary.
    expect(await primaries(product.id)).toEqual([a.id]);
    const detail = ProductDetail.parse(c.ok(await c.call('GET', `/products/${product.id}`)));
    expect(detail.images.map((i) => i.id)).toEqual([c3.id, a.id, b.id]);

    const before = (await stored(product.id)).map((i) => [i.id, i.sortOrder]);
    const foreign = await addImage((await c.product()).id);
    for (const imageIds of [
      [c3.id, a.id], // omits one
      [c3.id, a.id, b.id, foreign.id], // adds another product's image
      [c3.id, a.id, UNKNOWN_ID], // replaces one with an unknown id
    ]) {
      problem(
        await c.call('PUT', `${imagesUrl(product.id)}/order`, { imageIds }),
        400,
        'VALIDATION_FAILED',
      );
    }
    // Repeats an id (rejected by the contract).
    problem(
      await c.call('PUT', `${imagesUrl(product.id)}/order`, { imageIds: [c3.id, a.id, a.id] }),
      400,
      'VALIDATION_FAILED',
    );
    problem(
      await c.call('PUT', `${imagesUrl(product.id)}/order`, { imageIds: [] }),
      400,
      'VALIDATION_FAILED',
    );
    expect((await stored(product.id)).map((i) => [i.id, i.sortOrder])).toEqual(before);
  });

  it('places new images after a reorder at the end', async () => {
    const product = await c.product();
    const [a, b] = [await addImage(product.id), await addImage(product.id)];
    c.ok(await c.call('PUT', `${imagesUrl(product.id)}/order`, { imageIds: [b.id, a.id] }));
    const next = await addImage(product.id);
    expect(next.sortOrder).toBe(2);
  });
});

describe('product-management: image concurrency', () => {
  it('first images added concurrently: exactly one primary, distinct sort orders', async () => {
    for (let round = 0; round < 8; round++) {
      const product = await c.product();
      const results = await Promise.all(
        Array.from({ length: 3 }, (_, n) =>
          c.call('POST', imagesUrl(product.id), { url: `/race/${round}/${n}.jpg`, alt: 'Race' }),
        ),
      );
      expect(results.map((res) => res.statusCode)).toEqual([201, 201, 201]);
      const images = await stored(product.id);
      expect(
        images.filter((i) => i.isPrimary),
        `round ${round}`,
      ).toHaveLength(1);
      expect(new Set(images.map((i) => i.sortOrder)).size).toBe(3);
    }
  });

  it('concurrent deletes on an ACTIVE product never remove its last image', async () => {
    for (let round = 0; round < 8; round++) {
      const { product, images } = await activeProduct(2);
      const results = await Promise.all(
        images.map((image) => c.call('DELETE', imageUrl(product.id, image.id))),
      );
      expect(results.map((res) => res.statusCode).sort(), `round ${round}`).toEqual([204, 409]);
      const remaining = await stored(product.id);
      expect(remaining).toHaveLength(1);
      expect(remaining[0]!.isPrimary).toBe(true);
    }
  });

  it('deleting the primary while switching it still leaves exactly one primary', async () => {
    for (let round = 0; round < 8; round++) {
      const product = await c.product();
      const [first, second, third] = [
        await addImage(product.id),
        await addImage(product.id),
        await addImage(product.id),
      ];
      await Promise.all([
        c.call('DELETE', imageUrl(product.id, first.id)),
        c.call('PATCH', imageUrl(product.id, third.id), { isPrimary: true }),
        c.call('PUT', `${imagesUrl(product.id)}/order`, {
          imageIds: [third.id, second.id, first.id],
        }),
      ]);
      const images = await stored(product.id);
      expect(
        images.filter((i) => i.isPrimary),
        `round ${round}`,
      ).toHaveLength(1);
      expect(images.map((i) => i.id)).not.toContain(first.id);
    }
  });

  it('never leaves an ACTIVE product without images (activate vs. delete last image)', async () => {
    for (let round = 0; round < 8; round++) {
      const product = await c.product();
      await c.variant(product.id);
      const image = await addImage(product.id);
      const [activation, deletion] = await Promise.all([
        c.call('POST', `/products/${product.id}/activate`),
        c.call('DELETE', imageUrl(product.id, image.id)),
      ]);
      const status = (await c.h.db.product.findUniqueOrThrow({ where: { id: product.id } })).status;
      const count = (await stored(product.id)).length;
      if (status === 'ACTIVE') expect(count, `round ${round}`).toBe(1);
      expect([`${activation.statusCode}/${deletion.statusCode}`]).toEqual([
        expect.stringMatching(/^(200\/409|409\/204)$/),
      ]);
    }
  });
});
