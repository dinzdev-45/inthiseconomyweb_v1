import { z } from 'zod';

import { HexColor, ImageUrl, SizeCode, Slug } from './catalog.ts';
import { Money } from './primitives.ts';

/*
 * Public store catalog contracts (store-catalog-api spec). Separate from the admin catalog
 * contracts on purpose: a store summary carries only customer-safe facts (no ids, stock
 * quantities, SKUs, attribution, or timestamps), and the list uses numbered pages, not cursors.
 */

/** Fixed page size of the store product list. */
export const STORE_PAGE_SIZE = 24;

export const StoreAvailability = z.enum(['IN_STOCK', 'SOLD_OUT']);
export type StoreAvailability = z.infer<typeof StoreAvailability>;

export const StoreSort = z.enum(['newest', 'price-asc', 'price-desc']);
export type StoreSort = z.infer<typeof StoreSort>;

/** Catalog search text: trimmed, 1–100 characters. */
export const StoreSearchText = z.string().trim().min(1).max(100);

/** Catalog page number: a positive whole number, coerced from the query string. */
export const StorePage = z.coerce.number().int().min(1).max(1_000_000);

const StoreImage = z.strictObject({ url: ImageUrl, alt: z.string() });
const StoreColor = z.strictObject({ slug: Slug, name: z.string(), hex: HexColor.nullable() });

export const StoreProductSummary = z.strictObject({
  slug: Slug,
  name: z.string(),
  category: z.strictObject({ slug: Slug, name: z.string() }),
  /** Lowest and highest effective price among ACTIVE variants, in the store currency. */
  price: z.strictObject({ min: Money, max: Money }),
  availability: StoreAvailability,
  /** Colors of ACTIVE variants, by name. */
  colors: z.array(StoreColor),
  image: StoreImage.nullable(),
  secondaryImage: StoreImage.nullable(),
});
export type StoreProductSummary = z.infer<typeof StoreProductSummary>;

export const StoreProductListQuery = z.strictObject({
  category: Slug.optional(),
  size: SizeCode.optional(),
  color: Slug.optional(),
  availability: z.literal('in-stock').optional(),
  sort: StoreSort.default('newest'),
  q: StoreSearchText.optional(),
  page: StorePage.default(1),
});
export type StoreProductListQuery = z.infer<typeof StoreProductListQuery>;

export const StoreProductListResponse = z.strictObject({
  data: z.array(StoreProductSummary),
  page: z.int().min(1),
  pageSize: z.int().min(1),
  totalItems: z.int().min(0),
  totalPages: z.int().min(0),
});
export type StoreProductListResponse = z.infer<typeof StoreProductListResponse>;

export const StoreProductParams = z.strictObject({ slug: Slug });

export const StoreCatalogFilters = z.strictObject({
  /** Categories of ACTIVE products, by name. */
  categories: z.array(
    z.strictObject({ slug: Slug, name: z.string(), productCount: z.int().min(1) }),
  ),
  /** Sizes of ACTIVE variants of ACTIVE products, in display order. */
  sizes: z.array(z.strictObject({ code: SizeCode, label: z.string() })),
  /** Colors of ACTIVE variants of ACTIVE products, by name. */
  colors: z.array(StoreColor),
});
export type StoreCatalogFilters = z.infer<typeof StoreCatalogFilters>;
