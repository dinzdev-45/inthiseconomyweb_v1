import { CurrentStaff, ProblemDetails } from '@ite/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createAuthHarness,
  createStaff,
  login,
  minutes,
  type AuthHarness,
} from '../../../test/support/auth.ts';

const PASSWORD = 'correct-horse-battery';
let h: AuthHarness;

beforeEach(async () => {
  h = await createAuthHarness();
  await createStaff(h.db, { email: 'owner@example.com', password: PASSWORD, role: 'OWNER' });
});
afterEach(async () => h.close());

/** Problem body without the per-request id, for comparing failures. */
const withoutRequestId = (body: Record<string, unknown>) => {
  const { requestId: _requestId, ...rest } = body;
  return rest;
};

describe('admin-authentication: Email and password login', () => {
  it('Successful login', async () => {
    const res = await login(h.app, 'owner@example.com', PASSWORD);

    expect(res.statusCode).toBe(200);
    expect(CurrentStaff.parse(res.json())).toMatchObject({
      email: 'owner@example.com',
      role: 'OWNER',
      permissions: ['admin:access', 'staff:read', 'staff:manage', 'catalog:read', 'catalog:manage'],
      mustChangePassword: false,
    });
    expect(res.headers['set-cookie']).toMatch(/^ite_admin_session=/);
    expect(await h.db.adminSession.count()).toBe(1);
  });

  it('accepts the email in any letter case', async () => {
    expect((await login(h.app, 'OWNER@Example.com', PASSWORD)).statusCode).toBe(200);
  });

  it('Wrong password', async () => {
    const res = await login(h.app, 'owner@example.com', 'not-the-password');

    expect(res.statusCode).toBe(401);
    expect(ProblemDetails.parse(res.json())).toMatchObject({
      code: 'INVALID_CREDENTIALS',
      detail: 'Invalid email or password.',
    });
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(await h.db.adminSession.count()).toBe(0);
  });

  it('Unknown email', async () => {
    const wrong = await login(h.app, 'owner@example.com', 'not-the-password');
    const unknown = await login(h.app, 'nobody@example.com', 'not-the-password');

    expect(unknown.statusCode).toBe(wrong.statusCode);
    expect(withoutRequestId(unknown.json())).toEqual(withoutRequestId(wrong.json()));
    expect(unknown.headers['set-cookie']).toBeUndefined();
  });

  it('takes comparable time for unknown email, wrong password, and deactivated account', async () => {
    await createStaff(h.db, {
      email: 'gone@example.com',
      password: PASSWORD,
      status: 'DEACTIVATED',
    });
    const cases = {
      wrongPassword: () =>
        login(h.app, 'owner@example.com', 'not-the-password', { ip: '198.51.100.1' }),
      unknownEmail: () =>
        login(h.app, 'nobody@example.com', 'not-the-password', { ip: '198.51.100.2' }),
      deactivated: () => login(h.app, 'gone@example.com', PASSWORD, { ip: '198.51.100.3' }),
    };
    const samples: Record<string, number[]> = {
      wrongPassword: [],
      unknownEmail: [],
      deactivated: [],
    };

    for (let round = 0; round < 7; round++) {
      for (const [name, run] of Object.entries(cases)) {
        const start = performance.now();
        expect((await run()).statusCode).toBe(401);
        samples[name]!.push(performance.now() - start);
      }
    }

    const medians = Object.values(samples).map((s) => s.sort((a, b) => a - b)[3]!);
    // Each path performs exactly one Argon2id verification; allow generous jitter.
    expect(Math.max(...medians) / Math.min(...medians)).toBeLessThan(2);
  });

  it('Deactivated account', async () => {
    await createStaff(h.db, {
      email: 'gone@example.com',
      password: PASSWORD,
      status: 'DEACTIVATED',
    });
    const wrong = await login(h.app, 'owner@example.com', 'not-the-password');

    const res = await login(h.app, 'gone@example.com', PASSWORD);

    expect(res.statusCode).toBe(401);
    expect(withoutRequestId(res.json())).toEqual(withoutRequestId(wrong.json()));
    expect(await h.db.adminSession.count()).toBe(0);
  });

  it('replaces a session presented with a new login', async () => {
    const first = await login(h.app, 'owner@example.com', PASSWORD);
    const cookie = first.headers['set-cookie'] as string;
    await h.app.inject({
      method: 'POST',
      url: '/api/v1/admin/auth/login',
      remoteAddress: '203.0.113.10',
      headers: { origin: 'http://localhost:3001', cookie: cookie.split(';')[0]! },
      payload: { email: 'owner@example.com', password: PASSWORD },
    });
    const sessions = await h.db.adminSession.findMany({ orderBy: { createdAt: 'asc' } });
    expect(sessions).toHaveLength(2);
    expect(sessions.filter((s) => s.revokedAt === null)).toHaveLength(1);
  });
});

describe('admin-authentication: Secure server-side sessions', () => {
  it('Cookie attributes', async () => {
    const cookie = (await login(h.app, 'owner@example.com', PASSWORD)).headers[
      'set-cookie'
    ] as string;

    expect(cookie).toMatch(/^ite_admin_session=[A-Za-z0-9_-]{43};/);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('Path=/');
    expect(cookie).not.toMatch(/Domain=/i);

    // Only a hash of the token is stored.
    const token = cookie.split(';')[0]!.split('=')[1]!;
    const [session] = await h.db.adminSession.findMany();
    expect(session!.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(session!.tokenHash).not.toContain(token);
  });

  it('omits Secure only in local development', async () => {
    const dev = await createAuthHarness({ NODE_ENV: 'development' });
    try {
      await createStaff(dev.db, { email: 'dev@example.com', password: PASSWORD });
      const cookie = (await login(dev.app, 'dev@example.com', PASSWORD)).headers['set-cookie'];
      expect(cookie).toContain('HttpOnly');
      expect(cookie).not.toContain('Secure');
    } finally {
      await dev.close();
    }
  });
});

describe('admin-authentication: Login rate limiting', () => {
  it('Too many attempts', async () => {
    for (let attempt = 1; attempt <= 10; attempt++) {
      expect((await login(h.app, 'owner@example.com', 'wrong-password!')).statusCode).toBe(401);
    }

    const res = await login(h.app, 'owner@example.com', PASSWORD);

    expect(res.statusCode).toBe(429);
    expect(ProblemDetails.parse(res.json()).code).toBe('RATE_LIMITED');
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    expect(Number(res.headers['retry-after'])).toBeLessThanOrEqual(15 * 60);
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(await h.db.adminSession.count()).toBe(0);
  });

  it('Limit window passes', async () => {
    for (let attempt = 1; attempt <= 11; attempt++) {
      await login(h.app, 'owner@example.com', 'wrong-password!');
    }
    expect((await login(h.app, 'owner@example.com', PASSWORD)).statusCode).toBe(429);

    h.clock.advance(minutes(15));

    expect((await login(h.app, 'owner@example.com', PASSWORD)).statusCode).toBe(200);
  });

  it('limits a single IP to 50 attempts across all emails', async () => {
    for (let attempt = 1; attempt <= 50; attempt++) {
      expect((await login(h.app, `user${attempt}@example.com`, 'x')).statusCode).toBe(401);
    }
    expect((await login(h.app, 'owner@example.com', PASSWORD)).statusCode).toBe(429);
    // Other clients are unaffected.
    expect(
      (await login(h.app, 'owner@example.com', PASSWORD, { ip: '203.0.113.99' })).statusCode,
    ).toBe(200);
  });

  it('does not limit the same email from a different IP', async () => {
    for (let attempt = 1; attempt <= 11; attempt++) {
      await login(h.app, 'owner@example.com', 'wrong-password!');
    }
    expect(
      (await login(h.app, 'owner@example.com', PASSWORD, { ip: '203.0.113.50' })).statusCode,
    ).toBe(200);
  });
});
