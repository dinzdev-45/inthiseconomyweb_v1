import { z } from 'zod';

/** Resource identifier exposed by the API: a UUIDv7 (non-sequential to clients). */
export const Id = z.uuidv7();
export type Id = z.infer<typeof Id>;

/** ISO 8601 timestamp in UTC (`Z` suffix; offsets are rejected). */
export const Timestamp = z.iso.datetime();
export type Timestamp = z.infer<typeof Timestamp>;

/** ISO 4217 alphabetic currency code, e.g. `IDR`, `USD`. */
export const CurrencyCode = z.string().regex(/^[A-Z]{3}$/, 'Must be an ISO 4217 currency code');
export type CurrencyCode = z.infer<typeof CurrencyCode>;

/** Monetary amount as an integer in the currency's minor unit. */
export const Money = z.strictObject({
  amount: z.int(),
  currency: CurrencyCode,
});
export type Money = z.infer<typeof Money>;

/**
 * Attribution carried by admin-managed records. `createdBy`/`updatedBy` are
 * null when a system process or the bootstrap command made the change.
 */
export const AttributionFields = z.object({
  createdAt: Timestamp,
  updatedAt: Timestamp,
  createdBy: Id.nullable(),
  updatedBy: Id.nullable(),
});
export type AttributionFields = z.infer<typeof AttributionFields>;

/** Query for cursor-paginated lists: `limit` 1–100 (default 20) and an opaque `cursor`. */
export const PaginationQuery = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).max(512).optional(),
});
export type PaginationQuery = z.infer<typeof PaginationQuery>;

/** `{ data, nextCursor }` list envelope; `nextCursor` is null on the last page. */
export function paginated<T extends z.ZodType>(item: T) {
  return z.strictObject({ data: z.array(item), nextCursor: z.string().nullable() });
}
