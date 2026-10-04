import { describe, expect, it } from 'vitest';

import { Permission, Role, ROLE_PERMISSIONS } from './access.ts';

describe('ROLE_PERMISSIONS', () => {
  it('grants OWNER exactly admin:access, staff:read, staff:manage, catalog:read, catalog:manage', () => {
    expect([...ROLE_PERMISSIONS.OWNER].sort()).toEqual([
      'admin:access',
      'catalog:manage',
      'catalog:read',
      'staff:manage',
      'staff:read',
    ]);
  });

  it('grants ADMIN exactly admin:access, catalog:read, catalog:manage', () => {
    expect([...ROLE_PERMISSIONS.ADMIN].sort()).toEqual([
      'admin:access',
      'catalog:manage',
      'catalog:read',
    ]);
  });

  it('grants ADMIN everything except staff management', () => {
    const staff = new Set(['staff:read', 'staff:manage']);
    expect([...ROLE_PERMISSIONS.ADMIN].sort()).toEqual(
      Permission.options.filter((p) => !staff.has(p)).sort(),
    );
  });

  it('grants OWNER every defined permission', () => {
    expect([...ROLE_PERMISSIONS.OWNER].sort()).toEqual([...Permission.options].sort());
  });

  it('withholds staff management from ADMIN', () => {
    expect(ROLE_PERMISSIONS.ADMIN).not.toContain('staff:read');
    expect(ROLE_PERMISSIONS.ADMIN).not.toContain('staff:manage');
  });

  it('defines a permission set for every role and no other keys', () => {
    expect(Object.keys(ROLE_PERMISSIONS).sort()).toEqual([...Role.options].sort());
  });

  it('cannot be modified at runtime', () => {
    expect(Object.isFrozen(ROLE_PERMISSIONS)).toBe(true);
    for (const role of Role.options) expect(Object.isFrozen(ROLE_PERMISSIONS[role])).toBe(true);
  });
});

describe('Role', () => {
  it('accepts OWNER and ADMIN only', () => {
    expect(Role.options).toEqual(['OWNER', 'ADMIN']);
    expect(Role.safeParse('MANAGER').success).toBe(false);
  });
});

describe('Permission', () => {
  it('rejects unknown permissions', () => {
    expect(Permission.safeParse('orders:write').success).toBe(false);
  });
});
