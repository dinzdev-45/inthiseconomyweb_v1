import type { ErrorCode } from '@ite/contracts';
import { Prisma } from '@ite/db';

import { DomainError } from '../../errors.ts';

/**
 * HTTP status for each catalog error code (product-domain design D7): `409` for conflicts with
 * existing state, `422` for semantically invalid references or currency.
 */
export const CATALOG_ERROR_STATUS = {
  SLUG_EXISTS: 409,
  SLUG_LOCKED: 409,
  SKU_EXISTS: 409,
  SKU_LOCKED: 409,
  CODE_EXISTS: 409,
  VARIANT_EXISTS: 409,
  VARIANT_MISMATCH: 422,
  UNKNOWN_REFERENCE: 422,
  IN_USE: 409,
  INVALID_STATE_TRANSITION: 409,
  PRODUCT_NOT_READY: 409,
  LAST_ACTIVE_VARIANT: 409,
  LAST_IMAGE: 409,
  INSUFFICIENT_STOCK: 409,
  CURRENCY_MISMATCH: 422,
  IMAGE_LIMIT: 409,
} as const satisfies Partial<Record<ErrorCode, 409 | 422>>;

export type CatalogErrorCode = keyof typeof CATALOG_ERROR_STATUS;

/** A catalog DomainError with the status that belongs to its code. */
export function catalogError(code: CatalogErrorCode, detail: string): DomainError {
  return new DomainError(code, CATALOG_ERROR_STATUS[code], detail);
}

/**
 * Unique constraints a client can legitimately hit, by constraint name. Anything else
 * (including the one-primary-image index, which the services guarantee) is a bug, not a
 * client error, and stays unmapped.
 */
const UNIQUE_CONSTRAINTS: Record<string, { code: CatalogErrorCode; detail: string }> = {
  products_slug_key: { code: 'SLUG_EXISTS', detail: 'Another product already uses this slug.' },
  categories_slug_key: { code: 'SLUG_EXISTS', detail: 'Another category already uses this slug.' },
  colors_slug_key: { code: 'SLUG_EXISTS', detail: 'Another color already uses this slug.' },
  sizes_code_key: { code: 'CODE_EXISTS', detail: 'Another size already uses this code.' },
  product_variants_sku_key: {
    code: 'SKU_EXISTS',
    detail: 'Another variant already uses this SKU.',
  },
  product_variants_product_id_size_id_color_id_key: {
    code: 'VARIANT_EXISTS',
    detail: 'This product already has a variant with this size and color.',
  },
};

/**
 * Catalog foreign keys, by constraint name: what is missing when a write references an unknown
 * row, and what is still using a row that a delete targets. Attribution keys (`*_by_fkey`) are
 * absent on purpose: the acting staff member always exists, so a violation there is a bug.
 */
const FOREIGN_KEYS: Record<string, { missing: string; inUse: string }> = {
  products_category_id_fkey: {
    missing: 'Category not found.',
    inUse: 'Products still use this category.',
  },
  product_variants_product_id_fkey: {
    missing: 'Product not found.',
    inUse: 'This product still has variants.',
  },
  product_variants_size_id_fkey: {
    missing: 'Size not found.',
    inUse: 'Variants still use this size.',
  },
  product_variants_color_id_fkey: {
    missing: 'Color not found.',
    inUse: 'Variants still use this color.',
  },
  product_images_product_id_fkey: {
    missing: 'Product not found.',
    inUse: 'This product still has images.',
  },
  product_images_variant_id_fkey: {
    missing: 'Variant not found.',
    inUse: 'Images still use this variant.',
  },
};

/**
 * Whether the failed statement was a write that references other rows (`'write'`: a foreign-key
 * violation means an unknown reference) or a delete of a referenced row (`'delete'`: it means the
 * row is in use).
 */
export type CatalogOperation = 'write' | 'delete';

type Violation = { kind: 'unique' | 'foreign-key'; constraint: string };

/**
 * Reads the violated constraint from a Prisma error. Model calls report P2002/P2003 with the
 * constraint name from the pg driver adapter; raw queries report P2010 with the PostgreSQL
 * SQLSTATE (23505/23503) and the name only inside the server message.
 */
function violationOf(error: unknown): Violation | undefined {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return undefined;
  const cause = (error.meta?.driverAdapterError as { cause?: Record<string, unknown> } | undefined)
    ?.cause;
  const sqlState = cause?.originalCode;
  const kind =
    error.code === 'P2002' || sqlState === '23505'
      ? 'unique'
      : error.code === 'P2003' || sqlState === '23503'
        ? 'foreign-key'
        : undefined;
  if (!kind) return undefined;

  const named = (cause?.constraint as { index?: unknown } | undefined)?.index;
  if (typeof named === 'string') return { kind, constraint: named };
  const message = cause?.originalMessage;
  const quoted = typeof message === 'string' ? /constraint "([^"]+)"/.exec(message) : null;
  return quoted?.[1] ? { kind, constraint: quoted[1] } : undefined;
}

/**
 * Maps a known catalog constraint violation to its stable DomainError, or returns undefined.
 * The result never carries constraint names, SQL, or row data: only the fixed details above.
 */
export function toCatalogError(
  error: unknown,
  operation: CatalogOperation,
): DomainError | undefined {
  const violation = violationOf(error);
  if (!violation) return undefined;
  if (violation.kind === 'unique') {
    const known = UNIQUE_CONSTRAINTS[violation.constraint];
    return known && catalogError(known.code, known.detail);
  }
  const known = FOREIGN_KEYS[violation.constraint];
  if (!known) return undefined;
  return operation === 'delete'
    ? catalogError('IN_USE', known.inUse)
    : catalogError('UNKNOWN_REFERENCE', known.missing);
}

/**
 * For a service's `catch`: throws the mapped DomainError for a known catalog constraint
 * violation, and rethrows anything else unchanged so unexpected failures still surface as 500s
 * (logged by the error handler, never exposed).
 */
export function rethrowCatalogError(error: unknown, operation: CatalogOperation): never {
  throw toCatalogError(error, operation) ?? error;
}

/** Whether an error is a slug collision, i.e. maps to `SLUG_EXISTS`. */
export function isSlugConflict(error: unknown): boolean {
  return toCatalogError(error, 'write')?.code === 'SLUG_EXISTS';
}

/** Whether Prisma reports that the row to update or delete does not exist (P2025). */
export function isRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}
