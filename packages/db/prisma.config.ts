import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { defineConfig, env } from 'prisma/config';

// Local development reads the repo-root .env (see .env.example).
// CI and deployed environments provide DATABASE_URL directly.
const rootEnv = fileURLToPath(new URL('../../.env', import.meta.url));
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'node prisma/seed.ts' },
  datasource: { url: env('DATABASE_URL') },
});
