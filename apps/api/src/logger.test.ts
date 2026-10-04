import { PassThrough } from 'node:stream';

import { describe, expect, it } from 'vitest';

import type { FastifyInstance } from 'fastify';

import { testEnv } from '../test/support/env.ts';
import { buildApp } from './app.ts';

const env = testEnv({ LOG_LEVEL: 'info' });

async function logLine(write: (app: FastifyInstance) => void): Promise<string> {
  const stream = new PassThrough();
  const chunks: string[] = [];
  stream.on('data', (chunk: Buffer) => chunks.push(chunk.toString()));
  const app = await buildApp({ env, logStream: stream });
  write(app);
  await app.close();
  return chunks.join('');
}

describe('logger redaction', () => {
  it('never writes request cookies or authorization headers', async () => {
    const line = await logLine((app) =>
      app.log.info({
        req: { headers: { cookie: 'ite_admin_session=abc123', authorization: 'Bearer xyz789' } },
      }),
    );
    expect(line).not.toContain('abc123');
    expect(line).not.toContain('xyz789');
  });

  it('redacts cookies and authorization headers in logged header objects', async () => {
    const line = await logLine((app) =>
      app.log.info({
        headers: { cookie: 'ite_admin_session=abc123', authorization: 'Bearer xyz789' },
      }),
    );
    expect(line).not.toContain('abc123');
    expect(line).not.toContain('xyz789');
    expect(line).toContain('"cookie":"[Redacted]"');
    expect(line).toContain('"authorization":"[Redacted]"');
  });

  it('redacts Set-Cookie on responses', async () => {
    const line = await logLine((app) =>
      app.log.info({ res: { headers: { 'set-cookie': 'ite_admin_session=abc123' } } }),
    );
    expect(line).not.toContain('abc123');
  });

  it('redacts password fields at the top level and one level deep', async () => {
    const line = await logLine((app) =>
      app.log.info({
        password: 'p1-secret',
        body: { currentPassword: 'p2-secret', newPassword: 'p3-secret' },
        staff: { temporaryPassword: 'p4-secret', passwordHash: '$argon2id$p5-secret' },
      }),
    );
    for (const secret of ['p1-secret', 'p2-secret', 'p3-secret', 'p4-secret', 'p5-secret']) {
      expect(line).not.toContain(secret);
    }
  });

  it('keeps non-sensitive fields', async () => {
    const line = await logLine((app) => app.log.info({ email: 'owner@example.com' }, 'login'));
    expect(line).toContain('owner@example.com');
  });
});
