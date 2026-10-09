import { STATUS_CODES } from 'node:http';

import type { ErrorCode, FieldError, ProblemDetails } from '@ite/contracts';
import type { FastifyError, FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import {
  hasZodFastifySchemaValidationErrors,
  type ZodFastifySchemaValidationError,
} from 'fastify-type-provider-zod';

import { DomainError } from '../errors.ts';

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

type ProblemInput = { code?: ErrorCode; detail: string; errors?: FieldError[] };

/** Sends an RFC 7807 problem body carrying the request id. The only way error responses are written. */
export function sendProblem(
  request: FastifyRequest,
  reply: FastifyReply,
  status: number,
  { code, detail, errors }: ProblemInput,
): FastifyReply {
  const body: ProblemDetails = {
    type: 'about:blank',
    title: STATUS_CODES[status] ?? 'Error',
    status,
    detail,
    requestId: request.id,
    ...(code ? { code } : {}),
    ...(errors ? { errors } : {}),
  };
  return reply.code(status).type(PROBLEM_CONTENT_TYPE).send(body);
}

const CONTEXT_PREFIX: Record<string, string> = {
  querystring: 'query',
  params: 'params',
  headers: 'headers',
};

/** Maps validation issues to `{ path, message }`, expanding unknown keys into one entry each. */
export function toFieldErrors(
  issues: ZodFastifySchemaValidationError[],
  context: string | undefined,
): FieldError[] {
  const prefix = context ? CONTEXT_PREFIX[context] : undefined;
  const join = (...parts: string[]) => [prefix, ...parts].filter(Boolean).join('.');

  return issues.flatMap((issue) => {
    const path = issue.instancePath.split('/').filter(Boolean).join('.');
    if (issue.keyword === 'unrecognized_keys' && Array.isArray(issue.params.keys)) {
      return issue.params.keys.map((key) => ({
        path: join(path, String(key)),
        message: `Unknown property "${String(key)}"`,
      }));
    }
    return [{ path: join(path), message: issue.message ?? 'Invalid value' }];
  });
}

const errorHandlerPlugin: FastifyPluginCallback = (app, _opts, done) => {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      return sendProblem(request, reply, 400, {
        code: 'VALIDATION_FAILED',
        detail: 'The request is invalid.',
        errors: toFieldErrors(error.validation, error.validationContext),
      });
    }

    if (error instanceof DomainError) {
      return sendProblem(request, reply, error.status, {
        code: error.code,
        detail: error.detail,
        ...(error.errors ? { errors: error.errors } : {}),
      });
    }

    // Framework-detected client errors (malformed JSON, unsupported media type, body too large).
    const status = error.statusCode;
    if (status !== undefined && status >= 400 && status < 500) {
      return sendProblem(request, reply, status, {
        ...(status === 400 ? { code: 'VALIDATION_FAILED' as const } : {}),
        detail: error.message,
      });
    }

    // Everything else is unexpected: log it in full, return nothing internal.
    request.log.error({ err: error }, 'unhandled error');
    return sendProblem(request, reply, 500, {
      code: 'INTERNAL_ERROR',
      detail: 'An unexpected error occurred.',
    });
  });

  app.setNotFoundHandler((request, reply) =>
    sendProblem(request, reply, 404, {
      code: 'NOT_FOUND',
      detail: 'No endpoint matches this request.',
    }),
  );

  done();
};

/** Central error handling: every error and 404 becomes an `application/problem+json` body. */
export default fp(errorHandlerPlugin, { name: 'error-handler', fastify: '5.x' });
