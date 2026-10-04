import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

const DB_PACKAGE = fileURLToPath(new URL('../../../../packages/db/', import.meta.url));
const PRISMA_BIN = `${DB_PACKAGE}node_modules/.bin/prisma`;

/** Starts a throwaway PostgreSQL 16 container (the same image as docker-compose.yml). */
export async function startPostgres(): Promise<StartedPostgreSqlContainer> {
  return new PostgreSqlContainer('postgres:16-alpine').start();
}

/** Applies the committed Prisma migrations to the given database. */
export function migrate(databaseUrl: string): void {
  const result = spawnSync(PRISMA_BIN, ['migrate', 'deploy'], {
    cwd: DB_PACKAGE,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`prisma migrate deploy failed:\n${result.stdout}\n${result.stderr}`);
  }
}
