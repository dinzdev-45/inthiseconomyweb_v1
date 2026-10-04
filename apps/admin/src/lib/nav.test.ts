import { ROLE_PERMISSIONS } from '@ite/contracts';
import { describe, expect, it } from 'vitest';

import { visibleNav } from './nav.ts';

describe('visibleNav', () => {
  it('shows Staff to OWNER only', () => {
    expect(visibleNav(ROLE_PERMISSIONS.OWNER).map((i) => i.label)).toEqual(['Dashboard', 'Staff']);
    expect(visibleNav(ROLE_PERMISSIONS.ADMIN).map((i) => i.label)).toEqual(['Dashboard']);
  });
});
