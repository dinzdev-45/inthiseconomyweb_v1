import { generateToken, keyedHash } from '../../secret-token.ts';

/** A cart expires this long after it was created or last changed (store-cart-api spec). */
export const CART_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const generateCartToken = generateToken;

/**
 * The stored form of a cart token: a keyed hash under the session secret, with a "cart:" prefix so
 * cart and session hashes never collide (guest-cart design D2).
 */
export function hashCartToken(secret: string, token: string): string {
  return keyedHash(secret, `cart:${token}`);
}
