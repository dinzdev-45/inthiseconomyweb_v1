import { CurrentStaff, ProblemDetails } from '@ite/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  ADMIN_ORIGIN,
  createAuthHarness,
  createStaff,
  login,
  minutes,
  sessionCookie,
  type AuthHarness,
} from '../../../test/support/auth.ts';

const PASSWORD = 'correct-horse-battery';
let h: AuthHarness;
let cookie: string;

beforeEach(async () => {
  h = await createAuthHarness();
  await createStaff(h.db, { email: 'admin@example.com', password: PASSWORD, role: 'ADMIN' });
  cookie = sessionCookie(await login(h.app, 'admin@example.com', PASSWORD));
});
afterEach(async () => h.close());

const me = (sessionCookieValue = cookie) =>
  h.app.inject({
    method: 'GET',
    url: '/api/v1/admin/auth/me',
    headers: { cookie: sessionCookieValue },
  });

describe('admin-authentication: Secure server-side sessions', () => {
  it('Idle timeout', async () => {
    h.clock.advance(minutes(20));
    expect((await me()).statusCode).toBe(200);
    h.clock.advance(minutes(29));
    expect((await me()).statusCode).toBe(200); // still active: 29 min since the last request

    h.clock.advance(minutes(30));
    const res = await me();

    expect(res.statusCode).toBe(401);
    expect(ProblemDetails.parse(res.json()).code).toBe('UNAUTHENTICATED');
  });

  it('Absolute timeout', async () => {
    // Continuously active, one request every 20 minutes, until 12 hours have passed.
    for (let elapsed = 20; elapsed < 12 * 60; elapsed += 20) {
      h.clock.advance(minutes(20));
      expect((await me()).statusCode).toBe(200);
    }
    h.clock.advance(minutes(20)); // now past 12 hours since sign-in

    expect((await me()).statusCode).toBe(401);
  });

  it('Deactivated during session', async () => {
    expect((await me()).statusCode).toBe(200);
    await h.db.adminUser.update({
      where: { email: 'admin@example.com' },
      data: { status: 'DEACTIVATED' },
    });

    expect((await me()).statusCode).toBe(401);
  });

  it('clears the cookie when the session is no longer valid', async () => {
    h.clock.advance(minutes(31));
    expect((await me()).headers['set-cookie']).toMatch(/^ite_admin_session=;/);
  });

  it('rejects a forged session cookie', async () => {
    expect((await me('ite_admin_session=forged-token')).statusCode).toBe(401);
  });
});

describe('admin-authentication: Cross-site request protection', () => {
  it('Cross-site mutation', async () => {
    const before = (
      await h.db.adminUser.findUniqueOrThrow({ where: { email: 'admin@example.com' } })
    ).passwordHash;
    const payload = { currentPassword: PASSWORD, newPassword: 'a-brand-new-password' };

    for (const headers of [{ cookie, origin: 'https://evil.example' }, { cookie }]) {
      const res = await h.app.inject({
        method: 'POST',
        url: '/api/v1/admin/auth/change-password',
        headers,
        payload,
      });
      expect(res.statusCode).toBe(403);
      expect(ProblemDetails.parse(res.json()).code).toBe('FORBIDDEN');
    }

    const after = (
      await h.db.adminUser.findUniqueOrThrow({ where: { email: 'admin@example.com' } })
    ).passwordHash;
    expect(after).toBe(before);
  });

  it('rejects a cross-site login', async () => {
    const res = await login(h.app, 'admin@example.com', PASSWORD, {
      origin: 'https://evil.example',
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('admin-authentication: Logout', () => {
  it('Logout', async () => {
    const res = await h.app.inject({
      method: 'POST',
      url: '/api/v1/admin/auth/logout',
      headers: { cookie, origin: ADMIN_ORIGIN },
    });

    expect(res.statusCode).toBe(204);
    expect(res.headers['set-cookie']).toMatch(/^ite_admin_session=;/);
    expect((await me()).statusCode).toBe(401);
    const [session] = await h.db.adminSession.findMany();
    expect(session!.revokedAt).not.toBeNull();
  });
});

describe('admin-access-control: Staff roles', () => {
  it('Role permissions are resolvable', async () => {
    const res = await me();

    expect(res.statusCode).toBe(200);
    expect(CurrentStaff.parse(res.json())).toMatchObject({
      email: 'admin@example.com',
      role: 'ADMIN',
      permissions: ['admin:access', 'catalog:read', 'catalog:manage'],
    });
  });
});
