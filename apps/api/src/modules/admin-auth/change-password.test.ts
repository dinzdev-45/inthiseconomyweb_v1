import { ProblemDetails } from '@ite/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  ADMIN_ORIGIN,
  createAuthHarness,
  createStaff,
  login,
  sessionCookie,
  type AuthHarness,
} from '../../../test/support/auth.ts';

const PASSWORD = 'correct-horse-battery';
const NEW_PASSWORD = 'an-even-better-password';
let h: AuthHarness;

beforeEach(async () => {
  h = await createAuthHarness();
});
afterEach(async () => h.close());

async function signIn(email: string, password = PASSWORD) {
  return sessionCookie(await login(h.app, email, password));
}

const changePassword = (cookie: string, payload: object) =>
  h.app.inject({
    method: 'POST',
    url: '/api/v1/admin/auth/change-password',
    headers: { cookie, origin: ADMIN_ORIGIN },
    payload,
  });

const storedHash = async (email: string) =>
  (await h.db.adminUser.findUniqueOrThrow({ where: { email } })).passwordHash;

describe('admin-authentication: Password storage and policy', () => {
  it('Weak password rejected', async () => {
    const staff = await createStaff(h.db, { email: 'a@example.com', password: PASSWORD });
    const cookie = await signIn('a@example.com');

    const res = await changePassword(cookie, {
      currentPassword: PASSWORD,
      newPassword: 'short-11ch',
    });

    expect(res.statusCode).toBe(400);
    expect(ProblemDetails.parse(res.json()).errors?.map((e) => e.path)).toEqual(['newPassword']);
    expect(await storedHash('a@example.com')).toBe(staff.passwordHash);
  });

  it('Hash only', async () => {
    await createStaff(h.db, { email: 'a@example.com', password: PASSWORD });
    const cookie = await signIn('a@example.com');
    expect(
      (await changePassword(cookie, { currentPassword: PASSWORD, newPassword: NEW_PASSWORD }))
        .statusCode,
    ).toBe(204);

    const row = await h.db.adminUser.findUniqueOrThrow({ where: { email: 'a@example.com' } });
    expect(row.passwordHash).toMatch(/^\$argon2id\$v=19\$m=65536,t=3,p=1\$/);
    expect(JSON.stringify(row)).not.toContain(NEW_PASSWORD);
    expect(JSON.stringify(row)).not.toContain(PASSWORD);
  });
});

describe('admin-authentication: Change own password', () => {
  it('Change password', async () => {
    const staff = await createStaff(h.db, { email: 'a@example.com', password: PASSWORD });
    const cookie = await signIn('a@example.com');

    expect(
      (await changePassword(cookie, { currentPassword: PASSWORD, newPassword: NEW_PASSWORD }))
        .statusCode,
    ).toBe(204);

    expect((await login(h.app, 'a@example.com', PASSWORD)).statusCode).toBe(401);
    expect((await login(h.app, 'a@example.com', NEW_PASSWORD)).statusCode).toBe(200);
    const row = await h.db.adminUser.findUniqueOrThrow({ where: { id: staff.id } });
    expect(row.updatedById).toBe(staff.id);
  });

  it('Wrong current password', async () => {
    const staff = await createStaff(h.db, { email: 'a@example.com', password: PASSWORD });
    const cookie = await signIn('a@example.com');

    const res = await changePassword(cookie, {
      currentPassword: 'not-my-password',
      newPassword: NEW_PASSWORD,
    });

    expect(res.statusCode).toBe(401);
    expect(ProblemDetails.parse(res.json()).code).toBe('INVALID_CREDENTIALS');
    expect(await storedHash('a@example.com')).toBe(staff.passwordHash);
    // The session itself stays valid.
    expect(
      (await h.app.inject({ method: 'GET', url: '/api/v1/admin/auth/me', headers: { cookie } }))
        .statusCode,
    ).toBe(200);
  });

  it('Temporary password must be changed', async () => {
    await createStaff(h.db, {
      email: 'new@example.com',
      password: PASSWORD,
      mustChangePassword: true,
    });
    const loginRes = await login(h.app, 'new@example.com', PASSWORD);
    expect(loginRes.json().mustChangePassword).toBe(true);
    const cookie = sessionCookie(loginRes);
    const probe = () =>
      h.app.inject({ method: 'GET', url: '/api/v1/admin/test/probe', headers: { cookie } });

    const blocked = await probe();
    expect(blocked.statusCode).toBe(403);
    expect(ProblemDetails.parse(blocked.json()).code).toBe('PASSWORD_CHANGE_REQUIRED');
    // The allowed endpoints keep working.
    expect(
      (await h.app.inject({ method: 'GET', url: '/api/v1/admin/auth/me', headers: { cookie } }))
        .statusCode,
    ).toBe(200);

    expect(
      (await changePassword(cookie, { currentPassword: PASSWORD, newPassword: NEW_PASSWORD }))
        .statusCode,
    ).toBe(204);

    expect((await probe()).statusCode).toBe(200);
    expect(
      (
        await h.app.inject({ method: 'GET', url: '/api/v1/admin/auth/me', headers: { cookie } })
      ).json().mustChangePassword,
    ).toBe(false);
  });

  it('lets a temporary-password user log out', async () => {
    await createStaff(h.db, {
      email: 'new@example.com',
      password: PASSWORD,
      mustChangePassword: true,
    });
    const cookie = await signIn('new@example.com');
    const res = await h.app.inject({
      method: 'POST',
      url: '/api/v1/admin/auth/logout',
      headers: { cookie, origin: ADMIN_ORIGIN },
    });
    expect(res.statusCode).toBe(204);
  });
});
