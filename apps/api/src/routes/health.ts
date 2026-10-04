import { HealthResponse, ReadyResponse } from '@ite/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { DomainError } from '../errors.ts';

const READY_TIMEOUT_MS = 2_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * GET /health — the process is alive (no dependency checks).
 * GET /ready — the database is reachable. Neither reveals versions, config, or hostnames.
 */
export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/health', { schema: { response: { 200: HealthResponse } } }, async () => ({
    status: 'ok' as const,
  }));

  app.get('/ready', { schema: { response: { 200: ReadyResponse } } }, async (request) => {
    try {
      await withTimeout(app.db.$queryRaw`SELECT 1`, READY_TIMEOUT_MS);
    } catch (error) {
      request.log.warn({ err: error }, 'readiness check failed: database unreachable');
      throw new DomainError('SERVICE_UNAVAILABLE', 503, 'The service is not ready.');
    }
    return { status: 'ready' as const };
  });
};
