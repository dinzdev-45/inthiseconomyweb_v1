import type { Prisma, PrismaClient } from '@ite/db';

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

/** Everything an `AdminDrop` response needs: products in order, each with its primary image. */
export const DROP_DETAIL_INCLUDE = {
  products: {
    orderBy: { position: 'asc' },
    include: { product: { include: { images: { where: { isPrimary: true }, take: 1 } } } },
  },
} as const satisfies Prisma.DropInclude;
export type DropDetailRow = Prisma.DropGetPayload<{ include: typeof DROP_DETAIL_INCLUDE }>;

type DropWrite = {
  slug?: string;
  collection?: string;
  title?: string;
  description?: string | null;
  releaseAt?: Date;
  imageUrl?: string | null;
  imageAlt?: string | null;
  updatedById: string | null;
};

/** LIKE wildcards escaped so `q` matches literally. */
const escapeLike = (text: string) => text.replace(/[\\%_]/g, (char) => `\\${char}`);

/** Database access for drops (admin). The only Prisma caller in this module. */
export function createDropRepository(db: PrismaClient) {
  return {
    transaction<T>(fn: (tx: Tx) => Promise<T>) {
      return db.$transaction(fn);
    },

    list() {
      return db.drop.findMany({
        orderBy: [{ releaseAt: 'desc' }, { id: 'desc' }],
        include: { _count: { select: { products: true } } },
      });
    },

    findDetail(id: string, client: Pick<Tx, 'drop'> = db) {
      return client.drop.findUnique({ where: { id }, include: DROP_DETAIL_INCLUDE });
    },

    slugsWithPrefix(prefix: string) {
      return db.drop
        .findMany({ where: { slug: { startsWith: prefix } }, select: { slug: true } })
        .then((rows) => rows.map((row) => row.slug));
    },

    create(data: Prisma.DropUncheckedCreateInput) {
      return db.drop.create({ data, include: DROP_DETAIL_INCLUDE });
    },

    /** Locks the drop row until the transaction ends: drop writes run one at a time. */
    async lock(tx: Tx, id: string) {
      const rows = await tx.$queryRaw<{ id: string; status: 'DRAFT' | 'PUBLISHED' }[]>`
        SELECT id, status FROM drops WHERE id = ${id}::uuid FOR UPDATE
      `;
      return rows[0] ?? null;
    },

    update(tx: Tx, id: string, data: DropWrite & { status?: 'DRAFT' | 'PUBLISHED' }) {
      return tx.drop.update({ where: { id }, data, include: DROP_DETAIL_INCLUDE });
    },

    delete(tx: Tx, id: string) {
      return tx.drop.delete({ where: { id } });
    },

    /** Which of `ids` exist as products. */
    existingProducts(tx: Tx, ids: readonly string[]) {
      return tx.product
        .findMany({ where: { id: { in: [...ids] } }, select: { id: true } })
        .then((rows) => new Set(rows.map((row) => row.id)));
    },

    /** Memberships of `ids` in drops other than `dropId`. */
    inOtherDrops(tx: Tx, dropId: string, ids: readonly string[]) {
      return tx.dropProduct.findMany({
        where: { productId: { in: [...ids] }, dropId: { not: dropId } },
        select: { productId: true, dropId: true },
      });
    },

    /** Replaces the drop's products with `ids`, in that order. */
    async setProducts(tx: Tx, dropId: string, ids: readonly string[]) {
      await tx.dropProduct.deleteMany({ where: { dropId } });
      if (ids.length > 0) {
        await tx.dropProduct.createMany({
          data: ids.map((productId, position) => ({ dropId, productId, position })),
        });
      }
    },

    async imageAndProductCount(tx: Tx, id: string) {
      const drop = await tx.drop.findUniqueOrThrow({
        where: { id },
        include: { _count: { select: { products: true } } },
      });
      return drop;
    },

    /** Up to 20 products whose name contains `q`, each with the drop it belongs to. */
    candidates(q: string) {
      return db.product.findMany({
        where: { name: { contains: escapeLike(q), mode: 'insensitive' } },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        take: 20,
        include: {
          images: { where: { isPrimary: true }, take: 1 },
          dropProduct: { include: { drop: { select: { id: true, title: true } } } },
        },
      });
    },
  };
}

export type DropRepository = ReturnType<typeof createDropRepository>;
