import { ProblemDetails } from '@ite/contracts';
import { Id } from '@ite/contracts';
import { createPrismaClient, withAttribution } from '@ite/db';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestApp } from '../../test/support/app.ts';
import { testEnv } from '../../test/support/env.ts';
import { migrate, startPostgres } from '../../test/support/postgres.ts';

const CONTAINER_TIMEOUT = 120_000;

describe('api-conventions: Health and readiness', () => {
  let container: StartedPostgreSqlContainer;
  let app: FastifyInstance;

  beforeAll(async () => {
    container = await startPostgres();
    app = await buildTestApp({ env: testEnv({ DATABASE_URL: container.getConnectionUri() }) });
  }, CONTAINER_TIMEOUT);

  afterAll(async () => {
    await app?.close();
    await container?.stop().catch(() => undefined);
  });

  it(
    'Database unavailable',
    async () => {
      // Reachable database: alive and ready.
      expect((await app.inject({ method: 'GET', url: '/health' })).json()).toEqual({
        status: 'ok',
      });
      const ready = await app.inject({ method: 'GET', url: '/ready' });
      expect(ready.statusCode).toBe(200);
      expect(ready.json()).toEqual({ status: 'ready' });

      await container.stop();

      const health = await app.inject({ method: 'GET', url: '/health' });
      expect(health.statusCode).toBe(200);

      const notReady = await app.inject({ method: 'GET', url: '/ready' });
      expect(notReady.statusCode).toBe(503);
      expect(ProblemDetails.parse(notReady.json()).code).toBe('SERVICE_UNAVAILABLE');
      // No hostnames, ports, versions, or configuration in either body.
      const host = container.getHost();
      for (const body of [health.body, notReady.body]) {
        expect(body).not.toContain(host);
        expect(body).not.toMatch(/postgres|5432|version/i);
      }
    },
    CONTAINER_TIMEOUT,
  );
});

describe('api-conventions: Money and identifier representation', () => {
  let container: StartedPostgreSqlContainer;

  beforeAll(async () => {
    container = await startPostgres();
    migrate(container.getConnectionUri());
  }, CONTAINER_TIMEOUT);

  afterAll(async () => {
    await container?.stop();
  });

  it(
    'Non-sequential identifiers',
    async () => {
      const db = createPrismaClient(container.getConnectionUri());
      try {
        const create = (email: string) =>
          db.adminUser.create({
            data: withAttribution(
              null,
              { email, passwordHash: 'x', role: 'ADMIN' as const },
              'create',
            ),
          });
        const first = await create('first@example.com');
        const second = await create('second@example.com');

        for (const { id } of [first, second]) {
          expect(Id.safeParse(id).success).toBe(true);
          expect(id).not.toMatch(/^\d+$/);
        }
        expect(second.id).not.toBe(first.id);
        // Time-ordered but not consecutive: the random part differs, so ids cannot be guessed by incrementing.
        expect(second.id > first.id).toBe(true);
        expect(second.id.slice(14)).not.toBe(first.id.slice(14));
      } finally {
        await db.$disconnect();
      }
    },
    CONTAINER_TIMEOUT,
  );
});
