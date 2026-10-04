import { randomUUID } from 'node:crypto';

import { createPrismaClient, type PrismaClient } from '@ite/db';
import { inject } from 'vitest';

/** Creates an empty, fully migrated database (cloned from the run's template) and returns its URL. */
export async function createTestDatabase(): Promise<string> {
  const name = `t_${randomUUID().replaceAll('-', '')}`;
  const admin = createPrismaClient(inject('pgAdminUrl'));
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${name}" TEMPLATE "${inject('pgTemplate')}"`);
  } finally {
    await admin.$disconnect();
  }
  const url = new URL(inject('pgAdminUrl'));
  url.pathname = `/${name}`;
  return url.toString();
}

export type { PrismaClient };
