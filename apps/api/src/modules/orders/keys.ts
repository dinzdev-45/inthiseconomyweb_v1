import { randomBytes } from 'node:crypto';

import { generateToken, keyedHash } from '../../secret-token.ts';

/** Unpaid orders expire this long after they were placed (store-checkout-api spec). */
export const PAYMENT_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Crockford base32: no I, L, O, or U, so order numbers read well aloud. */
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** `ITE-` plus 8 base32 characters from 40 random bits (guest-checkout design D2). */
export function generateOrderNumber(): string {
  const bytes = randomBytes(5);
  let bits = 0n;
  for (const byte of bytes) bits = (bits << 8n) | BigInt(byte);
  let code = '';
  for (let i = 7; i >= 0; i--) code += CROCKFORD[Number((bits >> BigInt(i * 5)) & 31n)];
  return `ITE-${code}`;
}

export const generateOrderKey = generateToken;

/** The stored form of an order access key (an "order:" prefix keeps it apart from other hashes). */
export function hashOrderKey(secret: string, key: string): string {
  return keyedHash(secret, `order:${key}`);
}
