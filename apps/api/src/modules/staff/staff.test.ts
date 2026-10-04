import { ProblemDetails, StaffListResponse, StaffMember } from '@ite/contracts';
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
import { createStaffRepository } from './repository.ts';
import { createStaffService } from './service.ts';

const PASSWORD = 'correct-horse-battery';
const TEMP_PASSWORD = 'temporary-password';
let h: AuthHarness;
let owner: { id: string };
let ownerCookie: string;

beforeEach(async () => {
  h = await createAuthHarness();
  owner = await createStaff(h.db, {
    email: 'owner@example.com',
    password: PASSWORD,
    role: 'OWNER',
  });
  ownerCookie = sessionCookie(await login(h.app, 'owner@example.com', PASSWORD));
});
afterEach(async () => h.close());

type Call = { method: 'GET' | 'POST' | 'PATCH'; url: string; payload?: object };
const as = (cookie: string, { method, url, payload }: Call) =>
  h.app.inject({
    method,
    url: `/api/v1/admin${url}`,
    headers: { cookie, ...(method === 'GET' ? {} : { origin: ADMIN_ORIGIN }) },
    ...(payload ? { payload } : {}),
  });

const createAccount = (email: string, role: 'OWNER' | 'ADMIN' = 'ADMIN', cookie = ownerCookie) =>
  as(cookie, {
    method: 'POST',
    url: '/staff',
    payload: { email, role, temporaryPassword: TEMP_PASSWORD },
  });
const changeRole = (id: string, role: 'OWNER' | 'ADMIN', cookie = ownerCookie) =>
  as(cookie, { method: 'PATCH', url: `/staff/${id}/role`, payload: { role } });
const deactivate = (id: string, cookie = ownerCookie) =>
  as(cookie, { method: 'POST', url: `/staff/${id}/deactivate` });
const reactivate = (id: string, cookie = ownerCookie) =>
  as(cookie, { method: 'POST', url: `/staff/${id}/reactivate` });
const activeOwners = () => h.db.adminUser.count({ where: { role: 'OWNER', status: 'ACTIVE' } });

describe('admin-access-control: Staff account management', () => {
  it('Create staff account', async () => {
    const res = await createAccount('new@example.com');

    expect(res.statusCode).toBe(201);
    const member = StaffMember.parse(res.json());
    expect(member).toMatchObject({
      email: 'new@example.com',
      role: 'ADMIN',
      status: 'ACTIVE',
      mustChangePassword: true,
    });
    expect(res.body).not.toMatch(/passwordHash|argon2/);

    const signIn = await login(h.app, 'new@example.com', TEMP_PASSWORD);
    expect(signIn.statusCode).toBe(200);
    expect(signIn.json().mustChangePassword).toBe(true);
  });

  it('Duplicate email', async () => {
    expect((await createAccount('new@example.com')).statusCode).toBe(201);

    for (const email of ['new@example.com', 'NEW@Example.COM', 'owner@EXAMPLE.com']) {
      const res = await createAccount(email);
      expect(res.statusCode).toBe(409);
      expect(ProblemDetails.parse(res.json()).code).toBe('STAFF_EMAIL_EXISTS');
    }
    expect(await h.db.adminUser.count()).toBe(2);
  });

  it('rejects a temporary password shorter than 12 characters', async () => {
    const res = await as(ownerCookie, {
      method: 'POST',
      url: '/staff',
      payload: { email: 'new@example.com', role: 'ADMIN', temporaryPassword: 'too-short' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().errors[0].path).toBe('temporaryPassword');
  });

  it('lists staff accounts without secrets', async () => {
    await createAccount('new@example.com');

    const res = await as(ownerCookie, { method: 'GET', url: '/staff' });

    expect(res.statusCode).toBe(200);
    const { data } = StaffListResponse.parse(res.json());
    expect(data.map((m) => m.email).sort()).toEqual(['new@example.com', 'owner@example.com']);
    expect(res.body).not.toMatch(/passwordHash|argon2|token/);
  });

  it('Change role', async () => {
    const created = StaffMember.parse((await createAccount('new@example.com')).json());
    await h.db.adminUser.update({ where: { id: created.id }, data: { mustChangePassword: false } });
    const memberCookie = sessionCookie(await login(h.app, 'new@example.com', TEMP_PASSWORD));
    expect((await as(memberCookie, { method: 'GET', url: '/staff' })).statusCode).toBe(403);

    const res = await changeRole(created.id, 'OWNER');

    expect(res.statusCode).toBe(200);
    expect(StaffMember.parse(res.json()).role).toBe('OWNER');
    // Same session, next request: the new permissions apply.
    const me = await as(memberCookie, { method: 'GET', url: '/auth/me' });
    expect(me.json().permissions).toContain('staff:manage');
    expect((await as(memberCookie, { method: 'GET', url: '/staff' })).statusCode).toBe(200);
  });

  it('Deactivate staff', async () => {
    const created = StaffMember.parse((await createAccount('new@example.com')).json());
    const memberCookie = sessionCookie(await login(h.app, 'new@example.com', TEMP_PASSWORD));

    const res = await deactivate(created.id);

    expect(res.statusCode).toBe(200);
    expect(StaffMember.parse(res.json()).status).toBe('DEACTIVATED');
    expect((await login(h.app, 'new@example.com', TEMP_PASSWORD)).statusCode).toBe(401);
    expect((await as(memberCookie, { method: 'GET', url: '/auth/me' })).statusCode).toBe(401);
  });

  it('does not revive old sessions on reactivation', async () => {
    const created = StaffMember.parse((await createAccount('new@example.com')).json());
    const memberCookie = sessionCookie(await login(h.app, 'new@example.com', TEMP_PASSWORD));
    await deactivate(created.id);

    const res = await reactivate(created.id);

    expect(StaffMember.parse(res.json()).status).toBe('ACTIVE');
    expect((await as(memberCookie, { method: 'GET', url: '/auth/me' })).statusCode).toBe(401);
    expect((await login(h.app, 'new@example.com', TEMP_PASSWORD)).statusCode).toBe(200);
  });

  it('returns 404 for an unknown staff id', async () => {
    const res = await deactivate('0199a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b');
    expect(res.statusCode).toBe(404);
    expect(ProblemDetails.parse(res.json()).code).toBe('NOT_FOUND');
  });

  it('Last owner protected', async () => {
    const before = await h.db.adminUser.findUniqueOrThrow({ where: { id: owner.id } });

    for (const res of [await deactivate(owner.id), await changeRole(owner.id, 'ADMIN')]) {
      expect(res.statusCode).toBe(409);
      expect(ProblemDetails.parse(res.json()).code).toBe('LAST_OWNER');
    }

    expect(await h.db.adminUser.findUniqueOrThrow({ where: { id: owner.id } })).toEqual(before);
    // With a second active Owner, the first may step down.
    const second = StaffMember.parse((await createAccount('second@example.com', 'OWNER')).json());
    expect(second.role).toBe('OWNER');
    expect((await changeRole(owner.id, 'ADMIN')).statusCode).toBe(200);
  });

  it('Last owner protected: concurrent requests leave exactly one active Owner', async () => {
    const second = await createStaff(h.db, {
      email: 'second@example.com',
      password: PASSWORD,
      role: 'OWNER',
    });

    for (let round = 0; round < 6; round++) {
      // Fresh state and sessions each round (a deactivation revokes the loser's sessions).
      await h.db.adminUser.updateMany({ data: { role: 'OWNER', status: 'ACTIVE' } });
      const ip = `192.0.2.${round}`;
      const firstCookie = sessionCookie(await login(h.app, 'owner@example.com', PASSWORD, { ip }));
      const secondCookie = sessionCookie(
        await login(h.app, 'second@example.com', PASSWORD, { ip }),
      );

      // Each Owner removes the other at the same moment: demote on even rounds, deactivate on odd rounds.
      const [a, b] =
        round % 2 === 0
          ? await Promise.all([
              changeRole(second.id, 'ADMIN', firstCookie),
              changeRole(owner.id, 'ADMIN', secondCookie),
            ])
          : await Promise.all([
              deactivate(second.id, firstCookie),
              deactivate(owner.id, secondCookie),
            ]);

      // Exactly one succeeds. The other is refused by the last-OWNER rule (409), or, if the
      // winner committed before it was authenticated, by losing its role (403) or session (401).
      const statuses = [a.statusCode, b.statusCode].sort();
      expect(statuses[0]).toBe(200);
      expect([401, 403, 409]).toContain(statuses[1]);
      expect(await activeOwners()).toBe(1);
    }
  });
});

describe('admin-access-control: last-OWNER lock (service level)', () => {
  it('two concurrent demotions of the last two Owners leave exactly one active', async () => {
    const second = await createStaff(h.db, {
      email: 'second@example.com',
      password: PASSWORD,
      role: 'OWNER',
    });
    const service = createStaffService({ repo: createStaffRepository(h.db), clock: h.clock });

    for (let round = 0; round < 10; round++) {
      await h.db.adminUser.updateMany({ data: { role: 'OWNER', status: 'ACTIVE' } });

      const results = await Promise.allSettled([
        service.changeRole(owner.id, second.id, 'ADMIN'),
        service.changeRole(second.id, owner.id, 'ADMIN'),
      ]);

      // No authentication layer here, so the loser can only be stopped by the row lock.
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.find((r) => r.status === 'rejected');
      expect(rejected?.reason).toMatchObject({ code: 'LAST_OWNER', status: 409 });
      expect(await activeOwners()).toBe(1);
    }
  });
});

describe('admin-access-control: Change attribution', () => {
  it('Attribution on create', async () => {
    const member = StaffMember.parse((await createAccount('new@example.com')).json());

    expect(member.createdBy).toBe(owner.id);
    expect(member.updatedBy).toBe(owner.id);
    expect(member.createdAt).toBe(member.updatedAt);
    const row = await h.db.adminUser.findUniqueOrThrow({ where: { id: member.id } });
    expect(row.createdById).toBe(owner.id);
    expect(row.createdAt.getTime()).toBe(row.updatedAt.getTime());
  });

  it('Attribution on update', async () => {
    const created = StaffMember.parse((await createAccount('new@example.com')).json());
    const secondOwner = await createStaff(h.db, {
      email: 'second@example.com',
      password: PASSWORD,
      role: 'OWNER',
    });
    const secondCookie = sessionCookie(await login(h.app, 'second@example.com', PASSWORD));
    h.clock.advance(minutes(5));

    const updated = StaffMember.parse((await changeRole(created.id, 'OWNER', secondCookie)).json());

    expect(updated.updatedBy).toBe(secondOwner.id);
    expect(Date.parse(updated.updatedAt)).toBeGreaterThan(Date.parse(created.updatedAt));
    expect(updated.createdBy).toBe(owner.id);
    expect(updated.createdAt).toBe(created.createdAt);
  });
});
