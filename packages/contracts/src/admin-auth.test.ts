import { describe, expect, it } from 'vitest';

import { ChangePasswordRequest, CurrentStaff, LoginRequest } from './admin-auth.ts';

const ID = '0199a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b';
const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) =>
  schema.safeParse(v).success;

describe('LoginRequest', () => {
  it('accepts email and password', () => {
    expect(ok(LoginRequest, { email: 'owner@example.com', password: 'x' })).toBe(true);
  });

  it('trims surrounding whitespace from the email', () => {
    expect(LoginRequest.parse({ email: '  owner@example.com ', password: 'x' }).email).toBe(
      'owner@example.com',
    );
  });

  it('does not apply the new-password policy to login', () => {
    expect(ok(LoginRequest, { email: 'owner@example.com', password: 'short' })).toBe(true);
  });

  it.each([
    { password: 'x' },
    { email: 'owner@example.com' },
    { email: 'not-an-email', password: 'x' },
    { email: 'owner@example.com', password: '' },
    { email: 'owner@example.com', password: 'x'.repeat(257) },
    { email: 'owner@example.com', password: 'x', remember: true },
  ])('rejects %j', (body) => {
    expect(ok(LoginRequest, body)).toBe(false);
  });
});

describe('CurrentStaff', () => {
  const staff = {
    id: ID,
    email: 'owner@example.com',
    role: 'OWNER',
    permissions: ['admin:access', 'staff:read', 'staff:manage'],
    mustChangePassword: false,
  };

  it('accepts a profile with role and permissions', () => {
    expect(ok(CurrentStaff, staff)).toBe(true);
  });

  it.each(['passwordHash', 'sessionToken', 'tokenHash'])('rejects sensitive field %s', (key) => {
    expect(ok(CurrentStaff, { ...staff, [key]: 'secret' })).toBe(false);
  });

  it('rejects unknown permissions and roles', () => {
    expect(ok(CurrentStaff, { ...staff, permissions: ['orders:write'] })).toBe(false);
    expect(ok(CurrentStaff, { ...staff, role: 'MANAGER' })).toBe(false);
  });
});

describe('ChangePasswordRequest', () => {
  it('accepts a 12+ character new password', () => {
    const body = { currentPassword: 'old', newPassword: 'twelve-chars' };
    expect(ok(ChangePasswordRequest, body)).toBe(true);
  });

  it.each([
    { currentPassword: 'old', newPassword: 'elevenchars' },
    { currentPassword: '', newPassword: 'long-enough-pass' },
    { newPassword: 'long-enough-pass' },
    { currentPassword: 'old', newPassword: 'x'.repeat(257) },
    { currentPassword: 'old', newPassword: 'long-enough-pass', confirm: 'long-enough-pass' },
  ])('rejects %j', (body) => {
    expect(ok(ChangePasswordRequest, body)).toBe(false);
  });
});
