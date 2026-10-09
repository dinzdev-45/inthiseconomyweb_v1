import type { PrismaClient } from '@ite/db';
import type { FastifyInstance } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { buildApp } from '../../src/app.ts';
import { hashPassword } from '../../src/modules/admin-auth/password.ts';
import { createPrismaClient } from '@ite/db';
import { testEnv, TEST_ENV_SOURCE } from './env.ts';
import { createTestDatabase } from './database.ts';

export const ADMIN_ORIGIN = TEST_ENV_SOURCE.ADMIN_ORIGIN;
export const LOGIN_URL = '/api/v1/admin/auth/login';

/** A clock tests can move forward. */
export class FakeClock {
  #now: number;
  constructor(start = Date.parse('2026-10-02T09:00:00.000Z')) {
    this.#now = start;
  }
  now = () => new Date(this.#now);
  advance(ms: number) {
    this.#now += ms;
  }
}

export const minutes = (n: number) => n * 60 * 1000;

/** A test-only admin route that requires a full (non-temporary) session. */
const probeRoutes: FastifyPluginAsyncZod = async (admin) => {
  admin.get('/test/probe', { config: { permission: 'authenticated' } }, async () => ({
    ok: true,
  }));
};

export type AuthHarness = {
  app: FastifyInstance;
  db: PrismaClient;
  clock: FakeClock;
  close: () => Promise<void>;
};

/** An app on its own migrated database with a fake clock. */
export async function createAuthHarness(
  env: Record<string, string> = {},
  { logStream }: { logStream?: NodeJS.WritableStream } = {},
): Promise<AuthHarness> {
  const url = await createTestDatabase();
  const clock = new FakeClock();
  const app = await buildApp({
    env: testEnv({ DATABASE_URL: url, ...env }),
    clock,
    ...(logStream ? { logStream } : {}),
    routes: { admin: [probeRoutes] },
  });
  await app.ready();
  const db = createPrismaClient(url);
  return {
    app,
    db,
    clock,
    close: async () => {
      await app.close();
      await db.$disconnect();
    },
  };
}

export async function createStaff(
  db: PrismaClient,
  {
    email,
    password,
    role = 'ADMIN',
    status = 'ACTIVE',
    mustChangePassword = false,
  }: {
    email: string;
    password: string;
    role?: 'OWNER' | 'ADMIN';
    status?: 'ACTIVE' | 'DEACTIVATED';
    mustChangePassword?: boolean;
  },
) {
  return db.adminUser.create({
    data: { email, passwordHash: await hashPassword(password), role, status, mustChangePassword },
  });
}

export function login(
  app: FastifyInstance,
  email: string,
  password: string,
  { ip = '203.0.113.10', origin = ADMIN_ORIGIN }: { ip?: string; origin?: string | null } = {},
) {
  return app.inject({
    method: 'POST',
    url: LOGIN_URL,
    remoteAddress: ip,
    headers: origin ? { origin } : {},
    payload: { email, password },
  });
}

/** The `name=value` pair to send back as a Cookie header. */
export function sessionCookie(res: { headers: Record<string, unknown> }): string {
  const header = res.headers['set-cookie'];
  const first = Array.isArray(header) ? header[0] : header;
  if (typeof first !== 'string') throw new Error('response did not set a cookie');
  return first.split(';')[0]!;
}
