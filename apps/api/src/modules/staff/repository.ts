import type { AdminRole, AdminStatus, PrismaClient } from '@ite/db';

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

/** Database access for staff management. The only Prisma caller in this module. */
export function createStaffRepository(db: PrismaClient) {
  return {
    list() {
      return db.adminUser.findMany({ orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    },

    create(data: {
      email: string;
      passwordHash: string;
      role: AdminRole;
      mustChangePassword: true;
      createdAt: Date;
      updatedAt: Date;
      createdById: string | null;
      updatedById: string | null;
    }) {
      return db.adminUser.create({ data });
    },

    /** Runs `fn` in a transaction (READ COMMITTED). */
    transaction<T>(fn: (tx: Tx) => Promise<T>) {
      return db.$transaction(fn);
    },

    findById(tx: Tx, id: string) {
      return tx.adminUser.findUnique({ where: { id } });
    },

    /**
     * Locks every active OWNER row until the transaction ends, in a fixed order
     * so concurrent callers cannot deadlock. A caller blocked here re-reads the
     * rows after the other transaction commits, so it sees the new owner set.
     */
    lockActiveOwnerIds(tx: Tx): Promise<string[]> {
      return tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM admin_users
        WHERE role = 'OWNER' AND status = 'ACTIVE'
        ORDER BY id
        FOR UPDATE
      `.then((rows) => rows.map((row) => row.id));
    },

    update(
      tx: Tx,
      id: string,
      data: { role?: AdminRole; status?: AdminStatus; updatedAt: Date; updatedById: string | null },
    ) {
      return tx.adminUser.update({ where: { id }, data });
    },

    revokeSessions(tx: Tx, adminUserId: string, revokedAt: Date) {
      return tx.adminSession.updateMany({
        where: { adminUserId, revokedAt: null },
        data: { revokedAt },
      });
    },
  };
}

export type StaffRepository = ReturnType<typeof createStaffRepository>;
