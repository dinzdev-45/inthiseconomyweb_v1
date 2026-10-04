import { createPrismaClient, type PrismaClient } from '@ite/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestDatabase } from '../../test/support/database.ts';

/**
 * Database-level catalog invariants (product-domain task 2.3). Every write here goes straight
 * to PostgreSQL with raw SQL, bypassing the API, to prove the constraints hold on their own.
 */
let db: PrismaClient;
const ids: Record<string, string> = {};

const sql = (statement: string) => db.$executeRawUnsafe(statement);
const rejects = (statement: string, reason: RegExp) =>
  expect(sql(statement)).rejects.toThrow(reason);

beforeAll(async () => {
  db = createPrismaClient(await createTestDatabase());
  const category = await db.category.create({ data: { name: 'Apparel', slug: 'apparel' } });
  const size = await db.size.create({ data: { code: 'M', label: 'Medium', sortOrder: 30 } });
  const size2 = await db.size.create({
    data: { code: '30/32', label: 'Waist 30 / Leg 32', sortOrder: 120 },
  });
  const color = await db.color.create({ data: { name: 'Black', slug: 'black', hex: '#171615' } });
  const product = await db.product.create({
    data: {
      name: 'Overdraft Hoodie',
      slug: 'overdraft-hoodie',
      categoryId: category.id,
      basePriceAmount: 89_900_000,
      currency: 'IDR',
    },
  });
  const variant = await db.productVariant.create({
    data: {
      productId: product.id,
      sizeId: size.id,
      colorId: color.id,
      sku: 'ITE-OH-BL-M',
      stockQuantity: 5,
    },
  });
  Object.assign(ids, {
    category: category.id,
    size: size.id,
    size2: size2.id,
    color: color.id,
    product: product.id,
    variant: variant.id,
  });
});
afterAll(async () => db.$disconnect());

const productSql = (slug: string, amount: string, currency = "'IDR'") =>
  `INSERT INTO products (id, name, slug, category_id, base_price_amount, currency)
   VALUES (gen_random_uuid(), 'X', '${slug}', '${ids.category}', ${amount}, ${currency})`;
const variantSql = (
  sku: string,
  { size = ids.size, stock = '0', override = 'NULL', product = ids.product } = {},
) =>
  `INSERT INTO product_variants (id, product_id, size_id, color_id, sku, stock_quantity, price_override_amount)
   VALUES (gen_random_uuid(), '${product}', '${size}', '${ids.color}', '${sku}', ${stock}, ${override})`;
const imageSql = (primary: boolean, variant = 'NULL') =>
  `INSERT INTO product_images (id, product_id, variant_id, url, alt, sort_order, is_primary)
   VALUES (gen_random_uuid(), '${ids.product}', ${variant}, '/img/a.jpg', 'Front', 0, ${primary})`;

describe('uniqueness', () => {
  it('rejects a duplicate product slug', async () => {
    await rejects(productSql('overdraft-hoodie', '100'), /products_slug_key|unique/i);
  });

  it('rejects duplicate category and color slugs and size codes', async () => {
    await rejects(
      `INSERT INTO categories (id, name, slug) VALUES (gen_random_uuid(), 'A', 'apparel')`,
      /categories_slug_key|unique/i,
    );
    await rejects(
      `INSERT INTO colors (id, name, slug) VALUES (gen_random_uuid(), 'B', 'black')`,
      /colors_slug_key|unique/i,
    );
    await rejects(
      `INSERT INTO sizes (id, code, label, sort_order) VALUES (gen_random_uuid(), 'M', 'M', 1)`,
      /sizes_code_key|unique/i,
    );
  });

  it('rejects a duplicate SKU, even on another product', async () => {
    const other = await db.product.create({
      data: {
        name: 'Other',
        slug: 'other',
        categoryId: ids.category!,
        basePriceAmount: 100,
        currency: 'IDR',
      },
    });
    await rejects(
      variantSql('ITE-OH-BL-M', { product: other.id, size: ids.size2! }),
      /product_variants_sku_key|unique/i,
    );
  });

  it('rejects a second variant with the same size and color on one product', async () => {
    await rejects(
      variantSql('ITE-OH-BL-M2'),
      /product_variants_product_id_size_id_color_id_key|unique/i,
    );
  });
});

describe('prices and stock', () => {
  it('rejects a negative base price and one above the catalog maximum, and accepts the bounds', async () => {
    await rejects(productSql('negative-price', '-1'), /products_base_price_amount_range/);
    await rejects(productSql('too-expensive', '2000000001'), /products_base_price_amount_range/);
    await expect(sql(productSql('free-item', '0'))).resolves.toBe(1);
    await expect(sql(productSql('max-price-item', '2000000000'))).resolves.toBe(1);
  });

  it('rejects out-of-range price overrides', async () => {
    await rejects(
      variantSql('ITE-NEG', { size: ids.size2!, override: '-1' }),
      /product_variants_price_override_amount_range/,
    );
    await rejects(
      variantSql('ITE-MAX', { size: ids.size2!, override: '2000000001' }),
      /product_variants_price_override_amount_range/,
    );
  });

  it('Database rejects negative stock', async () => {
    await rejects(
      variantSql('ITE-NEG-STOCK', { size: ids.size2!, stock: '-1' }),
      /product_variants_stock_quantity_non_negative/,
    );
    await rejects(
      `UPDATE product_variants SET stock_quantity = stock_quantity - 6 WHERE id = '${ids.variant}'`,
      /product_variants_stock_quantity_non_negative/,
    );
    expect(
      (await db.productVariant.findUniqueOrThrow({ where: { id: ids.variant! } })).stockQuantity,
    ).toBe(5);
  });

  it('rejects stock beyond the integer storage maximum', async () => {
    await rejects(
      variantSql('ITE-HUGE', { size: ids.size2!, stock: '2147483648' }),
      /out of range/i,
    );
  });
});

describe('primary images', () => {
  it('allows many non-primary images but at most one primary per product', async () => {
    await expect(sql(imageSql(true))).resolves.toBe(1);
    await expect(sql(imageSql(false))).resolves.toBe(1);
    await rejects(imageSql(true), /product_images_one_primary_per_product/);
    expect(
      await db.productImage.count({ where: { productId: ids.product!, isPrimary: true } }),
    ).toBe(1);
  });
});

describe('foreign keys', () => {
  const unknown = '0199a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b';

  it('rejects references to rows that do not exist', async () => {
    await rejects(
      `INSERT INTO products (id, name, slug, category_id, base_price_amount, currency) VALUES (gen_random_uuid(), 'X', 'orphan', '${unknown}', 1, 'IDR')`,
      /products_category_id_fkey|foreign key/i,
    );
    await rejects(
      variantSql('ITE-ORPHAN', { size: unknown }),
      /product_variants_size_id_fkey|foreign key/i,
    );
    await rejects(imageSql(false, `'${unknown}'`), /product_images_variant_id_fkey|foreign key/i);
  });

  it('refuses to delete sizes, colors, categories, and products that are in use', async () => {
    await rejects(`DELETE FROM sizes WHERE id = '${ids.size}'`, /foreign key/i);
    await rejects(`DELETE FROM colors WHERE id = '${ids.color}'`, /foreign key/i);
    await rejects(`DELETE FROM categories WHERE id = '${ids.category}'`, /foreign key/i);
    await rejects(`DELETE FROM products WHERE id = '${ids.product}'`, /foreign key/i);
  });
});

describe('normalized formats', () => {
  // Statements are built lazily: fixture ids exist only after beforeAll.
  it.each([
    ['uppercase product slug', (): string => productSql('Upper-Case', '1'), /products_slug_format/],
    [
      'lowercase currency',
      (): string => productSql('bad-currency', '1', "'idr'"),
      /products_currency_format/,
    ],
    [
      'lowercase SKU',
      (): string => variantSql('ite-lower', { size: ids.size2! }),
      /product_variants_sku_format/,
    ],
    [
      'lowercase size code',
      (): string =>
        `INSERT INTO sizes (id, code, label, sort_order) VALUES (gen_random_uuid(), 'm', 'm', 1)`,
      /sizes_code_format/,
    ],
    [
      'size code with a space',
      (): string =>
        `INSERT INTO sizes (id, code, label, sort_order) VALUES (gen_random_uuid(), 'M L', 'x', 1)`,
      /sizes_code_format/,
    ],
    [
      'lowercase hex',
      (): string =>
        `INSERT INTO colors (id, name, slug, hex) VALUES (gen_random_uuid(), 'R', 'red', '#ff0000')`,
      /colors_hex_format/,
    ],
  ] as const)('rejects a %s', async (_label, statement, reason) => {
    await rejects(statement(), reason);
  });

  it('accepts generic size codes', async () => {
    for (const code of ['OS', '28', 'EU-42', '10.5']) {
      await expect(
        sql(
          `INSERT INTO sizes (id, code, label, sort_order) VALUES (gen_random_uuid(), '${code}', '${code}', 1)`,
        ),
      ).resolves.toBe(1);
    }
  });
});
