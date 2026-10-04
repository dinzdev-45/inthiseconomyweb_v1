import type { Clock } from '../../clock.ts';

export type RateLimitRule = { max: number; windowMs: number };
export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

/** Counter storage. In memory for the single-server foundation; a shared store (e.g. Redis) can implement this later. */
export interface RateLimitStore {
  /** Increments the counter for `key` in its current window and returns the count and window end. */
  increment(key: string, windowMs: number, now: number): { count: number; resetAt: number };
}

export class MemoryRateLimitStore implements RateLimitStore {
  readonly #windows = new Map<string, { count: number; resetAt: number }>();

  increment(key: string, windowMs: number, now: number) {
    let entry = this.#windows.get(key);
    if (!entry || entry.resetAt <= now) {
      if (this.#windows.size > 10_000) this.#sweep(now);
      entry = { count: 0, resetAt: now + windowMs };
      this.#windows.set(key, entry);
    }
    entry.count += 1;
    return { count: entry.count, resetAt: entry.resetAt };
  }

  #sweep(now: number) {
    for (const [key, entry] of this.#windows) if (entry.resetAt <= now) this.#windows.delete(key);
  }
}

/**
 * Fixed-window limiter that counts one attempt against several keys at once
 * and rejects if any key is over its limit.
 */
export class RateLimiter {
  readonly #store: RateLimitStore;
  readonly #clock: Clock;

  constructor(clock: Clock, store: RateLimitStore = new MemoryRateLimitStore()) {
    this.#clock = clock;
    this.#store = store;
  }

  hit(checks: ReadonlyArray<{ key: string; rule: RateLimitRule }>): RateLimitResult {
    const now = this.#clock.now().getTime();
    let retryAfterMs = 0;
    for (const { key, rule } of checks) {
      const { count, resetAt } = this.#store.increment(key, rule.windowMs, now);
      if (count > rule.max) retryAfterMs = Math.max(retryAfterMs, resetAt - now);
    }
    return { allowed: retryAfterMs === 0, retryAfterSeconds: Math.ceil(retryAfterMs / 1000) };
  }
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/** Login limits (design D11): per IP + email, and per IP overall. */
export const LOGIN_RATE_LIMITS = {
  ipAndEmail: { max: 10, windowMs: FIFTEEN_MINUTES },
  ip: { max: 50, windowMs: FIFTEEN_MINUTES },
} as const satisfies Record<string, RateLimitRule>;
