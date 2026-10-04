import type { FastifyInstance } from 'fastify';

import { buildApp, type BuildAppOptions } from '../../src/app.ts';
import { testEnv } from './env.ts';

/** Builds a ready app with the test env; extra routes are registered before `ready()`. */
export async function buildTestApp(
  options: Partial<BuildAppOptions> & { setup?: (app: FastifyInstance) => void } = {},
): Promise<FastifyInstance> {
  const { setup, ...rest } = options;
  const app = await buildApp({ env: testEnv(), ...rest });
  setup?.(app);
  await app.ready();
  return app;
}
