import { describe, expect, it } from 'vitest';

import {
  ChangeStaffRoleRequest,
  CreateStaffRequest,
  StaffIdParams,
  StaffListResponse,
  StaffMember,
} from './staff.ts';

const ID = '0199a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b';
const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) =>
  schema.safeParse(v).success;

const member = {
  id: ID,
  email: 'admin@example.com',
  role: 'ADMIN',
  status: 'ACTIVE',
  mustChangePassword: true,
  createdAt: '2026-10-02T08:11:59.000Z',
  updatedAt: '2026-10-02T08:11:59.000Z',
  createdBy: ID,
  updatedBy: ID,
};

describe('StaffMember', () => {
  it('accepts a staff member with attribution', () => {
    expect(ok(StaffMember, member)).toBe(true);
  });

  it('accepts null (system) attribution', () => {
    expect(ok(StaffMember, { ...member, createdBy: null, updatedBy: null })).toBe(true);
  });

  it.each(['passwordHash', 'sessions'])('rejects internal field %s', (key) => {
    expect(ok(StaffMember, { ...member, [key]: 'x' })).toBe(false);
  });

  it('rejects missing attribution and unknown status', () => {
    const { createdBy: _createdBy, ...withoutCreatedBy } = member;
    expect(ok(StaffMember, withoutCreatedBy)).toBe(false);
    expect(ok(StaffMember, { ...member, status: 'PENDING' })).toBe(false);
  });
});

describe('StaffListResponse', () => {
  it('accepts a data envelope', () => {
    expect(ok(StaffListResponse, { data: [member] })).toBe(true);
    expect(ok(StaffListResponse, { data: [] })).toBe(true);
  });

  it('rejects a bare array', () => {
    expect(ok(StaffListResponse, [member])).toBe(false);
  });
});

describe('CreateStaffRequest', () => {
  const body = { email: 'new@example.com', role: 'ADMIN', temporaryPassword: 'temporary-pass' };

  it('accepts email, role, and a temporary password', () => {
    expect(ok(CreateStaffRequest, body)).toBe(true);
  });

  it.each([
    { ...body, temporaryPassword: 'too-short' },
    { ...body, role: 'MANAGER' },
    { ...body, email: 'nope' },
    { ...body, status: 'ACTIVE' },
    { ...body, createdBy: ID },
    { email: body.email, role: body.role },
  ])('rejects %j', (value) => {
    expect(ok(CreateStaffRequest, value)).toBe(false);
  });
});

describe('ChangeStaffRoleRequest', () => {
  it('accepts a known role', () => {
    expect(ok(ChangeStaffRoleRequest, { role: 'OWNER' })).toBe(true);
  });

  it.each([{}, { role: 'owner' }, { role: 'OWNER', status: 'ACTIVE' }])('rejects %j', (value) => {
    expect(ok(ChangeStaffRoleRequest, value)).toBe(false);
  });
});

describe('StaffIdParams', () => {
  it('accepts a UUIDv7 id', () => {
    expect(ok(StaffIdParams, { id: ID })).toBe(true);
  });

  it.each([{ id: '1' }, {}, { id: ID, extra: 'x' }])('rejects %j', (value) => {
    expect(ok(StaffIdParams, value)).toBe(false);
  });
});
