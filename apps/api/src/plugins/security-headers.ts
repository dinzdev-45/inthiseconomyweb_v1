import type { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

type SecurityHeadersOptions = { production: boolean };

const securityHeadersPlugin: FastifyPluginCallback<SecurityHeadersOptions> = (
  app,
  { production },
  done,
) => {
  app.addHook('onSend', (_request, reply, payload, next) => {
    reply.header('x-content-type-options', 'nosniff');
    reply.header('referrer-policy', 'strict-origin-when-cross-origin');
    // HSTS only in production, where the API is served over HTTPS.
    if (production)
      reply.header('strict-transport-security', 'max-age=63072000; includeSubDomains');
    next(null, payload);
  });
  done();
};

/** Baseline security headers on every response (api-conventions: Security headers and CORS). */
export default fp(securityHeadersPlugin, { name: 'security-headers', fastify: '5.x' });
