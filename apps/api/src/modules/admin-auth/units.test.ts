import { describe, expect, it } from 'vitest';

import { FakeClock, minutes } from '../../../test/support/auth.ts';
import { createDummyHash, hashPassword, verifyPassword } from './password.ts';
import { RateLimiter } from './rate-limit.ts';
import { hashSessionToken, isSessionLive } from './session-token.ts';

describe('password hashing', () => {
  it('produces Argon2id hashes that verify only the right password', async () => {
    const hash = await hashPassword('correct-horse-battery');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(hash, 'correct-horse-battery')).toBe(true);
    expect(await verifyPassword(hash, 'wrong-horse-battery')).toBe(false);
  });

  it('never authenticates against a malformed hash', async () => {
    expect(await verifyPassword('not-a-hash', 'anything')).toBe(false);
  });

  it('builds a dummy hash with the same parameters as real hashes', async () => {
    const params = (h: string) => h.split('$').slice(1, 4).join('$');
    expect(params(await createDummyHash())).toBe(params(await hashPassword('x'.repeat(12))));
  });
});

describe('session tokens', () => {
  it('hashes tokens with the secret (HMAC-SHA-256, hex)', () => {
    const a = hashSessionToken('s'.repeat(32), 'token');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSessionToken('t'.repeat(32), 'token')).not.toBe(a);
  });

  it('treats revoked, idle, and absolutely expired sessions as dead', () => {
    const now = new Date('2026-10-02T12:00:00Z');
    const live = { lastSeenAt: now, expiresAt: new Date(now.getTime() + 1000), revokedAt: null };
    expect(isSessionLive(live, now)).toBe(true);
    expect(isSessionLive({ ...live, revokedAt: now }, now)).toBe(false);
    expect(isSessionLive({ ...live, lastSeenAt: new Date(now.getTime() - minutes(30)) }, now)).toBe(
      false,
    );
    expect(isSessionLive({ ...live, expiresAt: now }, now)).toBe(false);
  });
});

describe('RateLimiter', () => {
  it('counts every key and reports the longest wait', () => {
    const clock = new FakeClock();
    const limiter = new RateLimiter(clock);
    const checks = [
      { key: 'a', rule: { max: 2, windowMs: minutes(1) } },
      { key: 'b', rule: { max: 5, windowMs: minutes(10) } },
    ];
    expect(limiter.hit(checks).allowed).toBe(true);
    expect(limiter.hit(checks).allowed).toBe(true);
    expect(limiter.hit(checks)).toEqual({ allowed: false, retryAfterSeconds: 60 });
    clock.advance(minutes(1));
    expect(limiter.hit(checks).allowed).toBe(true);
  });
});
