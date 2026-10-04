import { describe, expect, it } from 'vitest';

import { assertSeedAllowed, DEV_ADMINS } from './dev-admins.ts';

describe('assertSeedAllowed', () => {
  it('refuses to seed when NODE_ENV is production', () => {
    expect(() => assertSeedAllowed({ NODE_ENV: 'production' })).toThrow(/production/);
  });

  it.each([undefined, 'development', 'test'])('allows seeding when NODE_ENV is %s', (nodeEnv) => {
    expect(() => assertSeedAllowed({ NODE_ENV: nodeEnv })).not.toThrow();
  });
});

describe('DEV_ADMINS', () => {
  it('defines exactly one OWNER and one ADMIN', () => {
    expect(DEV_ADMINS.map((a) => a.role).sort()).toEqual(['ADMIN', 'OWNER']);
  });

  it('uses passwords that meet the 12-character minimum', () => {
    for (const { password } of DEV_ADMINS) expect(password.length).toBeGreaterThanOrEqual(12);
  });
});
