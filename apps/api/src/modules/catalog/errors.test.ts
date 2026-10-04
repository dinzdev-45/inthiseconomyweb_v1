import { ErrorCode } from '@ite/contracts';
import { createPrismaClient, type PrismaClient } from '@ite/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestDatabase } from '../../../test/support/database.ts';
import { DomainError } from '../../errors.ts';
import {
  CATALOG_ERROR_STATUS,
  catalogError,
  isSlugConflict,
  rethrowCatalogError,
  toCatalogError,
  type CatalogOperation,
} from './errors.ts';

/*
 * Error mapping is tested against real PostgreSQL errors from the Prisma pg adapter, since
 * their shape (constraint names in driver-adapter metadata) is what the mapping depends on.
 */
let db: PrismaClient;
const ids: Record<string, string> = {};
const UNKNOWN_ID = '0190a000-0000-7000-8000-000000000000';

async function failure(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error('expected the statement to fail');
}

async function mapped(run: () => Promise<unknown>, operation: CatalogOperation = 'write') {
  const error = await failure(run);
  const domain = toCatalogError(error, operation);
  expect(domain).toBeInstanceOf(DomainError);
  return domain!;
}

beforeAll(async () => {
  db = createPrismaClient(await createTestDatabase());
  const category = await db.category.create({ data: { name: 'Apparel', slug: 'apparel' } });
  const size = await db.size.create({ data: { code: 'M', label: 'Medium', sortOrder: 30 } });
  const color = await db.color.create({ data: { name: 'Black', slug: 'black' } });
  const product = await db.product.create({
    data: {
      name: 'Inflation Tee',
      slug: 'inflation-tee',
      categoryId: category.id,
      basePriceAmount: 34_900_000,
      currency: 'IDR',
    },
  });
  const variant = await db.productVariant.create({
    data: { productId: product.id, sizeId: size.id, colorId: color.id, sku: 'ITE-IT-BL-M' },
  });
  await db.productImage.create({
    data: { productId: product.id, url: '/a.jpg', alt: 'Front', sortOrder: 0, isPrimary: true },
  });
  Object.assign(ids, {
    category: category.id,
    size: size.id,
    color: color.id,
    product: product.id,
    variant: variant.id,
  });
});

afterAll(async () => {
  await db?.$disconnect();
});

describe('catalog error codes', () => {
  it('covers every catalog code with 409 or 422', () => {
    const catalogCodes = ErrorCode.options.slice(ErrorCode.options.indexOf('SLUG_EXISTS'));
    expect(Object.keys(CATALOG_ERROR_STATUS).sort()).toEqual([...catalogCodes].sort());
    expect(catalogError('CURRENCY_MISMATCH', 'x')).toMatchObject({ status: 422 });
    expect(catalogError('VARIANT_MISMATCH', 'x')).toMatchObject({ status: 422 });
    expect(catalogError('UNKNOWN_REFERENCE', 'x')).toMatchObject({ status: 422 });
    expect(catalogError('SLUG_EXISTS', 'x')).toMatchObject({ status: 409, code: 'SLUG_EXISTS' });
  });
});

describe('unique violations', () => {
  it.each([
    [
      'product slug',
      () =>
        db.product.create({
          data: {
            name: 'x',
            slug: 'inflation-tee',
            categoryId: ids.category!,
            basePriceAmount: 1,
            currency: 'IDR',
          },
        }),
      'SLUG_EXISTS',
    ],
    [
      'category slug',
      () => db.category.create({ data: { name: 'x', slug: 'apparel' } }),
      'SLUG_EXISTS',
    ],
    ['color slug', () => db.color.create({ data: { name: 'x', slug: 'black' } }), 'SLUG_EXISTS'],
    [
      'size code',
      () => db.size.create({ data: { code: 'M', label: 'x', sortOrder: 1 } }),
      'CODE_EXISTS',
    ],
    [
      'SKU',
      async () => {
        const size = await db.size.create({ data: { code: 'L', label: 'Large', sortOrder: 40 } });
        return db.productVariant.create({
          data: {
            productId: ids.product!,
            sizeId: size.id,
            colorId: ids.color!,
            sku: 'ITE-IT-BL-M',
          },
        });
      },
      'SKU_EXISTS',
    ],
    [
      'size and color per product',
      () =>
        db.productVariant.create({
          data: {
            productId: ids.product!,
            sizeId: ids.size!,
            colorId: ids.color!,
            sku: 'ITE-IT-BL-M2',
          },
        }),
      'VARIANT_EXISTS',
    ],
  ] as const)('maps a duplicate %s to %s (409)', async (_label, run, code) => {
    const error = await mapped(run);
    expect(error).toMatchObject({ code, status: 409 });
  });

  it('maps unique violations from raw SQL too', async () => {
    const error = await mapped(
      () => db.$executeRaw`INSERT INTO categories (id, name, slug, updated_at)
        VALUES (gen_random_uuid(), 'x', 'apparel', now())`,
    );
    expect(error).toMatchObject({ code: 'SLUG_EXISTS', status: 409 });
  });

  it('recognises slug conflicts for generated-slug retries', async () => {
    expect(
      isSlugConflict(
        await failure(() => db.category.create({ data: { name: 'x', slug: 'apparel' } })),
      ),
    ).toBe(true);
    expect(
      isSlugConflict(
        await failure(() => db.size.create({ data: { code: 'M', label: 'x', sortOrder: 1 } })),
      ),
    ).toBe(false);
  });
});

describe('foreign-key violations', () => {
  it.each([
    [
      'category',
      () =>
        db.product.create({
          data: {
            name: 'x',
            slug: 'fk-category',
            categoryId: UNKNOWN_ID,
            basePriceAmount: 1,
            currency: 'IDR',
          },
        }),
      'Category not found.',
    ],
    [
      'size',
      () =>
        db.productVariant.create({
          data: {
            productId: ids.product!,
            sizeId: UNKNOWN_ID,
            colorId: ids.color!,
            sku: 'FK-SIZE',
          },
        }),
      'Size not found.',
    ],
    [
      'color',
      () =>
        db.productVariant.create({
          data: {
            productId: ids.product!,
            sizeId: ids.size!,
            colorId: UNKNOWN_ID,
            sku: 'FK-COLOR',
          },
        }),
      'Color not found.',
    ],
    [
      'image variant',
      () =>
        db.productImage.create({
          data: {
            productId: ids.product!,
            variantId: UNKNOWN_ID,
            url: '/b.jpg',
            alt: 'Back',
            sortOrder: 1,
          },
        }),
      'Variant not found.',
    ],
  ])(
    'maps a write referencing an unknown %s to 422 UNKNOWN_REFERENCE',
    async (_label, run, detail) => {
      const error = await mapped(run, 'write');
      expect(error).toMatchObject({ code: 'UNKNOWN_REFERENCE', status: 422, detail });
    },
  );

  it.each([
    ['size', () => db.size.delete({ where: { id: ids.size! } }), 'Variants still use this size.'],
    [
      'color',
      () => db.color.delete({ where: { id: ids.color! } }),
      'Variants still use this color.',
    ],
    [
      'category',
      () => db.category.delete({ where: { id: ids.category! } }),
      'Products still use this category.',
    ],
  ])('maps deleting a %s in use to 409 IN_USE', async (_label, run, detail) => {
    const error = await mapped(run, 'delete');
    expect(error).toMatchObject({ code: 'IN_USE', status: 409, detail });
    expect(await db.size.count({ where: { id: ids.size! } })).toBe(1);
  });
});

describe('nothing internal leaks', () => {
  it('details never contain constraint, table, or column names or SQL', async () => {
    const errors = [
      await mapped(() => db.category.create({ data: { name: 'x', slug: 'apparel' } })),
      await mapped(() => db.size.delete({ where: { id: ids.size! } }), 'delete'),
      await mapped(() =>
        db.product.create({
          data: {
            name: 'x',
            slug: 'leak',
            categoryId: UNKNOWN_ID,
            basePriceAmount: 1,
            currency: 'IDR',
          },
        }),
      ),
    ];
    for (const error of errors) {
      expect(error.detail).not.toMatch(
        /_key|_fkey|constraint|categories|sizes|products|_id|SQL|violat/i,
      );
      expect(error.message).toBe(error.detail);
    }
  });
});

describe('unexpected errors pass through', () => {
  it('leaves check-constraint violations unmapped (the contract rejects them first)', async () => {
    const error = await failure(
      () =>
        db.$executeRaw`UPDATE product_variants SET stock_quantity = -1 WHERE id = ${ids.variant}::uuid`,
    );
    expect(toCatalogError(error, 'write')).toBeUndefined();
  });

  it('leaves a second primary image unmapped (the image service prevents it)', async () => {
    const error = await failure(() =>
      db.productImage.create({
        data: {
          productId: ids.product!,
          url: '/c.jpg',
          alt: 'Side',
          sortOrder: 2,
          isPrimary: true,
        },
      }),
    );
    expect(toCatalogError(error, 'write')).toBeUndefined();
  });

  it('leaves attribution foreign keys unmapped', async () => {
    const error = await failure(() =>
      db.color.create({ data: { name: 'Ghost', slug: 'ghost', createdById: UNKNOWN_ID } }),
    );
    expect(toCatalogError(error, 'write')).toBeUndefined();
  });

  it('leaves non-database and non-constraint errors unmapped', () => {
    expect(toCatalogError(new Error('boom'), 'write')).toBeUndefined();
    expect(toCatalogError(new TypeError('x'), 'delete')).toBeUndefined();
    expect(toCatalogError(undefined, 'write')).toBeUndefined();
  });

  it('rethrowCatalogError throws the mapped error or the original one unchanged', async () => {
    const unique = await failure(() =>
      db.category.create({ data: { name: 'x', slug: 'apparel' } }),
    );
    expect(() => rethrowCatalogError(unique, 'write')).toThrow(
      expect.objectContaining({ code: 'SLUG_EXISTS', status: 409 }),
    );
    const original = new Error('connection terminated');
    expect(() => rethrowCatalogError(original, 'write')).toThrow(original);
  });
});
