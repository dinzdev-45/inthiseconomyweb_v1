import type { PrismaClient } from '@ite/db';
import { withAttribution } from '@ite/db';

import { hashPassword } from './password.ts';

/** Arbitrary constant key for the advisory lock that serializes concurrent bootstrap runs. */
const BOOTSTRAP_LOCK_KEY = 7_014_220_901;

export class BootstrapRefusedError extends Error {
  constructor() {
    super(
      'Staff accounts already exist; refusing to bootstrap. Ask an existing Owner to create accounts.',
    );
    this.name = 'BootstrapRefusedError';
  }
}

/**
 * Creates the first OWNER when no staff accounts exist. Attribution is null
 * because no staff member performed the change.
 */
export async function bootstrapOwner(
  db: PrismaClient,
  { email, password }: { email: string; password: string },
) {
  const passwordHash = await hashPassword(password);
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BOOTSTRAP_LOCK_KEY}::bigint)`;
    if ((await tx.adminUser.count()) > 0) throw new BootstrapRefusedError();
    return tx.adminUser.create({
      data: withAttribution(
        null,
        {
          email,
          passwordHash,
          role: 'OWNER' as const,
          status: 'ACTIVE' as const,
          mustChangePassword: false,
        },
        'create',
      ),
    });
  });
}
