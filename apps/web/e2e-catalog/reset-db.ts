import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { CATALOG_E2E } from './config.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));

/** A fresh `ite_e2e_store` database: migrated, dev catalog seeded, then the E2E fixtures. */
export default function globalSetup() {
  const psql = (...args: string[]) => execFileSync('psql', args, { stdio: 'pipe' });
  psql(CATALOG_E2E.maintenanceUrl, '-qc', 'DROP DATABASE IF EXISTS ite_e2e_store WITH (FORCE)');
  psql(CATALOG_E2E.maintenanceUrl, '-qc', 'CREATE DATABASE ite_e2e_store');

  const env = {
    PATH: process.env.PATH ?? '',
    NODE_ENV: 'test' as const,
    DATABASE_URL: CATALOG_E2E.databaseUrl,
    STORE_CURRENCY: 'IDR',
  };
  execFileSync(`${root}packages/db/node_modules/.bin/prisma`, ['migrate', 'deploy'], {
    cwd: `${root}packages/db`,
    env,
    stdio: 'pipe',
  });
  execFileSync(process.execPath, ['prisma/seed.ts'], {
    cwd: `${root}packages/db`,
    env,
    stdio: 'pipe',
  });
  psql(
    CATALOG_E2E.databaseUrl,
    '-q',
    '-v',
    'ON_ERROR_STOP=1',
    '-f',
    fileURLToPath(new URL('./fixtures.sql', import.meta.url)),
  );
}
