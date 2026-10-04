import type { CategoryStatus, PrismaClient } from '@ite/db';

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];
type Attributed = { updatedAt: Date; updatedById: string | null };
type Created = Attributed & { createdAt: Date; createdById: string | null };

const BY_NAME = [{ name: 'asc' }, { id: 'asc' }] as const;

/**
 * Database access for categories, sizes, and colors. The only Prisma caller for reference data.
 * Writes surface Prisma errors unchanged; the service maps them (unique, foreign key, not found).
 */
export function createReferenceRepository(db: PrismaClient) {
  return {
    /** Runs `fn` in a transaction (READ COMMITTED). */
    transaction<T>(fn: (tx: Tx) => Promise<T>) {
      return db.$transaction(fn);
    },

    // Categories -------------------------------------------------------------

    listCategories(status?: CategoryStatus) {
      return db.category.findMany({ where: status ? { status } : {}, orderBy: [...BY_NAME] });
    },

    findCategory(id: string) {
      return db.category.findUnique({ where: { id } });
    },

    categorySlugsWithPrefix(prefix: string) {
      return db.category
        .findMany({ where: { slug: { startsWith: prefix } }, select: { slug: true } })
        .then((rows) => rows.map((row) => row.slug));
    },

    createCategory(data: Created & { name: string; slug: string }) {
      return db.category.create({ data });
    },

    updateCategory(id: string, data: Attributed & { name?: string; slug?: string }) {
      return db.category.update({ where: { id }, data });
    },

    /**
     * Locks the category row until the transaction ends. Product activation takes the same lock
     * first, so archiving and activating a product in it cannot interleave.
     */
    async lockCategory(tx: Tx, id: string): Promise<{ id: string; status: CategoryStatus } | null> {
      const rows = await tx.$queryRaw<{ id: string; status: CategoryStatus }[]>`
        SELECT id, status FROM categories WHERE id = ${id}::uuid FOR UPDATE
      `;
      return rows[0] ?? null;
    },

    countActiveProducts(tx: Tx, categoryId: string) {
      return tx.product.count({ where: { categoryId, status: 'ACTIVE' } });
    },

    setCategoryStatus(tx: Tx, id: string, data: Attributed & { status: CategoryStatus }) {
      return tx.category.update({ where: { id }, data });
    },

    // Sizes ------------------------------------------------------------------

    listSizes() {
      return db.size.findMany({ orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] });
    },

    createSize(data: Created & { code: string; label: string; sortOrder: number }) {
      return db.size.create({ data });
    },

    updateSize(
      id: string,
      data: Attributed & { code?: string; label?: string; sortOrder?: number },
    ) {
      return db.size.update({ where: { id }, data });
    },

    deleteSize(id: string) {
      return db.size.delete({ where: { id } });
    },

    // Colors -----------------------------------------------------------------

    listColors() {
      return db.color.findMany({ orderBy: [...BY_NAME] });
    },

    colorSlugsWithPrefix(prefix: string) {
      return db.color
        .findMany({ where: { slug: { startsWith: prefix } }, select: { slug: true } })
        .then((rows) => rows.map((row) => row.slug));
    },

    createColor(data: Created & { name: string; slug: string; hex: string | null }) {
      return db.color.create({ data });
    },

    updateColor(
      id: string,
      data: Attributed & { name?: string; slug?: string; hex?: string | null },
    ) {
      return db.color.update({ where: { id }, data });
    },

    deleteColor(id: string) {
      return db.color.delete({ where: { id } });
    },
  };
}

export type ReferenceRepository = ReturnType<typeof createReferenceRepository>;
