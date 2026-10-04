import { z } from 'zod';

/** Stable, machine-readable error codes carried in ProblemDetails.code. */
export const ErrorCode = z.enum([
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'INVALID_CREDENTIALS',
  'FORBIDDEN',
  'PASSWORD_CHANGE_REQUIRED',
  'NOT_FOUND',
  'STAFF_EMAIL_EXISTS',
  'LAST_OWNER',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'SERVICE_UNAVAILABLE',
  // Catalog (product-domain)
  'SLUG_EXISTS',
  'SLUG_LOCKED',
  'SKU_EXISTS',
  'SKU_LOCKED',
  'CODE_EXISTS',
  'VARIANT_EXISTS',
  'VARIANT_MISMATCH',
  'UNKNOWN_REFERENCE',
  'IN_USE',
  'INVALID_STATE_TRANSITION',
  'PRODUCT_NOT_READY',
  'LAST_ACTIVE_VARIANT',
  'LAST_IMAGE',
  'INSUFFICIENT_STOCK',
  'CURRENCY_MISMATCH',
  'IMAGE_LIMIT',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

/** A single field-level validation issue. `path` is dot-separated, e.g. `items.0.quantity`. */
export const FieldError = z.strictObject({
  path: z.string(),
  message: z.string().min(1),
});
export type FieldError = z.infer<typeof FieldError>;

/**
 * RFC 7807 error body (`application/problem+json`) returned by every error
 * response. Strict: no other fields (stack traces, SQL, internals) may appear.
 */
export const ProblemDetails = z.strictObject({
  type: z.string().min(1),
  title: z.string().min(1),
  status: z.int().min(400).max(599),
  detail: z.string(),
  requestId: z.string().min(1),
  code: ErrorCode.optional(),
  errors: z.array(FieldError).optional(),
});
export type ProblemDetails = z.infer<typeof ProblemDetails>;
