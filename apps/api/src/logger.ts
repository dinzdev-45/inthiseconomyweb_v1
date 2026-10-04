import type { FastifyServerOptions } from 'fastify';

import type { Env } from './env.ts';

const PASSWORD_FIELDS = [
  'password',
  'currentPassword',
  'newPassword',
  'temporaryPassword',
  'passwordHash',
];

/** Log paths whose values are replaced before any log line is written. */
export const REDACT_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'res.headers["set-cookie"]',
  'headers.cookie',
  'headers.authorization',
  ...PASSWORD_FIELDS,
  ...PASSWORD_FIELDS.map((field) => `*.${field}`),
];

export function loggerOptions(
  env: Pick<Env, 'LOG_LEVEL'>,
  stream?: NodeJS.WritableStream,
): FastifyServerOptions['logger'] {
  return {
    level: env.LOG_LEVEL,
    redact: { paths: REDACT_PATHS, censor: '[Redacted]' },
    ...(stream ? { stream } : {}),
  };
}
