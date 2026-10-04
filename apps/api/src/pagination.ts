import { createHmac, timingSafeEqual } from 'node:crypto';

import { Id, Timestamp } from '@ite/contracts';
import { z } from 'zod';

import { DomainError } from './errors.ts';

/*
 * Keyset (cursor) pagination for lists ordered newest first (product-domain design D7). A cursor
 * names the last row of a page by its `(createdAt, id)` sort key. It is opaque to clients:
 * base64url JSON plus an HMAC-SHA-256 signature keyed with SESSION_SECRET and bound to one list
 * (`scope`), so a tampered, forged, or other-list cursor is rejected with 400 instead of being
 * trusted. `limit` (default 20, at most 100) comes from the `PaginationQuery` contract.
 */

/** The sort key a cursor carries: the last row of the previous page. */
export type CursorKey = { createdAt: Date; id: string };

const CursorPayload = z.strictObject({ v: z.literal(1), t: Timestamp, i: Id });

const invalidCursor = () =>
  new DomainError('VALIDATION_FAILED', 400, 'The cursor is invalid. Request the first page again.');

/** Stable order for cursor-paginated lists: newest first, id breaking ties (UUIDv7 is time-ordered). */
export const CURSOR_ORDER_BY = [{ createdAt: 'desc' }, { id: 'desc' }] as const satisfies readonly [
  { createdAt: 'desc' },
  { id: 'desc' },
];

/**
 * The filter for rows strictly after `key` in `CURSOR_ORDER_BY` order:
 * `created_at < t OR (created_at = t AND id < i)`. No cursor means no filter (first page).
 */
export function afterCursor(key: CursorKey | undefined) {
  if (!key) return {};
  return {
    OR: [{ createdAt: { lt: key.createdAt } }, { createdAt: key.createdAt, id: { lt: key.id } }],
  };
}

export type CursorCodec = {
  encode(key: CursorKey): string;
  /** The key inside a cursor; throws `400 VALIDATION_FAILED` for anything not issued by `encode`. */
  decode(cursor: string): CursorKey;
};

/**
 * A cursor codec for one list. `scope` (e.g. `admin.products`) is signed into every cursor, so a
 * cursor from one list cannot be replayed against another. Rotating SESSION_SECRET only
 * invalidates outstanding cursors (clients start again from the first page).
 */
export function createCursorCodec(secret: string, scope: string): CursorCodec {
  const sign = (payload: string) =>
    createHmac('sha256', secret).update(`ite.cursor.v1\n${scope}\n${payload}`).digest();

  return {
    encode({ createdAt, id }) {
      const payload = Buffer.from(
        JSON.stringify({ v: 1, t: createdAt.toISOString(), i: id }),
      ).toString('base64url');
      return `${payload}.${sign(payload).toString('base64url')}`;
    },

    decode(cursor) {
      const [payload, signature, ...rest] = cursor.split('.');
      if (!payload || !signature || rest.length > 0) throw invalidCursor();
      const expected = sign(payload);
      const given = Buffer.from(signature, 'base64url');
      if (
        signature !== given.toString('base64url') ||
        given.length !== expected.length ||
        !timingSafeEqual(given, expected)
      ) {
        throw invalidCursor();
      }
      let json: unknown;
      try {
        json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      } catch {
        throw invalidCursor();
      }
      const parsed = CursorPayload.safeParse(json);
      if (!parsed.success) throw invalidCursor();
      return { createdAt: new Date(parsed.data.t), id: parsed.data.i };
    },
  };
}

/**
 * Builds a page from rows fetched with `take: limit + 1` in `CURSOR_ORDER_BY` order: the first
 * `limit` rows, and a cursor after the last of them only when another row exists.
 */
export function toPage<Row extends CursorKey>(
  rows: readonly Row[],
  limit: number,
  codec: CursorCodec,
): { rows: Row[]; nextCursor: string | null } {
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    rows: page,
    nextCursor: rows.length > limit && last ? codec.encode(last) : null,
  };
}
