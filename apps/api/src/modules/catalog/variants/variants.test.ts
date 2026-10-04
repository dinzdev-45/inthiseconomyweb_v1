import { ProductDetail, ProductVariant, StockAdjustmentResult } from '@ite/contracts';
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

const variantsUrl = (productId: string) => `/products/${productId}/variants`;
const variantUrl = (productId: string, variantId: string) =>
  `/products/${productId}/variants/${variantId}`;
const adjust = (productId: string, variantId: string, delta: number, cookie?: string) =>
  c.call('POST', `${variantUrl(productId, variantId)}/stock-adjustments`, { delta }, cookie);
const stockOf = async (variantId: string) =>
  (await c.h.db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stockQuantity;

describe('product-variants-inventory: Variants', () => {
  it('Add variant', async () => {
    const product = await c.product({ name: 'Overdraft Hoodie' });
    const m = await c.size('M');
    const washedBlack = await c.color('washed-black');

    const res = await c.call('POST', variantsUrl(product.id), {
      sizeId: m.id,
      colorId: washedBlack.id,
      sku: 'ITE-OH-WB-M',
      stockQuantity: 12,
    });
    expect(res.statusCode).toBe(201);
    expect(ProductVariant.parse(res.json())).toMatchObject({
      sku: 'ITE-OH-WB-M',
      size: { id: m.id, code: 'M' },
      color: { id: washedBlack.id, slug: 'washed-black' },
      status: 'ACTIVE',
      priceOverride: null,
      effectivePrice: product.basePrice,
      stockQuantity: 12,
      createdBy: c.owner.id,
      updatedBy: c.owner.id,
    });
    // The product detail lists it.
    const detail = ProductDetail.parse(c.ok(await c.call('GET', `/products/${product.id}`)));
    expect(detail.variants.map((v) => v.sku)).toEqual(['ITE-OH-WB-M']);
  });

  it('defaults initial stock to 0', async () => {
    const product = await c.product();
    const variant = await c.variant(product.id);
    expect(variant.stockQuantity).toBe(0);
  });

  it('Duplicate size and color', async () => {
    const product = await c.product();
    const [size, color] = [await c.size(), await c.color()];
    const first = ProductVariant.parse(
      c.ok(
        await c.call('POST', variantsUrl(product.id), {
          sizeId: size.id,
          colorId: color.id,
          sku: 'DUP-COMBO-1',
        }),
        201,
      ),
    );
    const payload = { sizeId: size.id, colorId: color.id, sku: 'DUP-COMBO-2' };
    problem(await c.call('POST', variantsUrl(product.id), payload), 409, 'VARIANT_EXISTS');

    // Also when the existing one is inactive.
    c.ok(await c.call('POST', `${variantUrl(product.id, first.id)}/deactivate`));
    problem(await c.call('POST', variantsUrl(product.id), payload), 409, 'VARIANT_EXISTS');

    // And when an update moves another variant onto the same combination.
    const other = await c.variant(product.id);
    problem(
      await c.call('PATCH', variantUrl(product.id, other.id), {
        sizeId: size.id,
        colorId: color.id,
      }),
      409,
      'VARIANT_EXISTS',
    );
    expect(await c.h.db.productVariant.count({ where: { productId: product.id } })).toBe(2);
  });

  it('Same size and color on different products', async () => {
    const [m, black] = [await c.size('MM'), await c.color('black')];
    for (const sku of ['SAME-1-M', 'SAME-2-M']) {
      const product = await c.product();
      const res = await c.call('POST', variantsUrl(product.id), {
        sizeId: m.id,
        colorId: black.id,
        sku,
      });
      expect(res.statusCode).toBe(201);
    }
  });

  it('Price override', async () => {
    const product = await c.product({ basePrice: idr(89_900_000) });
    const variant = await c.variant(product.id, { priceOverride: idr(94_900_000) });
    expect(variant.priceOverride).toEqual(idr(94_900_000));
    expect(variant.effectivePrice).toEqual(idr(94_900_000));

    const cleared = ProductVariant.parse(
      c.ok(await c.call('PATCH', variantUrl(product.id, variant.id), { priceOverride: null })),
    );
    expect(cleared.priceOverride).toBeNull();
    expect(cleared.effectivePrice).toEqual(idr(89_900_000));
  });

  it('enforces the store currency and price limits on overrides', async () => {
    const product = await c.product();
    const [size, color] = [await c.size(), await c.color()];
    const base = { sizeId: size.id, colorId: color.id, sku: 'OVERRIDE-RULES' };
    problem(
      await c.call('POST', variantsUrl(product.id), {
        ...base,
        priceOverride: { amount: 100, currency: 'USD' },
      }),
      422,
      'CURRENCY_MISMATCH',
    );
    for (const amount of [-1, 2_000_000_001, 1.5]) {
      const body = problem(
        await c.call('POST', variantsUrl(product.id), { ...base, priceOverride: idr(amount) }),
        400,
        'VALIDATION_FAILED',
      );
      expect(body.errors?.map((e) => e.path)).toEqual(['priceOverride.amount']);
    }
    const variant = await c.variant(product.id, { priceOverride: idr(0) });
    expect(variant.effectivePrice).toEqual(idr(0));
    problem(
      await c.call('PATCH', variantUrl(product.id, variant.id), {
        priceOverride: { amount: 1, currency: 'EUR' },
      }),
      422,
      'CURRENCY_MISMATCH',
    );
  });

  it('Unknown size or color', async () => {
    const product = await c.product();
    const [size, color] = [await c.size(), await c.color()];
    problem(
      await c.call('POST', variantsUrl(product.id), {
        sizeId: UNKNOWN_ID,
        colorId: color.id,
        sku: 'UNK-1',
      }),
      422,
      'UNKNOWN_REFERENCE',
    );
    problem(
      await c.call('POST', variantsUrl(product.id), {
        sizeId: size.id,
        colorId: UNKNOWN_ID,
        sku: 'UNK-2',
      }),
      422,
      'UNKNOWN_REFERENCE',
    );
    const variant = await c.variant(product.id);
    problem(
      await c.call('PATCH', variantUrl(product.id, variant.id), { colorId: UNKNOWN_ID }),
      422,
      'UNKNOWN_REFERENCE',
    );
  });

  it('rejects variants on unknown or archived products, and variants of another product', async () => {
    const [size, color] = [await c.size(), await c.color()];
    const payload = { sizeId: size.id, colorId: color.id, sku: 'NOWHERE-1' };
    problem(await c.call('POST', variantsUrl(UNKNOWN_ID), payload), 404, 'NOT_FOUND');

    const archived = await c.product();
    c.ok(await c.call('POST', `/products/${archived.id}/archive`));
    problem(
      await c.call('POST', variantsUrl(archived.id), payload),
      409,
      'INVALID_STATE_TRANSITION',
    );

    const owner = await c.product();
    const other = await c.product();
    const variant = await c.variant(owner.id);
    problem(
      await c.call('PATCH', variantUrl(other.id, variant.id), { priceOverride: null }),
      404,
      'NOT_FOUND',
    );
    problem(
      await c.call('POST', `${variantUrl(other.id, variant.id)}/deactivate`),
      404,
      'NOT_FOUND',
    );
    problem(await adjust(other.id, variant.id, 1), 404, 'NOT_FOUND');
    problem(
      await c.call('PATCH', variantUrl(owner.id, UNKNOWN_ID), { priceOverride: null }),
      404,
      'NOT_FOUND',
    );
  });

  it('updates a variant with attribution and never touches stock', async () => {
    const product = await c.product();
    const variant = await c.variant(product.id, { stockQuantity: 4 });
    c.h.clock.advance(minutes(5));
    const updated = ProductVariant.parse(
      c.ok(
        await c.call(
          'PATCH',
          variantUrl(product.id, variant.id),
          { sku: 'renamed-sku-1', priceOverride: idr(1000) },
          c.adminCookie,
        ),
      ),
    );
    expect(updated).toEqual({
      ...variant,
      sku: 'RENAMED-SKU-1',
      priceOverride: idr(1000),
      effectivePrice: idr(1000),
      updatedBy: c.admin.id,
      updatedAt: c.h.clock.now().toISOString(),
    });
    problem(
      await c.call('PATCH', variantUrl(product.id, variant.id), { stockQuantity: 99 }),
      400,
      'VALIDATION_FAILED',
    );
    problem(
      await c.call('PATCH', variantUrl(product.id, variant.id), {}),
      400,
      'VALIDATION_FAILED',
    );
    expect(await stockOf(variant.id)).toBe(4);
  });
});

describe('product-variants-inventory: SKUs', () => {
  it('Duplicate SKU', async () => {
    const first = await c.product();
    await c.variant(first.id, { sku: 'ITE-OH-WB-M2' });
    const second = await c.product();
    const [size, color] = [await c.size(), await c.color()];
    problem(
      await c.call('POST', variantsUrl(second.id), {
        sizeId: size.id,
        colorId: color.id,
        sku: 'ite-oh-wb-m2',
      }),
      409,
      'SKU_EXISTS',
    );
    const other = await c.variant(second.id);
    problem(
      await c.call('PATCH', variantUrl(second.id, other.id), { sku: ' Ite-Oh-Wb-M2 ' }),
      409,
      'SKU_EXISTS',
    );
  });

  it('Invalid SKU', async () => {
    const product = await c.product();
    const [size, color] = [await c.size(), await c.color()];
    for (const sku of ['ite oh/wb', '-LEADING', 'X', 'A'.repeat(65)]) {
      const body = problem(
        await c.call('POST', variantsUrl(product.id), { sizeId: size.id, colorId: color.id, sku }),
        400,
        'VALIDATION_FAILED',
      );
      expect(body.errors?.map((e) => e.path)).toEqual(['sku']);
    }
  });

  it('SKU locked after activation', async () => {
    const { product, variant } = await c.readyProduct();
    // Editable while never activated.
    const renamed = ProductVariant.parse(
      c.ok(await c.call('PATCH', variantUrl(product.id, variant.id), { sku: 'LOCK-ME-1' })),
    );
    await c.activate(product.id);
    c.ok(await c.call('POST', `/products/${product.id}/deactivate`));

    // Still locked while INACTIVE: activated before.
    problem(
      await c.call('PATCH', variantUrl(product.id, variant.id), { sku: 'LOCK-ME-2' }),
      409,
      'SKU_LOCKED',
    );
    expect((await c.h.db.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).sku).toBe(
      renamed.sku,
    );
    // The unchanged SKU (any case) and other fields are fine.
    c.ok(
      await c.call('PATCH', variantUrl(product.id, variant.id), {
        sku: 'lock-me-1',
        priceOverride: null,
      }),
    );
    // New variants of an activated product still choose their own SKU.
    await c.variant(product.id, { sku: 'LOCK-ME-NEW' });
  });
});

describe('product-variants-inventory: Variant status', () => {
  it('Deactivate last active variant rejected', async () => {
    const { product, variant } = await c.readyProduct();
    await c.activate(product.id);
    problem(
      await c.call('POST', `${variantUrl(product.id, variant.id)}/deactivate`),
      409,
      'LAST_ACTIVE_VARIANT',
    );
    expect(
      (await c.h.db.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).status,
    ).toBe('ACTIVE');
  });

  it('rejects making the last qualifying variant free while the product is ACTIVE', async () => {
    const { product, variant } = await c.readyProduct();
    const free = await c.variant(product.id, { priceOverride: idr(0) });
    await c.activate(product.id);

    // The only priced variant cannot become free, nor be deactivated (the free one does not count).
    problem(
      await c.call('PATCH', variantUrl(product.id, variant.id), { priceOverride: idr(0) }),
      409,
      'LAST_ACTIVE_VARIANT',
    );
    problem(
      await c.call('POST', `${variantUrl(product.id, variant.id)}/deactivate`),
      409,
      'LAST_ACTIVE_VARIANT',
    );
    // The free variant can go; a second priced one makes the first optional.
    c.ok(await c.call('POST', `${variantUrl(product.id, free.id)}/deactivate`));
    await c.variant(product.id, { priceOverride: idr(5000) });
    c.ok(await c.call('PATCH', variantUrl(product.id, variant.id), { priceOverride: idr(0) }));
    // With the base price at zero, only the 5000 override still qualifies, so it must stay.
    c.ok(await c.call('PATCH', `/products/${product.id}`, { basePrice: idr(0) }));
    const priced = (await c.h.db.productVariant.findFirstOrThrow({
      where: { productId: product.id, priceOverrideAmount: 5000 },
    }))!;
    problem(
      await c.call('POST', `${variantUrl(product.id, priced.id)}/deactivate`),
      409,
      'LAST_ACTIVE_VARIANT',
    );
  });

  it('Deactivate variant of inactive product', async () => {
    for (const setup of ['DRAFT', 'INACTIVE'] as const) {
      const { product, variant } = await c.readyProduct();
      if (setup === 'INACTIVE') {
        await c.activate(product.id);
        c.ok(await c.call('POST', `/products/${product.id}/deactivate`));
      }
      const res = await c.call('POST', `${variantUrl(product.id, variant.id)}/deactivate`);
      expect(ProductVariant.parse(c.ok(res)).status).toBe('INACTIVE');
    }
  });

  it('activates an inactive variant and rejects no-op status changes', async () => {
    const product = await c.product();
    const variant = await c.variant(product.id);
    problem(
      await c.call('POST', `${variantUrl(product.id, variant.id)}/activate`),
      409,
      'INVALID_STATE_TRANSITION',
    );
    c.h.clock.advance(minutes(1));
    const inactive = ProductVariant.parse(
      c.ok(
        await c.call(
          'POST',
          `${variantUrl(product.id, variant.id)}/deactivate`,
          undefined,
          c.adminCookie,
        ),
      ),
    );
    expect(inactive).toMatchObject({
      status: 'INACTIVE',
      updatedBy: c.admin.id,
      createdBy: c.owner.id,
    });
    problem(
      await c.call('POST', `${variantUrl(product.id, variant.id)}/deactivate`),
      409,
      'INVALID_STATE_TRANSITION',
    );
    const active = ProductVariant.parse(
      c.ok(await c.call('POST', `${variantUrl(product.id, variant.id)}/activate`)),
    );
    expect(active).toMatchObject({ status: 'ACTIVE', updatedBy: c.owner.id });
  });

  it('Concurrent activation and last-variant deactivation', async () => {
    const outcomes = new Set<string>();
    for (let round = 0; round < 10; round++) {
      const { product, variant } = await c.readyProduct();
      const [activation, deactivation] = await Promise.all([
        c.call('POST', `/products/${product.id}/activate`),
        c.call('POST', `${variantUrl(product.id, variant.id)}/deactivate`),
      ]);
      const finalProduct = await c.h.db.product.findUniqueOrThrow({ where: { id: product.id } });
      const activeVariants = await c.h.db.productVariant.count({
        where: { productId: product.id, status: 'ACTIVE' },
      });
      // Never an ACTIVE product without an ACTIVE variant.
      if (finalProduct.status === 'ACTIVE')
        expect(activeVariants, `round ${round}`).toBeGreaterThan(0);
      // Exactly one of the two orders happened.
      const pair = `${activation.statusCode}/${deactivation.statusCode}`;
      expect(['200/409', '409/200']).toContain(pair);
      outcomes.add(pair);
    }
    expect(outcomes.size).toBeGreaterThan(0);
  });
});

describe('product-variants-inventory: Non-negative stock', () => {
  it('Adjust stock', async () => {
    const product = await c.product();
    const variant = await c.variant(product.id, { stockQuantity: 12 });
    expect(StockAdjustmentResult.parse(c.ok(await adjust(product.id, variant.id, -3)))).toEqual({
      variantId: variant.id,
      stockQuantity: 9,
    });
    expect(StockAdjustmentResult.parse(c.ok(await adjust(product.id, variant.id, 5)))).toEqual({
      variantId: variant.id,
      stockQuantity: 14,
    });
    expect(await stockOf(variant.id)).toBe(14);
  });

  it('records who adjusted stock', async () => {
    const product = await c.product();
    const variant = await c.variant(product.id, { stockQuantity: 1 });
    c.h.clock.advance(minutes(3));
    c.ok(await adjust(product.id, variant.id, 2, c.adminCookie));
    const row = await c.h.db.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(row).toMatchObject({
      updatedById: c.admin.id,
      createdById: c.owner.id,
      stockQuantity: 3,
    });
    expect(row.updatedAt.toISOString()).toBe(c.h.clock.now().toISOString());
  });

  it('Stock cannot go negative', async () => {
    const product = await c.product();
    const variant = await c.variant(product.id, { stockQuantity: 2 });
    problem(await adjust(product.id, variant.id, -3), 409, 'INSUFFICIENT_STOCK');
    expect(await stockOf(variant.id)).toBe(2);
    expect(
      StockAdjustmentResult.parse(c.ok(await adjust(product.id, variant.id, -2))).stockQuantity,
    ).toBe(0);
  });

  it('rejects stock above the storable maximum, zero, fractional, and oversized deltas', async () => {
    const product = await c.product();
    const variant = await c.variant(product.id, { stockQuantity: 2_147_483_640 });
    problem(await adjust(product.id, variant.id, 10), 400, 'VALIDATION_FAILED');
    expect(await stockOf(variant.id)).toBe(2_147_483_640);
    expect(
      StockAdjustmentResult.parse(c.ok(await adjust(product.id, variant.id, 7))).stockQuantity,
    ).toBe(2_147_483_647);
    for (const delta of [0, 1.5, 100_001, -100_001]) {
      problem(await adjust(product.id, variant.id, delta), 400, 'VALIDATION_FAILED');
    }
    problem(await adjust(product.id, UNKNOWN_ID, 1), 404, 'NOT_FOUND');
  });

  it('rejects stock adjustments on archived products', async () => {
    const product = await c.product();
    const variant = await c.variant(product.id, { stockQuantity: 5 });
    c.ok(await c.call('POST', `/products/${product.id}/archive`));
    problem(await adjust(product.id, variant.id, 1), 409, 'INVALID_STATE_TRANSITION');
    expect(await stockOf(variant.id)).toBe(5);
  });

  it('Negative initial stock rejected', async () => {
    const product = await c.product();
    const [size, color] = [await c.size(), await c.color()];
    const body = problem(
      await c.call('POST', variantsUrl(product.id), {
        sizeId: size.id,
        colorId: color.id,
        sku: 'NEG-STOCK-1',
        stockQuantity: -1,
      }),
      400,
      'VALIDATION_FAILED',
    );
    expect(body.errors?.map((e) => e.path)).toEqual(['stockQuantity']);
  });

  it('Concurrent stock adjustments', async () => {
    for (let round = 0; round < 3; round++) {
      const product = await c.product();
      const variant = await c.variant(product.id, { stockQuantity: 10 });
      const results = await Promise.all(
        Array.from({ length: 15 }, () => adjust(product.id, variant.id, -1)),
      );
      const statuses = results.map((res) => res.statusCode);
      expect(
        statuses.filter((s) => s === 200),
        `round ${round}`,
      ).toHaveLength(10);
      expect(
        statuses.filter((s) => s === 409),
        `round ${round}`,
      ).toHaveLength(5);
      for (const res of results.filter((r) => r.statusCode === 409)) {
        expect((res.json() as { code: string }).code).toBe('INSUFFICIENT_STOCK');
      }
      // Each success saw a distinct resulting quantity: no lost updates.
      const quantities = results
        .filter((r) => r.statusCode === 200)
        .map((r) => StockAdjustmentResult.parse(r.json()).stockQuantity)
        .sort((a, b) => a - b);
      expect(quantities).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(await stockOf(variant.id)).toBe(0);
    }
  });

  it('applies mixed concurrent increments and decrements without lost updates', async () => {
    const product = await c.product();
    const variant = await c.variant(product.id, { stockQuantity: 100 });
    const deltas = Array.from({ length: 20 }, (_, n) => (n % 2 === 0 ? 3 : -2));
    const results = await Promise.all(deltas.map((delta) => adjust(product.id, variant.id, delta)));
    expect(results.every((res) => res.statusCode === 200)).toBe(true);
    expect(await stockOf(variant.id)).toBe(100 + 10 * 3 - 10 * 2);
  });
});
