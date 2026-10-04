import { ProblemDetails } from '@ite/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { afterEach, describe, expect, it } from 'vitest';

import { buildTestApp } from '../../test/support/app.ts';
import {
  ADMIN_ORIGIN,
  createAuthHarness,
  createStaff,
  LOGIN_URL,
  type AuthHarness,
} from '../../test/support/auth.ts';
import { testEnv } from '../../test/support/env.ts';
import { parseEnv } from '../env.ts';
import type { FastifyInstance } from 'fastify';

const PROXY = '127.0.0.1';
const CLIENT = '198.51.100.7';
const UNTRUSTED = '203.0.113.5';

const whoAmI: FastifyPluginAsyncZod = async (zone) => {
  zone.get('/test/ip', async (request) => ({ ip: request.ip }));
};

let app: FastifyInstance | undefined;
afterEach(async () => app?.close());

const ipOf = async (remoteAddress: string, forwardedFor?: string) => {
  const res = await app!.inject({
    method: 'GET',
    url: '/api/v1/store/test/ip',
    remoteAddress,
    headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : {},
  });
  return res.json().ip as string;
};

describe('TRUST_PROXY parsing', () => {
  const parse = (value?: string) =>
    parseEnv({ ...testEnv(), PORT: '4000', TRUST_PROXY: value } as never).TRUST_PROXY;

  it('trusts nothing by default', () => {
    expect(parse(undefined)).toBe(false);
    expect(parse('')).toBe(false);
  });

  it('accepts addresses, CIDRs, keywords, and hop counts', () => {
    expect(parse('127.0.0.1, 10.0.0.0/8, ::1, loopback')).toEqual([
      '127.0.0.1',
      '10.0.0.0/8',
      '::1',
      'loopback',
    ]);
    expect(parse('1')).toBe(1);
  });

  it.each(['true', '*', '0', '11', '10.0.0.0/33', 'example.com', '127.0.0.1,'])(
    'rejects %j',
    (value) => {
      expect(() => parse(value)).toThrow(/TRUST_PROXY: /);
    },
  );
});

describe('client IP resolution', () => {
  it('ignores X-Forwarded-For when no proxy is trusted', async () => {
    app = await buildTestApp({ routes: { store: [whoAmI] } });
    expect(await ipOf(PROXY, CLIENT)).toBe(PROXY);
  });

  it('uses X-Forwarded-For from a trusted proxy', async () => {
    app = await buildTestApp({ env: testEnv({ TRUST_PROXY: PROXY }), routes: { store: [whoAmI] } });
    expect(await ipOf(PROXY, CLIENT)).toBe(CLIENT);
    // A client-supplied value in front of the proxy's entry is not believed.
    expect(await ipOf(PROXY, `6.6.6.6, ${CLIENT}`)).toBe(CLIENT);
  });

  it('trusts exactly the configured number of hops', async () => {
    app = await buildTestApp({ env: testEnv({ TRUST_PROXY: '1' }), routes: { store: [whoAmI] } });
    expect(await ipOf(PROXY, `6.6.6.6, ${CLIENT}`)).toBe(CLIENT);
  });

  it('ignores the same header from an untrusted address', async () => {
    app = await buildTestApp({ env: testEnv({ TRUST_PROXY: PROXY }), routes: { store: [whoAmI] } });
    expect(await ipOf(UNTRUSTED, CLIENT)).toBe(UNTRUSTED);
  });
});

describe('login rate limiting through the admin proxy', () => {
  let h: AuthHarness;
  afterEach(async () => h?.close());

  const attempt = (remoteAddress: string, forwardedFor: string, password: string) =>
    h.app.inject({
      method: 'POST',
      url: LOGIN_URL,
      remoteAddress,
      headers: { origin: ADMIN_ORIGIN, 'x-forwarded-for': forwardedFor },
      payload: { email: 'owner@example.com', password },
    });

  it('limits each client behind a trusted proxy separately', async () => {
    h = await createAuthHarness({ TRUST_PROXY: PROXY });
    await createStaff(h.db, { email: 'owner@example.com', password: 'correct-horse-battery' });

    for (let i = 0; i < 10; i++) await attempt(PROXY, CLIENT, 'wrong-password!');
    const limited = await attempt(PROXY, CLIENT, 'correct-horse-battery');
    expect(limited.statusCode).toBe(429);
    expect(ProblemDetails.parse(limited.json()).code).toBe('RATE_LIMITED');

    // Another user behind the same proxy is not affected.
    expect((await attempt(PROXY, '198.51.100.8', 'correct-horse-battery')).statusCode).toBe(200);
  });

  it('keys an untrusted client by its real address even if it rotates X-Forwarded-For', async () => {
    h = await createAuthHarness({ TRUST_PROXY: PROXY });
    await createStaff(h.db, { email: 'owner@example.com', password: 'correct-horse-battery' });

    for (let i = 0; i < 10; i++) await attempt(UNTRUSTED, `192.0.2.${i}`, 'wrong-password!');
    expect((await attempt(UNTRUSTED, '192.0.2.99', 'correct-horse-battery')).statusCode).toBe(429);
  });
});
