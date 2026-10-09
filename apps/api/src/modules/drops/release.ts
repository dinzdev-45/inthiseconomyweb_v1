import { Prisma } from '@ite/db';

/**
 * The release rule (drops design D2), in one place: true for a product (`alias`, an internal
 * table alias, never user input) that belongs to a drop, of any status, releasing after `now`.
 * Every query that shows or sells products uses it with the injectable clock's time.
 */
export function unreleased(alias: string, now: Date): Prisma.Sql {
  return Prisma.sql`EXISTS (
    SELECT 1 FROM drop_products rdp JOIN drops rd ON rd.id = rdp.drop_id
    WHERE rdp.product_id = ${Prisma.raw(alias)}.id AND rd.release_at > ${now}
  )`;
}

/** Like `unreleased`, but only for drops still in DRAFT (their products are not shown at all). */
export function unreleasedInDraft(alias: string, now: Date): Prisma.Sql {
  return Prisma.sql`EXISTS (
    SELECT 1 FROM drop_products rdp JOIN drops rd ON rd.id = rdp.drop_id
    WHERE rdp.product_id = ${Prisma.raw(alias)}.id AND rd.release_at > ${now}
      AND rd.status = 'DRAFT'
  )`;
}
