import { createHmac, randomBytes } from 'node:crypto';

import { ADMIN_SESSION_COOKIE } from '@ite/contracts';

export const SESSION_COOKIE = ADMIN_SESSION_COOKIE;

/** Sessions end after 30 minutes without a request... */
export const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
/** ...or 12 hours after sign-in, whichever comes first. */
export const SESSION_ABSOLUTE_TIMEOUT_MS = 12 * 60 * 60 * 1000;
/** `lastSeenAt` is written at most this often to limit database writes. */
export const SESSION_TOUCH_INTERVAL_MS = 60 * 1000;

/** A new 256-bit random session token for the cookie. Never stored. */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * The value stored in `admin_sessions.token_hash`: hex HMAC-SHA-256 of the
 * token keyed with SESSION_SECRET, so a database copy alone cannot be matched
 * against tokens. Rotating SESSION_SECRET signs everyone out.
 */
export function hashSessionToken(secret: string, token: string): string {
  return createHmac('sha256', secret).update(token).digest('hex');
}

type SessionTimes = { lastSeenAt: Date; expiresAt: Date; revokedAt: Date | null };

/** Whether a session may still be used at `now` (not revoked, not idle, not past its absolute expiry). */
export function isSessionLive(session: SessionTimes, now: Date): boolean {
  return (
    session.revokedAt === null &&
    now.getTime() < session.expiresAt.getTime() &&
    now.getTime() - session.lastSeenAt.getTime() < SESSION_IDLE_TIMEOUT_MS
  );
}
