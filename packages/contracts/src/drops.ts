import { z } from 'zod';

import { ImageRef, ImageUrl, ProductStatus, Slug } from './catalog.ts';
import { AttributionFields, Id, Timestamp } from './primitives.ts';
import { StoreProductSummary } from './store-catalog.ts';

/*
 * Drop contracts (drops-management and store-drops-api specs). A drop groups products under one
 * release time; while that time is ahead, its products are unreleased (not sold).
 */

export const DropStatus = z.enum(['DRAFT', 'PUBLISHED']);
export type DropStatus = z.infer<typeof DropStatus>;

/** Most products one drop may hold. */
export const DROP_PRODUCT_MAX = 100;

const Collection = z.string().trim().min(1).max(60);
const Title = z.string().trim().min(1).max(120);
const Description = z.string().max(2000);
export const DropImage = z.strictObject({ url: ImageUrl, alt: z.string().trim().min(1).max(300) });
export type DropImage = z.infer<typeof DropImage>;

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export const CreateDropRequest = z.strictObject({
  collection: Collection,
  title: Title,
  slug: Slug.optional(),
  description: Description.nullable().optional(),
  releaseAt: Timestamp,
  image: DropImage.nullable().optional(),
});
export type CreateDropRequest = z.infer<typeof CreateDropRequest>;

export const UpdateDropRequest = z
  .strictObject({
    collection: Collection,
    title: Title,
    slug: Slug,
    description: Description.nullable(),
    releaseAt: Timestamp,
    image: DropImage.nullable(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'At least one field is required');
export type UpdateDropRequest = z.infer<typeof UpdateDropRequest>;

export const SetDropProductsRequest = z.strictObject({
  productIds: z
    .array(Id)
    .max(DROP_PRODUCT_MAX)
    .refine((ids) => new Set(ids).size === ids.length, 'Product ids must be unique'),
});
export type SetDropProductsRequest = z.infer<typeof SetDropProductsRequest>;

export const AdminDropProduct = z.strictObject({
  id: Id,
  name: z.string(),
  slug: Slug,
  status: ProductStatus,
  primaryImage: ImageRef.nullable(),
});
export type AdminDropProduct = z.infer<typeof AdminDropProduct>;

export const AdminDrop = z.strictObject({
  id: Id,
  slug: Slug,
  collection: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  releaseAt: Timestamp,
  image: DropImage.nullable(),
  status: DropStatus,
  /** In display order. */
  products: z.array(AdminDropProduct),
  ...AttributionFields.shape,
});
export type AdminDrop = z.infer<typeof AdminDrop>;

export const AdminDropListItem = z.strictObject({
  id: Id,
  slug: Slug,
  collection: z.string(),
  title: z.string(),
  releaseAt: Timestamp,
  status: DropStatus,
  productCount: z.int().min(0),
  updatedAt: Timestamp,
});
export type AdminDropListItem = z.infer<typeof AdminDropListItem>;
export const AdminDropListResponse = z.strictObject({ data: z.array(AdminDropListItem) });

export const DropCandidatesQuery = z.strictObject({ q: z.string().trim().min(1).max(120) });
export const DropCandidate = z.strictObject({
  ...AdminDropProduct.shape,
  /** The drop this product already belongs to, if any. */
  drop: z.strictObject({ id: Id, title: z.string() }).nullable(),
});
export type DropCandidate = z.infer<typeof DropCandidate>;
export const DropCandidatesResponse = z.strictObject({ data: z.array(DropCandidate) });

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/** `UPCOMING`: release ahead. `LIVE`: the most recently released drop. `PAST`: the archive. */
export const StoreDropStatus = z.enum(['UPCOMING', 'LIVE', 'PAST']);
export type StoreDropStatus = z.infer<typeof StoreDropStatus>;

export const StoreDropSummary = z.strictObject({
  slug: Slug,
  collection: z.string(),
  title: z.string(),
  releaseAt: Timestamp,
  status: StoreDropStatus,
  image: z.strictObject({ url: ImageUrl, alt: z.string() }).nullable(),
  /** How many of its products customers can see (ACTIVE ones). */
  productCount: z.int().min(0),
});
export type StoreDropSummary = z.infer<typeof StoreDropSummary>;

export const StoreDropsOverview = z.strictObject({
  /** Soonest first. */
  upcoming: z.array(StoreDropSummary),
  current: StoreDropSummary.nullable(),
  /** Most recent first. */
  archive: z.array(StoreDropSummary),
});
export type StoreDropsOverview = z.infer<typeof StoreDropsOverview>;

export const StoreDropDetail = z.strictObject({
  ...StoreDropSummary.shape,
  description: z.string().nullable(),
  /** ACTIVE products in the drop's order (each with its release time while unreleased). */
  products: z.array(StoreProductSummary),
});
export type StoreDropDetail = z.infer<typeof StoreDropDetail>;
