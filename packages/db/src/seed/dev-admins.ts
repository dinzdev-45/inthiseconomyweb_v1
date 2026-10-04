import { hash, verify } from '@node-rs/argon2';

import { withAttribution } from '../attribution.ts';
import type { AdminRole, PrismaClient } from '../generated/prisma/client.ts';

/**
 * Local development staff accounts with known passwords. These exist only to
 * sign in to a local admin; the seed refuses to run in production.
 */
export const DEV_ADMINS: ReadonlyArray<{ email: string; password: string; role: AdminRole }> = [
  { email: 'owner@inthiseconomy.local', password: 'dev-owner-password', role: 'OWNER' },
  { email: 'admin@inthiseconomy.local', password: 'dev-admin-password', role: 'ADMIN' },
];

/** Throws unless the environment allows seeding development data. */
export function assertSeedAllowed(env: Record<string, string | undefined>): void {
  if (env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed development data: NODE_ENV is "production".');
  }
}

export type SeedResult = { email: string; action: 'created' | 'updated' | 'unchanged' };

/**
 * Ensures each dev account exists, is ACTIVE, has its role, and accepts its
 * known password. Re-running leaves already-correct accounts untouched.
 * Changes are attributed to the system (null actor).
 */
export async function seedDevAdmins(prisma: PrismaClient): Promise<SeedResult[]> {
  const results: SeedResult[] = [];

  for (const { email, password, role } of DEV_ADMINS) {
    const existing = await prisma.adminUser.findUnique({ where: { email } });

    if (!existing) {
      await prisma.adminUser.create({
        data: withAttribution(
          null,
          { email, passwordHash: await hash(password), role, mustChangePassword: false },
          'create',
        ),
      });
      results.push({ email, action: 'created' });
      continue;
    }

    const inExpectedState =
      existing.role === role &&
      existing.status === 'ACTIVE' &&
      !existing.mustChangePassword &&
      (await verify(existing.passwordHash, password));

    if (inExpectedState) {
      results.push({ email, action: 'unchanged' });
      continue;
    }

    await prisma.adminUser.update({
      where: { id: existing.id },
      data: withAttribution(
        null,
        {
          passwordHash: await hash(password),
          role,
          status: 'ACTIVE' as const,
          mustChangePassword: false,
        },
        'update',
      ),
    });
    results.push({ email, action: 'updated' });
  }

  return results;
}
