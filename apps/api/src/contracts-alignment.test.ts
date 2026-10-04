import { Role, StaffStatus } from '@ite/contracts';
import { AdminRole, AdminStatus } from '@ite/db';
import { describe, expect, it } from 'vitest';

// @ite/contracts is browser-safe and cannot import @ite/db, so the API (which uses both) checks they agree.
describe('contracts match the database enums', () => {
  it('Role matches AdminRole', () => {
    expect([...Role.options].sort()).toEqual(Object.values(AdminRole).sort());
  });

  it('StaffStatus matches AdminStatus', () => {
    expect([...StaffStatus.options].sort()).toEqual(Object.values(AdminStatus).sort());
  });
});
