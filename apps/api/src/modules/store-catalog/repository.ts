import type { StoreSort } from '@ite/contracts';
import { Prisma, type PrismaClient } from '@ite/db';

/*
 * Read-only catalog queries for the public store zone (storefront-catalog design D3). Only
 * ACTIVE products and their ACTIVE variants are ever read. A list request is two statements:
 * one for the page and its total, one for the page's colors and images. A by-slug request is
 * also two: the same page statement (visibility, price range, availability) and the detail.
 */

export type StoreListFilter = {
  category?: string;
  size?: string;
  color?: string;
  inStock?: boolean;
  q?: string;
  /** Exact product slug (the single-product lookup). */
  slug?: string;
};

/** One product row of a page: everything but its colors and images. */
export type StoreProductRow = {
  id: string;
  slug: string;
  name: string;
  currency: string;
  categorySlug: string;
  categoryName: string;
  minPrice: number;
  maxPrice: number;
  inStock: boolean;
};

type StoreImageRow = { url: string; alt: string };
export type StoreProductExtras = {
  colors: { slug: string; name: string; hex: string | null }[];
  image: StoreImageRow | null;
  secondaryImage: StoreImageRow | null;
};

/** One ACTIVE variant of a product detail, as the detail statement returns it. */
export type StoreVariantRow = {
  sizeCode: string;
  sizeLabel: string;
  colorSlug: string;
  colorName: string;
  colorHex: string | null;
  amount: number;
  inStock: boolean;
};

export type StoreProductDetailRow = StoreProductExtras & {
  description: string | null;
  images: { url: string; alt: string; color: string | null }[];
  variants: StoreVariantRow[];
};

/** Escapes LIKE wildcards (and the escape character) so `q` matches literally. */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Size, color, and in-stock filters must all hold for one and the same ACTIVE variant. */
function variantFilter(filter: StoreListFilter): Prisma.Sql {
  if (!filter.size && !filter.color && !filter.inStock) return Prisma.empty;
  return Prisma.sql`AND EXISTS (
    SELECT 1 FROM product_variants fv
    JOIN sizes fs ON fs.id = fv.size_id
    JOIN colors fc ON fc.id = fv.color_id
    WHERE fv.product_id = p.id AND fv.status = 'ACTIVE'
    ${filter.size ? Prisma.sql`AND fs.code = ${filter.size}` : Prisma.empty}
    ${filter.color ? Prisma.sql`AND fc.slug = ${filter.color}` : Prisma.empty}
    ${filter.inStock ? Prisma.sql`AND fv.stock_quantity > 0` : Prisma.empty}
  )`;
}

/**
 * A product's summary extras as columns (for a `products p` row): colors of ACTIVE variants by
 * name, the primary image, and the first other image in display order. Shared by the list and
 * the detail, so both describe a product the same way.
 */
const EXTRAS_COLUMNS = Prisma.sql`
  COALESCE((
    SELECT json_agg(json_build_object('slug', c.slug, 'name', c.name, 'hex', c.hex)
                    ORDER BY c.name, c.slug)
    FROM (
      SELECT DISTINCT co.slug, co.name, co.hex
      FROM product_variants pv JOIN colors co ON co.id = pv.color_id
      WHERE pv.product_id = p.id AND pv.status = 'ACTIVE'
    ) c
  ), '[]'::json) AS colors,
  (
    SELECT json_build_object('url', i.url, 'alt', i.alt)
    FROM product_images i WHERE i.product_id = p.id AND i.is_primary
    LIMIT 1
  ) AS image,
  (
    SELECT json_build_object('url', i.url, 'alt', i.alt)
    FROM product_images i WHERE i.product_id = p.id AND NOT i.is_primary
    ORDER BY i.sort_order, i.id
    LIMIT 1
  ) AS "secondaryImage"
`;

const ORDER_BY: Record<StoreSort, Prisma.Sql> = {
  newest: Prisma.sql`activated_at DESC NULLS LAST, slug ASC`,
  'price-asc': Prisma.sql`min_price ASC, activated_at DESC NULLS LAST, slug ASC`,
  'price-desc': Prisma.sql`min_price DESC, activated_at DESC NULLS LAST, slug ASC`,
};

export function createStoreCatalogRepository(db: PrismaClient) {
  return {
    /**
     * One page of ACTIVE products matching `filter`, in `sort` order, plus the total match count.
     * The total comes back even when the page is past the end (the page is LEFT JOINed onto it).
     */
    async page(
      filter: StoreListFilter,
      sort: StoreSort,
      limit: number,
      offset: number,
    ): Promise<{ rows: StoreProductRow[]; total: number }> {
      const result = await db.$queryRaw<
        ({ total: number } & ({ [K in keyof StoreProductRow]: null } | StoreProductRow))[]
      >`
        WITH priced AS (
          SELECT pv.product_id,
                 MIN(COALESCE(pv.price_override_amount, p.base_price_amount)) AS min_price,
                 MAX(COALESCE(pv.price_override_amount, p.base_price_amount)) AS max_price,
                 bool_or(pv.stock_quantity > 0) AS in_stock
          FROM product_variants pv
          JOIN products p ON p.id = pv.product_id
          WHERE p.status = 'ACTIVE' AND pv.status = 'ACTIVE'
          GROUP BY pv.product_id
        ),
        matched AS (
          SELECT p.id, p.slug, p.name, p.currency, p.activated_at,
                 c.slug AS category_slug, c.name AS category_name,
                 priced.min_price, priced.max_price, priced.in_stock
          FROM products p
          JOIN priced ON priced.product_id = p.id
          JOIN categories c ON c.id = p.category_id
          WHERE p.status = 'ACTIVE'
          ${filter.category ? Prisma.sql`AND c.slug = ${filter.category}` : Prisma.empty}
          ${
            filter.q
              ? Prisma.sql`AND p.name ILIKE '%' || ${escapeLike(filter.q)} || '%' ESCAPE '\\'`
              : Prisma.empty
          }
          ${filter.slug ? Prisma.sql`AND p.slug = ${filter.slug}` : Prisma.empty}
          ${variantFilter(filter)}
        )
        SELECT counted.total, page.id, page.slug, page.name, page.currency,
               page.category_slug AS "categorySlug", page.category_name AS "categoryName",
               page.min_price AS "minPrice", page.max_price AS "maxPrice",
               page.in_stock AS "inStock"
        FROM (SELECT COUNT(*)::integer AS total FROM matched) counted
        LEFT JOIN LATERAL (
          SELECT matched.*, row_number() OVER (ORDER BY ${ORDER_BY[sort]}) AS position
          FROM matched
          ORDER BY ${ORDER_BY[sort]}
          LIMIT ${limit} OFFSET ${offset}
        ) page ON true
        ORDER BY page.position
      `;
      const total = result[0]?.total ?? 0;
      const rows = result.filter(
        (row): row is { total: number } & StoreProductRow => row.id !== null,
      );
      return { rows: rows.map(({ total: _total, ...row }) => row), total };
    },

    /**
     * Colors (of ACTIVE variants, by name), the primary image, and the first other image in
     * display order, for every given product, in one statement.
     */
    async extras(productIds: readonly string[]): Promise<Map<string, StoreProductExtras>> {
      if (productIds.length === 0) return new Map();
      const rows = await db.$queryRaw<({ productId: string } & StoreProductExtras)[]>`
        SELECT p.id AS "productId", ${EXTRAS_COLUMNS}
        FROM products p
        WHERE p.id = ANY(${[...productIds]}::uuid[])
      `;
      return new Map(rows.map(({ productId, ...extras }) => [productId, extras]));
    },

    /**
     * Everything the product detail adds for one product, plus its summary extras, in one
     * statement: the description; the images to show, tagged with the color of their variant
     * (images of colors no ACTIVE variant uses are left out); and the ACTIVE variants with
     * size, color, effective price, and whether they are in stock.
     */
    async detail(productId: string): Promise<StoreProductDetailRow | null> {
      const rows = await db.$queryRaw<StoreProductDetailRow[]>`
        SELECT p.description, ${EXTRAS_COLUMNS},
          COALESCE((
            SELECT json_agg(json_build_object('url', i.url, 'alt', i.alt, 'color', ic.slug)
                            ORDER BY i.sort_order, i.id)
            FROM product_images i
            LEFT JOIN product_variants iv ON iv.id = i.variant_id
            LEFT JOIN colors ic ON ic.id = iv.color_id
            WHERE i.product_id = p.id
              AND (i.variant_id IS NULL OR EXISTS (
                SELECT 1 FROM product_variants av
                WHERE av.product_id = p.id AND av.status = 'ACTIVE' AND av.color_id = iv.color_id
              ))
          ), '[]'::json) AS images,
          COALESCE((
            SELECT json_agg(json_build_object(
                     'sizeCode', s.code, 'sizeLabel', s.label,
                     'colorSlug', co.slug, 'colorName', co.name, 'colorHex', co.hex,
                     'amount', COALESCE(v.price_override_amount, p.base_price_amount),
                     'inStock', v.stock_quantity > 0)
                   ORDER BY s.sort_order, s.code, co.name, co.slug)
            FROM product_variants v
            JOIN sizes s ON s.id = v.size_id
            JOIN colors co ON co.id = v.color_id
            WHERE v.product_id = p.id AND v.status = 'ACTIVE'
          ), '[]'::json) AS variants
        FROM products p
        WHERE p.id = ${productId}::uuid
      `;
      return rows[0] ?? null;
    },

    /**
     * Filter options over ACTIVE products and their ACTIVE variants: categories (with product
     * counts) and colors by name, sizes in display order.
     */
    async filterOptions() {
      const [categories, sizes, colors] = await Promise.all([
        db.$queryRaw<{ slug: string; name: string; productCount: number }[]>`
          SELECT c.slug, c.name, COUNT(*)::integer AS "productCount"
          FROM products p JOIN categories c ON c.id = p.category_id
          WHERE p.status = 'ACTIVE' AND EXISTS (
            SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND pv.status = 'ACTIVE'
          )
          GROUP BY c.id, c.slug, c.name
          ORDER BY c.name, c.slug
        `,
        db.$queryRaw<{ code: string; label: string }[]>`
          SELECT s.code, s.label
          FROM sizes s
          WHERE EXISTS (
            SELECT 1 FROM product_variants pv JOIN products p ON p.id = pv.product_id
            WHERE pv.size_id = s.id AND pv.status = 'ACTIVE' AND p.status = 'ACTIVE'
          )
          ORDER BY s.sort_order, s.code
        `,
        db.$queryRaw<{ slug: string; name: string; hex: string | null }[]>`
          SELECT co.slug, co.name, co.hex
          FROM colors co
          WHERE EXISTS (
            SELECT 1 FROM product_variants pv JOIN products p ON p.id = pv.product_id
            WHERE pv.color_id = co.id AND pv.status = 'ACTIVE' AND p.status = 'ACTIVE'
          )
          ORDER BY co.name, co.slug
        `,
      ]);
      return { categories, sizes, colors };
    },
  };
}

export type StoreCatalogRepository = ReturnType<typeof createStoreCatalogRepository>;
