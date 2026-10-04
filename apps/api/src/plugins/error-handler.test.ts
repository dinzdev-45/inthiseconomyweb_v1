import { ProblemDetails } from '@ite/contracts';
import { PassThrough } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { buildTestApp } from '../../test/support/app.ts';
import { testEnv } from '../../test/support/env.ts';
import { DomainError } from '../errors.ts';

let app: FastifyInstance;
afterEach(async () => app?.close());

function expectProblem(res: { headers: Record<string, unknown>; json: () => unknown }) {
  expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
  const body = ProblemDetails.parse(res.json());
  expect(body.requestId).toBe(res.headers['x-request-id']);
  return body;
}

describe('api-conventions: Uniform error format', () => {
  it('Unhandled server error', async () => {
    const logs: Array<Record<string, unknown>> = [];
    const stream = new PassThrough();
    stream.on('data', (chunk: Buffer) => {
      for (const line of chunk.toString().split('\n').filter(Boolean)) logs.push(JSON.parse(line));
    });
    app = await buildTestApp({
      env: testEnv({ LOG_LEVEL: 'info' }),
      logStream: stream,
      setup: (a) =>
        a.get('/test/crash', async () => {
          throw new Error('connection to 10.0.0.5 failed: SELECT * FROM admin_users');
        }),
    });

    const res = await app.inject({ method: 'GET', url: '/test/crash' });

    expect(res.statusCode).toBe(500);
    const body = expectProblem(res);
    expect(body).toMatchObject({ code: 'INTERNAL_ERROR', detail: 'An unexpected error occurred.' });
    expect(res.body).not.toMatch(/10\.0\.0\.5|SELECT|admin_users|stack|at /);

    const logged = logs.find((line) => line.msg === 'unhandled error');
    expect(logged?.requestId).toBe(body.requestId);
    expect(JSON.stringify(logged)).toContain('SELECT * FROM admin_users');
  });

  it('Domain error', async () => {
    app = await buildTestApp({
      setup: (a) =>
        a.post('/test/demote', async () => {
          throw new DomainError('LAST_OWNER', 409, 'At least one active owner is required.');
        }),
    });

    const res = await app.inject({ method: 'POST', url: '/test/demote' });

    expect(res.statusCode).toBe(409);
    expect(expectProblem(res)).toEqual({
      type: 'about:blank',
      title: 'Conflict',
      status: 409,
      detail: 'At least one active owner is required.',
      code: 'LAST_OWNER',
      requestId: res.headers['x-request-id'],
    });
  });

  it('Unknown route', async () => {
    app = await buildTestApp();

    for (const url of ['/api/v1/does-not-exist', '/api/v1/store/nope', '/nope']) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode).toBe(404);
      expect(expectProblem(res).code).toBe('NOT_FOUND');
    }
  });

  it('returns malformed JSON as a 400 problem', async () => {
    app = await buildTestApp({ setup: (a) => a.post('/test/echo', async () => ({ ok: true })) });

    const res = await app.inject({
      method: 'POST',
      url: '/test/echo',
      headers: { 'content-type': 'application/json' },
      payload: '{"email":',
    });

    expect(res.statusCode).toBe(400);
    expect(expectProblem(res).code).toBe('VALIDATION_FAILED');
  });
});
