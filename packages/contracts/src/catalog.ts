import { z } from 'zod';

import {
  AttributionFields,
  CurrencyCode,
  Id,
  paginated,
  PaginationQuery,
  Timestamp,
} from './primitives.ts';

/*
 * Catalog contracts (product-domain). Responses are strict and contain only API fields:
 * prices are always Money objects (never raw *_amount columns), references are ids or small
 * summaries. Server-side rules that need data (store currency, uniqueness, lifecycle) are
 * enforced by the API, not here.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** Lowercase kebab-case slug, at most 80 characters. */
export const Slug = z
  .string()
  .max(80)
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    'Must be lowercase letters and digits separated by single hyphens',
  );
export type Slug = z.infer<typeof Slug>;

/** SKU, normalized to uppercase: starts with a letter or digit, then letters, digits, or hyphens (2–64). */
export const Sku = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9-]{1,63}$/, 'Must be 2–64 letters, digits, or hyphens');
export type Sku = z.infer<typeof Sku>;

/**
 * Size code: generic master data (S, M, XL, OS, 28, 30/32, EU-42 …), not a fixed list.
 * Trimmed and uppercased, then letters/digits optionally joined by single - / or ., at most 12.
 */
export const SizeCode = z
  .string()
  .trim()
  .toUpperCase()
  .max(12)
  .regex(
    /^[A-Z0-9]+([-/.][A-Z0-9]+)*$/,
    'Must be letters and digits, optionally joined by - / or .',
  );
export type SizeCode = z.infer<typeof SizeCode>;

/** `#RRGGBB`, stored uppercase. */
export const HexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a #RRGGBB color')
  .toUpperCase();
export type HexColor = z.infer<typeof HexColor>;

/**
 * Catalog price limit: a business rule (product-management spec), the highest price one item may
 * have in this version, to catch entry errors such as extra zeros. 2,000,000,000 minor units is
 * Rp 20,000,000 in IDR. Applies to base prices and variant overrides.
 */
export const CATALOG_PRICE_MAX = 2_000_000_000;

/** Money for catalog prices: integer minor units from 0 to the catalog maximum. */
export const Price = z.strictObject({
  amount: z.int().min(0).max(CATALOG_PRICE_MAX),
  currency: CurrencyCode,
});
export type Price = z.infer<typeof Price>;

/** Largest stock quantity storable per variant (PostgreSQL integer). */
export const STOCK_MAX = 2_147_483_647;
export const StockQuantity = z.int().min(0).max(STOCK_MAX);

/** A stock adjustment: non-zero, at most 100,000 units either way. */
export const StockDelta = z
  .int()
  .min(-100_000)
  .max(100_000)
  .refine((delta) => delta !== 0, 'Must not be zero');

/** Most images one product may have (product-management spec). */
export const PRODUCT_IMAGE_MAX = 20;

/** Image location: an https URL or a root-relative path (not protocol-relative), at most 2048 characters. */
export const ImageUrl = z
  .string()
  .max(2048)
  .refine(
    (value) =>
      (value.startsWith('/') && !value.startsWith('//')) ||
      (value.startsWith('https://') && URL.canParse(value)),
    'Must be an https:// URL or a path starting with /',
  );

export const ProductStatus = z.enum(['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED']);
export type ProductStatus = z.infer<typeof ProductStatus>;
export const VariantStatus = z.enum(['ACTIVE', 'INACTIVE']);
export type VariantStatus = z.infer<typeof VariantStatus>;
export const CategoryStatus = z.enum(['ACTIVE', 'ARCHIVED']);
export type CategoryStatus = z.infer<typeof CategoryStatus>;

const ProductName = z.string().trim().min(1).max(120);
const Description = z.string().max(5000);
const CategoryName = z.string().trim().min(1).max(80);
const ColorName = z.string().trim().min(1).max(60);
const SizeLabel = z.string().trim().min(1).max(40);
const AltText = z.string().trim().min(1).max(300);
const SortOrder = z.int().min(0).max(1_000_000);

/** A partial update body: any subset of the fields, but at least one. */
function partialUpdate<T extends z.ZodRawShape>(shape: T) {
  return z
    .strictObject(shape)
    .partial()
    .refine((body) => Object.keys(body).length > 0, 'At least one field is required');
}

// ---------------------------------------------------------------------------
// Reference data: categories, sizes, colors
// ---------------------------------------------------------------------------

export const Category = z.strictObject({
  id: Id,
  name: z.string(),
  slug: Slug,
  status: CategoryStatus,
  ...AttributionFields.shape,
});
export type Category = z.infer<typeof Category>;
export const CategoryListQuery = z.strictObject({ status: CategoryStatus.optional() });
export const CategoryListResponse = z.strictObject({ data: z.array(Category) });
export const CreateCategoryRequest = z.strictObject({ name: CategoryName, slug: Slug.optional() });
export type CreateCategoryRequest = z.infer<typeof CreateCategoryRequest>;
export const UpdateCategoryRequest = partialUpdate({ name: CategoryName, slug: Slug });
export type UpdateCategoryRequest = z.infer<typeof UpdateCategoryRequest>;

export const Size = z.strictObject({
  id: Id,
  code: SizeCode,
  label: z.string(),
  sortOrder: z.int(),
  ...AttributionFields.shape,
});
export type Size = z.infer<typeof Size>;
export const SizeListResponse = z.strictObject({ data: z.array(Size) });
export const CreateSizeRequest = z.strictObject({
  code: SizeCode,
  label: SizeLabel,
  sortOrder: SortOrder,
});
export type CreateSizeRequest = z.infer<typeof CreateSizeRequest>;
export const UpdateSizeRequest = partialUpdate({
  code: SizeCode,
  label: SizeLabel,
  sortOrder: SortOrder,
});
export type UpdateSizeRequest = z.infer<typeof UpdateSizeRequest>;

export const Color = z.strictObject({
  id: Id,
  name: z.string(),
  slug: Slug,
  hex: HexColor.nullable(),
  ...AttributionFields.shape,
});
export type Color = z.infer<typeof Color>;
export const ColorListResponse = z.strictObject({ data: z.array(Color) });
export const CreateColorRequest = z.strictObject({
  name: ColorName,
  slug: Slug.optional(),
  hex: HexColor.nullable().optional(),
});
export type CreateColorRequest = z.infer<typeof CreateColorRequest>;
export const UpdateColorRequest = partialUpdate({
  name: ColorName,
  slug: Slug,
  hex: HexColor.nullable(),
});
export type UpdateColorRequest = z.infer<typeof UpdateColorRequest>;

// ---------------------------------------------------------------------------
// Products, variants, images
// ---------------------------------------------------------------------------

/** Compact references embedded in product responses. */
export const CategoryRef = z.strictObject({
  id: Id,
  name: z.string(),
  slug: Slug,
  status: CategoryStatus,
});
export const SizeRef = z.strictObject({ id: Id, code: SizeCode, label: z.string() });
export const ColorRef = z.strictObject({
  id: Id,
  name: z.string(),
  slug: Slug,
  hex: HexColor.nullable(),
});
export const ImageRef = z.strictObject({ id: Id, url: ImageUrl, alt: z.string() });

export const ProductImage = z.strictObject({
  id: Id,
  url: ImageUrl,
  alt: z.string(),
  variantId: Id.nullable(),
  sortOrder: z.int(),
  isPrimary: z.boolean(),
  ...AttributionFields.shape,
});
export type ProductImage = z.infer<typeof ProductImage>;
/** A product's images in display order (the reorder response). */
export const ProductImageListResponse = z.strictObject({ data: z.array(ProductImage) });
export type ProductImageListResponse = z.infer<typeof ProductImageListResponse>;

export const ProductVariant = z.strictObject({
  id: Id,
  sku: Sku,
  size: SizeRef,
  color: ColorRef,
  /** Set when this variant is priced differently from the product. */
  priceOverride: Price.nullable(),
  /** `priceOverride` when set, otherwise the product's `basePrice`. */
  effectivePrice: Price,
  stockQuantity: StockQuantity,
  status: VariantStatus,
  ...AttributionFields.shape,
});
export type ProductVariant = z.infer<typeof ProductVariant>;

/** A product's stock at a glance, counted over its ACTIVE variants only. */
export const ProductStockSummary = z.strictObject({
  /** Sum of `stockQuantity` (may exceed one variant's maximum). */
  totalQuantity: z.int().min(0),
  activeVariantCount: z.int().min(0),
  /** ACTIVE variants whose `stockQuantity` is 0. */
  outOfStockVariantCount: z.int().min(0),
});
export type ProductStockSummary = z.infer<typeof ProductStockSummary>;

export const ProductListItem = z.strictObject({
  id: Id,
  name: z.string(),
  slug: Slug,
  status: ProductStatus,
  category: CategoryRef,
  basePrice: Price,
  variantCount: z.int().min(0),
  /** Stock across the product's ACTIVE variants (inactive variants are not sellable). */
  stock: ProductStockSummary,
  primaryImage: ImageRef.nullable(),
  /** First activation; null until the product has been ACTIVE once. */
  activatedAt: Timestamp.nullable(),
  ...AttributionFields.shape,
});
export type ProductListItem = z.infer<typeof ProductListItem>;

export const ProductDetail = z.strictObject({
  id: Id,
  name: z.string(),
  slug: Slug,
  description: z.string().nullable(),
  status: ProductStatus,
  category: CategoryRef,
  basePrice: Price,
  activatedAt: Timestamp.nullable(),
  variants: z.array(ProductVariant),
  /** In display order (sortOrder ascending). */
  images: z.array(ProductImage),
  ...AttributionFields.shape,
});
export type ProductDetail = z.infer<typeof ProductDetail>;

export const ProductListQuery = z.strictObject({
  ...PaginationQuery.shape,
  status: ProductStatus.optional(),
  categoryId: Id.optional(),
  q: z.string().trim().min(1).max(120).optional(),
});
export type ProductListQuery = z.infer<typeof ProductListQuery>;
export const ProductListResponse = paginated(ProductListItem);
export type ProductListResponse = z.infer<typeof ProductListResponse>;

export const CreateProductRequest = z.strictObject({
  name: ProductName,
  slug: Slug.optional(),
  description: Description.nullable().optional(),
  categoryId: Id,
  basePrice: Price,
});
export type CreateProductRequest = z.infer<typeof CreateProductRequest>;
export const UpdateProductRequest = partialUpdate({
  name: ProductName,
  slug: Slug,
  description: Description.nullable(),
  categoryId: Id,
  basePrice: Price,
});
export type UpdateProductRequest = z.infer<typeof UpdateProductRequest>;

export const CreateVariantRequest = z.strictObject({
  sizeId: Id,
  colorId: Id,
  sku: Sku,
  priceOverride: Price.nullable().optional(),
  stockQuantity: StockQuantity.default(0),
});
export type CreateVariantRequest = z.infer<typeof CreateVariantRequest>;
/** Stock is not editable here: it changes only through stock adjustments. */
export const UpdateVariantRequest = partialUpdate({
  sizeId: Id,
  colorId: Id,
  sku: Sku,
  priceOverride: Price.nullable(),
});
export type UpdateVariantRequest = z.infer<typeof UpdateVariantRequest>;

export const StockAdjustmentRequest = z.strictObject({ delta: StockDelta });
export type StockAdjustmentRequest = z.infer<typeof StockAdjustmentRequest>;
export const StockAdjustmentResult = z.strictObject({
  variantId: Id,
  stockQuantity: StockQuantity,
});
export type StockAdjustmentResult = z.infer<typeof StockAdjustmentResult>;

export const CreateImageRequest = z.strictObject({
  url: ImageUrl,
  alt: AltText,
  variantId: Id.nullable().optional(),
  isPrimary: z.boolean().optional(),
});
export type CreateImageRequest = z.infer<typeof CreateImageRequest>;
/** `isPrimary` can only be set to true here; the previous primary is unset by the API. */
export const UpdateImageRequest = partialUpdate({
  url: ImageUrl,
  alt: AltText,
  variantId: Id.nullable(),
  isPrimary: z.literal(true),
});
export type UpdateImageRequest = z.infer<typeof UpdateImageRequest>;

/** The product's complete image list in its new order (a permutation; checked by the API). */
export const ReorderImagesRequest = z.strictObject({
  imageIds: z
    .array(Id)
    .min(1)
    .max(PRODUCT_IMAGE_MAX)
    .refine((ids) => new Set(ids).size === ids.length, 'Image ids must be unique'),
});
export type ReorderImagesRequest = z.infer<typeof ReorderImagesRequest>;

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/**
 * Read-only catalog settings: the store currency every price must use (`STORE_CURRENCY` on
 * the API). Exposed so admin clients can display it and build prices; never writable.
 */
export const CatalogSettings = z.strictObject({ storeCurrency: CurrencyCode });
export type CatalogSettings = z.infer<typeof CatalogSettings>;

// ---------------------------------------------------------------------------
// Path parameters
// ---------------------------------------------------------------------------

export const CatalogIdParams = z.strictObject({ id: Id });
export const VariantParams = z.strictObject({ id: Id, variantId: Id });
export const ImageParams = z.strictObject({ id: Id, imageId: Id });
