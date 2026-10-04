import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { E2E } from './config.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));

/** Fresh `ite_e2e` database, migrated, with a bootstrapped Owner whose password exists only for this run. */
export default function globalSetup() {
  const psql = (sql: string) =>
    execFileSync('psql', [E2E.maintenanceUrl, '-qc', sql], { stdio: 'pipe' });
  psql('DROP DATABASE IF EXISTS ite_e2e WITH (FORCE)');
  psql('CREATE DATABASE ite_e2e');

  execFileSync(`${root}packages/db/node_modules/.bin/prisma`, ['migrate', 'deploy'], {
    cwd: `${root}packages/db`,
    env: { ...process.env, DATABASE_URL: E2E.databaseUrl },
    stdio: 'pipe',
  });

  const password = randomBytes(18).toString('base64url');
  const bootstrap = spawnSync(
    process.execPath,
    ['src/cli/bootstrap-owner.ts', '--email', E2E.ownerEmail],
    {
      cwd: `${root}apps/api`,
      input: `${password}\n`,
      env: { PATH: process.env.PATH ?? '', NODE_ENV: 'test', DATABASE_URL: E2E.databaseUrl },
      encoding: 'utf8',
    },
  );
  if (bootstrap.status !== 0) throw new Error(`bootstrap-owner failed: ${bootstrap.stderr}`);
  process.env.E2E_OWNER_PASSWORD = password;
}
