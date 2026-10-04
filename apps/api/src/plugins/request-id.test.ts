import { PassThrough } from 'node:stream';

import { afterEach, describe, expect, it } from 'vitest';

import type { FastifyInstance } from 'fastify';

import { testEnv } from '../../test/support/env.ts';
import { buildApp } from '../app.ts';

const env = testEnv({ LOG_LEVEL: 'info' });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

let app: FastifyInstance;
let logs: Array<Record<string, unknown>>;

async function start() {
  const stream = new PassThrough();
  logs = [];
  stream.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString().split('\n').filter(Boolean)) logs.push(JSON.parse(line));
  });
  app = await buildApp({ env, logStream: stream });
  app.get('/test/ok', async (request) => {
    request.log.info('handled');
    return { ok: true };
  });
  app.get('/test/fail', async () => {
    throw new Error('boom');
  });
  await app.ready();
}

afterEach(async () => {
  await app.close();
});

describe('api-conventions: Request correlation', () => {
  it('Generated request id', async () => {
    await start();
    const first = await app.inject({ method: 'GET', url: '/test/ok' });
    const second = await app.inject({ method: 'GET', url: '/test/ok' });

    const id = first.headers['x-request-id'];
    expect(id).toMatch(UUID);
    expect(second.headers['x-request-id']).toMatch(UUID);
    expect(second.headers['x-request-id']).not.toBe(id);

    // The same id appears in the error body's `requestId`.
    const failed = await app.inject({ method: 'GET', url: '/test/fail' });
    expect(failed.headers['x-request-id']).toMatch(UUID);
    expect(failed.json().requestId).toBe(failed.headers['x-request-id']);
  });

  it('reuses a well-formed client-supplied X-Request-Id', async () => {
    await start();
    const res = await app.inject({
      method: 'GET',
      url: '/test/ok',
      headers: { 'x-request-id': 'client-trace-123' },
    });
    expect(res.headers['x-request-id']).toBe('client-trace-123');
  });

  it.each([
    ['contains spaces', 'not a valid id'],
    ['is too long', 'a'.repeat(129)],
    ['contains control characters', 'abc\u0007def'],
    ['is empty', ''],
  ])('replaces a client id that %s', async (_label, supplied) => {
    await start();
    const res = await app.inject({
      method: 'GET',
      url: '/test/ok',
      headers: { 'x-request-id': supplied },
    });
    expect(res.headers['x-request-id']).toMatch(UUID);
  });

  it.each([
    ['a 404', '/test/missing', 404],
    ['an error', '/test/fail', 500],
  ])('sets X-Request-Id on %s response', async (_label, url, status) => {
    await start();
    const res = await app.inject({ method: 'GET', url });
    expect(res.statusCode).toBe(status);
    expect(res.headers['x-request-id']).toMatch(UUID);
  });

  it('includes the id in every log entry produced while handling the request', async () => {
    await start();
    const res = await app.inject({
      method: 'GET',
      url: '/test/ok',
      headers: { 'x-request-id': 'trace-abc' },
    });
    expect(res.statusCode).toBe(200);
    const requestLogs = logs.filter(
      (line) => 'req' in line || 'res' in line || line.msg === 'handled',
    );
    expect(requestLogs.length).toBeGreaterThanOrEqual(3);
    for (const line of requestLogs) expect(line.requestId).toBe('trace-abc');
  });
});
