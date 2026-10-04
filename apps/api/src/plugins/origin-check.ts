import type { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import { DomainError } from '../errors.ts';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

type OriginCheckOptions = { allowedOrigin: string };

const originCheckPlugin: FastifyPluginCallback<OriginCheckOptions> = (
  app,
  { allowedOrigin },
  done,
) => {
  app.addHook('onRequest', async (request) => {
    if (MUTATING_METHODS.has(request.method) && request.headers.origin !== allowedOrigin) {
      throw new DomainError('FORBIDDEN', 403, 'Cross-site request rejected.');
    }
  });
  done();
};

/**
 * Rejects state-changing requests whose `Origin` is missing or not the admin
 * origin (design D8). Registered inside the admin zone only.
 */
export default fp(originCheckPlugin, { name: 'origin-check', fastify: '5.x' });
