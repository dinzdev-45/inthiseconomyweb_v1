import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const rootEnv = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const devDatabase = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;
if (!devDatabase)
  throw new Error('Set DATABASE_URL (root .env) or E2E_DATABASE_URL for the E2E run.');

const databaseUrl = new URL(devDatabase);
databaseUrl.pathname = '/ite_e2e';
const maintenanceUrl = new URL(devDatabase);
maintenanceUrl.pathname = '/postgres';

const apiPort = 4100;
const adminPort = 3101;

/** Ports and settings for the E2E stack; separate from dev (4000/3001) and its database. */
export const E2E = {
  adminPort,
  adminOrigin: `http://localhost:${adminPort}`,
  apiUrl: `http://127.0.0.1:${apiPort}`,
  databaseUrl: databaseUrl.toString(),
  maintenanceUrl: maintenanceUrl.toString(),
  ownerEmail: 'owner@e2e.test',
  apiEnv: {
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: String(apiPort),
    LOG_LEVEL: 'warn',
    DATABASE_URL: databaseUrl.toString(),
    SESSION_SECRET: 'e2e-only-session-secret-0123456789abcdef',
    ADMIN_ORIGIN: `http://localhost:${adminPort}`,
    TRUST_PROXY: 'loopback',
  },
};
