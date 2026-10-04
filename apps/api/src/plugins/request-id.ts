import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

import type { FastifyPluginCallback, FastifyServerOptions } from 'fastify';
import fp from 'fastify-plugin';

export const REQUEST_ID_HEADER = 'x-request-id';

/** Client-supplied ids are reused only if they look like an id: short, no spaces or control characters. */
const WELL_FORMED = /^[A-Za-z0-9._:-]{1,128}$/;

/** Reuses a well-formed client `X-Request-Id`, otherwise generates a new one. */
export function genRequestId(req: IncomingMessage): string {
  const supplied = req.headers[REQUEST_ID_HEADER];
  return typeof supplied === 'string' && WELL_FORMED.test(supplied) ? supplied : randomUUID();
}

/**
 * Server options for request ids. Fastify's built-in header reuse is turned
 * off because it accepts any value; genRequestId validates it instead. Every
 * request-scoped log line carries the id as `requestId`.
 */
export const requestIdServerOptions = {
  requestIdHeader: false,
  genReqId: genRequestId,
  requestIdLogLabel: 'requestId',
} satisfies Partial<FastifyServerOptions>;

const requestIdPlugin: FastifyPluginCallback = (app, _opts, done) => {
  // onSend runs for every reply, including 404s and errors.
  app.addHook('onSend', (request, reply, payload, next) => {
    reply.header(REQUEST_ID_HEADER, request.id);
    next(null, payload);
  });
  done();
};

/** Echoes the request id on every response as `X-Request-Id`. */
export default fp(requestIdPlugin, { name: 'request-id', fastify: '5.x' });
