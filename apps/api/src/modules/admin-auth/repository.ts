import type { PrismaClient } from '@ite/db';

/** Database access for admin authentication. The only Prisma caller in this module. */
export function createAdminAuthRepository(db: PrismaClient) {
  return {
    findUserByEmail(email: string) {
      // `email` is citext, so this match is case-insensitive.
      return db.adminUser.findUnique({ where: { email } });
    },

    findUserById(id: string) {
      return db.adminUser.findUnique({ where: { id } });
    },

    createSession(data: {
      tokenHash: string;
      adminUserId: string;
      createdAt: Date;
      expiresAt: Date;
    }) {
      return db.adminSession.create({ data: { ...data, lastSeenAt: data.createdAt } });
    },

    findSessionWithUser(tokenHash: string) {
      return db.adminSession.findUnique({ where: { tokenHash }, include: { adminUser: true } });
    },

    touchSession(id: string, lastSeenAt: Date) {
      return db.adminSession.update({ where: { id }, data: { lastSeenAt } });
    },

    revokeSession(id: string, revokedAt: Date) {
      return db.adminSession.updateMany({ where: { id, revokedAt: null }, data: { revokedAt } });
    },

    updatePassword(
      id: string,
      data: { passwordHash: string; mustChangePassword: false; updatedById: string | null },
    ) {
      return db.adminUser.update({ where: { id }, data });
    },
  };
}

export type AdminAuthRepository = ReturnType<typeof createAdminAuthRepository>;
