import { parseEnv } from '../../src/env.ts';

/** A complete, valid environment for tests. Values are test-only. */
export const TEST_ENV_SOURCE = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://ite:pw@localhost:5433/inthiseconomy',
  SESSION_SECRET: 'a'.repeat(32),
  ADMIN_ORIGIN: 'http://localhost:3001',
  LOG_LEVEL: 'silent',
} as const;

export function testEnv(overrides: Record<string, string> = {}) {
  return parseEnv({ ...TEST_ENV_SOURCE, ...overrides });
}
