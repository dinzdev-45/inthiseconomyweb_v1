import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const rootEnv = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const devDatabase = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;
if (!devDatabase)
  throw new Error('Set DATABASE_URL (root .env) or E2E_DATABASE_URL for the E2E run.');

const databaseUrl = new URL(devDatabase);
databaseUrl.pathname = '/ite_e2e_store';
const maintenanceUrl = new URL(devDatabase);
maintenanceUrl.pathname = '/postgres';

const apiPort = 4200;
const webPort = 3200;

/**
 * The catalog E2E stack: the API on its own `ite_e2e_store` database and the storefront's
 * production build, on ports separate from dev (4000/3000), admin E2E (4100/3101), and the
 * no-API storefront suite (3100).
 */
export const CATALOG_E2E = {
  webPort,
  webOrigin: `http://localhost:${webPort}`,
  apiUrl: `http://127.0.0.1:${apiPort}`,
  databaseUrl: databaseUrl.toString(),
  maintenanceUrl: maintenanceUrl.toString(),
  /** Images on this host are allowed but never load (the host does not resolve). */
  imageHosts: 'cdn.e2e.test',
  apiEnv: {
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: String(apiPort),
    LOG_LEVEL: 'warn',
    DATABASE_URL: databaseUrl.toString(),
    SESSION_SECRET: 'e2e-only-session-secret-0123456789abcdef',
    ADMIN_ORIGIN: 'http://localhost:3101',
    STORE_CURRENCY: 'IDR',
  },
};
