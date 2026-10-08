import { createHmac, randomBytes } from 'node:crypto';

/*
 * Random bearer tokens and their stored form, shared by admin sessions and guest carts. Only the
 * keyed hash is ever stored, so a database copy alone cannot be matched against tokens.
 */

/** A new 256-bit random token, base64url without padding (43 characters). */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Hex HMAC-SHA-256 of `value` keyed with `secret` (64 characters). */
export function keyedHash(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}
