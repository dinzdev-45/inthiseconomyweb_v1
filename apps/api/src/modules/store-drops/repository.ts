import type { PrismaClient } from '@ite/db';

/** A published drop with the number of its ACTIVE products. */
export type PublishedDropRow = {
  id: string;
  slug: string;
  collection: string;
  title: string;
  description: string | null;
  releaseAt: Date;
  imageUrl: string | null;
  imageAlt: string | null;
  productCount: number;
};

/** Read-only drop queries for the store zone: PUBLISHED drops only, never drafts. */
export function createStoreDropRepository(db: PrismaClient) {
  return {
    published(): Promise<PublishedDropRow[]> {
      return db.$queryRaw<PublishedDropRow[]>`
        SELECT d.id, d.slug, d.collection, d.title, d.description,
               d.release_at AS "releaseAt", d.image_url AS "imageUrl", d.image_alt AS "imageAlt",
               (
                 SELECT COUNT(*)::integer FROM drop_products dp
                 JOIN products p ON p.id = dp.product_id
                 WHERE dp.drop_id = d.id AND p.status = 'ACTIVE'
               ) AS "productCount"
        FROM drops d
        WHERE d.status = 'PUBLISHED'
        ORDER BY d.release_at, d.id
      `;
    },
  };
}

export type StoreDropRepository = ReturnType<typeof createStoreDropRepository>;
