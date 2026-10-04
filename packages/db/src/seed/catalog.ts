import type { PrismaClient } from '../generated/prisma/client.ts';

/**
 * Development catalog (product-domain task 2.4): representative reference data and the
 * homepage's placeholder products. Create-only and idempotent: rows are upserted by their
 * natural key with no updates, images are added only to products without any, so a rerun
 * changes nothing. Attribution is null (system). Prices are in minor units of the store
 * currency; values here are rupiah × 100.
 */

type Status = 'DRAFT' | 'ACTIVE' | 'INACTIVE';

export const DEV_CATEGORIES = [
  { slug: 'apparel', name: 'Apparel', status: 'ACTIVE' },
  { slug: 'accessories', name: 'Accessories', status: 'ACTIVE' },
  { slug: 'archive-2025', name: 'Archive 2025', status: 'ARCHIVED' },
] as const;

/** Letter sizes, one size, and waist sizes: all master data with explicit display order. */
export const DEV_SIZES = [
  { code: 'XS', label: 'Extra Small', sortOrder: 10 },
  { code: 'S', label: 'Small', sortOrder: 20 },
  { code: 'M', label: 'Medium', sortOrder: 30 },
  { code: 'L', label: 'Large', sortOrder: 40 },
  { code: 'XL', label: 'Extra Large', sortOrder: 50 },
  { code: 'XXL', label: 'Extra Extra Large', sortOrder: 60 },
  { code: 'OS', label: 'One Size', sortOrder: 70 },
  { code: '28', label: 'Waist 28', sortOrder: 110 },
  { code: '30', label: 'Waist 30', sortOrder: 120 },
  { code: '32', label: 'Waist 32', sortOrder: 130 },
  { code: '34', label: 'Waist 34', sortOrder: 140 },
] as const;

/** Brand-neutral colors (hex from the InThisEconomy palette and its neutrals). */
export const DEV_COLORS = [
  { slug: 'washed-black', name: 'Washed Black', hex: '#2B2A28' },
  { slug: 'black', name: 'Black', hex: '#171615' },
  { slug: 'off-white', name: 'Off-White', hex: '#F2EBDD' },
  { slug: 'white', name: 'White', hex: '#FAF8F3' },
  { slug: 'stone-grey', name: 'Stone Grey', hex: '#756F67' },
  { slug: 'heather-grey', name: 'Heather Grey', hex: '#A8A39B' },
  { slug: 'charcoal', name: 'Charcoal', hex: '#3A3836' },
  { slug: 'dirty-brown', name: 'Dirty Brown', hex: '#B1641E' },
] as const;

const LETTERS = ['S', 'M', 'L', 'XL'];
const WAISTS = ['28', '30', '32', '34'];
/** Deterministic first activation for seeded active/inactive products. */
const ACTIVATED_AT = new Date('2026-10-01T03:00:00.000Z');

type DevProduct = {
  slug: string;
  name: string;
  description: string;
  category: string;
  rupiah: number;
  status: Status;
  skuStem: string;
  color: string;
  sizes: readonly string[];
  /** Per-size price overrides in rupiah. */
  overrides?: Readonly<Record<string, number>>;
};

export const DEV_PRODUCTS: readonly DevProduct[] = [
  {
    slug: 'overdraft-hoodie',
    name: 'Overdraft Hoodie',
    description: 'Heavyweight fleece hoodie.',
    category: 'apparel',
    rupiah: 899_000,
    status: 'ACTIVE',
    skuStem: 'OH',
    color: 'washed-black',
    sizes: LETTERS,
  },
  {
    slug: 'inflation-tee',
    name: 'Inflation Tee',
    description: 'Boxy midweight cotton tee.',
    category: 'apparel',
    rupiah: 349_000,
    status: 'ACTIVE',
    skuStem: 'IT',
    color: 'off-white',
    sizes: [...LETTERS, 'XXL'],
    overrides: { XXL: 369_000 },
  },
  {
    slug: 'minimum-wage-cargo',
    name: 'Minimum Wage Cargo',
    description: 'Relaxed ripstop cargo trousers.',
    category: 'apparel',
    rupiah: 799_000,
    status: 'ACTIVE',
    skuStem: 'MWC',
    color: 'stone-grey',
    sizes: WAISTS,
  },
  {
    slug: 'rent-due-coach-jacket',
    name: 'Rent Due Coach Jacket',
    description: 'Water-resistant coach jacket.',
    category: 'apparel',
    rupiah: 1_299_000,
    status: 'ACTIVE',
    skuStem: 'RDCJ',
    color: 'black',
    sizes: LETTERS,
  },
  {
    slug: 'budget-cut-shorts',
    name: 'Budget Cut Shorts',
    description: 'Cut-off twill shorts.',
    category: 'apparel',
    rupiah: 429_000,
    status: 'INACTIVE',
    skuStem: 'BCS',
    color: 'black',
    sizes: WAISTS,
  },
  {
    slug: 'side-hustle-crewneck',
    name: 'Side Hustle Crewneck',
    description: 'Loopback crewneck sweatshirt.',
    category: 'apparel',
    rupiah: 649_000,
    status: 'DRAFT',
    skuStem: 'SHC',
    color: 'heather-grey',
    sizes: LETTERS,
  },
  {
    slug: 'price-tag-cap',
    name: 'Price Tag Cap',
    description: 'Six-panel washed cotton cap.',
    category: 'accessories',
    rupiah: 279_000,
    status: 'DRAFT',
    skuStem: 'PTC',
    color: 'off-white',
    sizes: ['OS'],
  },
  {
    slug: 'fixed-income-overshirt',
    name: 'Fixed Income Overshirt',
    description: 'Brushed twill overshirt.',
    category: 'apparel',
    rupiah: 749_000,
    status: 'DRAFT',
    skuStem: 'FIO',
    color: 'charcoal',
    sizes: LETTERS,
  },
  {
    slug: 'receipt-long-sleeve',
    name: 'Receipt Long Sleeve',
    description: 'Long-sleeve tee with receipt print.',
    category: 'apparel',
    rupiah: 399_000,
    status: 'DRAFT',
    skuStem: 'RLS',
    color: 'white',
    sizes: LETTERS,
  },
];

const STOCK = [6, 12, 18, 10, 4];
const colorCode = (slug: string) =>
  slug
    .split('-')
    .map((word) => word.slice(0, 2))
    .join('')
    .toUpperCase();

export type CatalogSeedResult = Record<
  'categories' | 'sizes' | 'colors' | 'products' | 'variants' | 'images',
  { created: number; existing: number }
>;

export async function seedCatalog(
  prisma: PrismaClient,
  currency = 'IDR',
): Promise<CatalogSeedResult> {
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Seed currency must be an ISO 4217 code.');
  const result: CatalogSeedResult = {
    categories: { created: 0, existing: 0 },
    sizes: { created: 0, existing: 0 },
    colors: { created: 0, existing: 0 },
    products: { created: 0, existing: 0 },
    variants: { created: 0, existing: 0 },
    images: { created: 0, existing: 0 },
  };
  const count = (key: keyof CatalogSeedResult, existed: boolean) =>
    existed ? result[key].existing++ : result[key].created++;

  const categories = new Map<string, string>();
  for (const category of DEV_CATEGORIES) {
    const existed = await prisma.category.findUnique({ where: { slug: category.slug } });
    const row = existed ?? (await prisma.category.create({ data: { ...category } }));
    count('categories', Boolean(existed));
    categories.set(category.slug, row.id);
  }

  const sizes = new Map<string, string>();
  for (const size of DEV_SIZES) {
    const existed = await prisma.size.findUnique({ where: { code: size.code } });
    const row = existed ?? (await prisma.size.create({ data: { ...size } }));
    count('sizes', Boolean(existed));
    sizes.set(size.code, row.id);
  }

  const colors = new Map<string, string>();
  for (const color of DEV_COLORS) {
    const existed = await prisma.color.findUnique({ where: { slug: color.slug } });
    const row = existed ?? (await prisma.color.create({ data: { ...color } }));
    count('colors', Boolean(existed));
    colors.set(color.slug, row.id);
  }

  for (const item of DEV_PRODUCTS) {
    const existed = await prisma.product.findUnique({ where: { slug: item.slug } });
    const colorName = DEV_COLORS.find((c) => c.slug === item.color)!.name;
    const product =
      existed ??
      (await prisma.product.create({
        data: {
          slug: item.slug,
          name: item.name,
          description: item.description,
          status: item.status,
          categoryId: categories.get(item.category)!,
          basePriceAmount: item.rupiah * 100,
          currency,
          activatedAt: item.status === 'DRAFT' ? null : ACTIVATED_AT,
        },
      }));
    count('products', Boolean(existed));

    for (const [index, sizeCode] of item.sizes.entries()) {
      const sku = `ITE-${item.skuStem}-${colorCode(item.color)}-${sizeCode}`;
      const variantExists = await prisma.productVariant.findUnique({ where: { sku } });
      if (!variantExists) {
        const override = item.overrides?.[sizeCode];
        await prisma.productVariant.create({
          data: {
            productId: product.id,
            sizeId: sizes.get(sizeCode)!,
            colorId: colors.get(item.color)!,
            sku,
            priceOverrideAmount: override === undefined ? null : override * 100,
            stockQuantity: STOCK[index % STOCK.length]!,
          },
        });
      }
      count('variants', Boolean(variantExists));
    }

    // Products that are or were live have one primary image (activation readiness).
    if (item.status !== 'DRAFT') {
      const images = await prisma.productImage.count({ where: { productId: product.id } });
      if (images === 0) {
        await prisma.productImage.create({
          data: {
            productId: product.id,
            url: `/images/products/${item.slug}/front.jpg`,
            alt: `${item.name} in ${colorName}, front view`,
            sortOrder: 0,
            isPrimary: true,
          },
        });
      }
      count('images', images > 0);
    }
  }
  return result;
}
