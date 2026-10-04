import { describe, expect, it } from 'vitest';

import { withAttribution } from './attribution.ts';

const STAFF_ID = '0199a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b';

describe('withAttribution', () => {
  it('sets created_by and updated_by to the staff actor on create', () => {
    expect(withAttribution(STAFF_ID, { email: 'a@example.com' }, 'create')).toEqual({
      email: 'a@example.com',
      createdById: STAFF_ID,
      updatedById: STAFF_ID,
    });
  });

  it('sets only updated_by to the staff actor on update', () => {
    const result = withAttribution(STAFF_ID, { role: 'ADMIN' }, 'update');
    expect(result).toEqual({ role: 'ADMIN', updatedById: STAFF_ID });
    expect(result).not.toHaveProperty('createdById');
  });

  it('records null attribution for a system actor on create', () => {
    expect(withAttribution(null, { email: 'owner@example.com' }, 'create')).toEqual({
      email: 'owner@example.com',
      createdById: null,
      updatedById: null,
    });
  });

  it('records null updated_by for a system actor on update', () => {
    expect(withAttribution(null, { status: 'DEACTIVATED' }, 'update')).toEqual({
      status: 'DEACTIVATED',
      updatedById: null,
    });
  });

  it('does not mutate the input data', () => {
    const data = { email: 'a@example.com' };
    withAttribution(STAFF_ID, data, 'create');
    expect(data).toEqual({ email: 'a@example.com' });
  });
});
