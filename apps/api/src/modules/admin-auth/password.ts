import { randomBytes } from 'node:crypto';

import { hash, verify } from '@node-rs/argon2';

/**
 * Argon2id (the library default; tests assert the `$argon2id$` prefix) with
 * 64 MiB memory, 3 passes, 1 lane, an RFC 9106 recommended profile. Each hash
 * records its own parameters, so older hashes still verify.
 */
const ARGON2_OPTIONS = {
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
} as const;

/** Minimum length for any password being set (admin-authentication spec). */
export const PASSWORD_MIN_LENGTH = 12;

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    // A malformed stored hash never authenticates.
    return false;
  }
}

/**
 * A hash of a random secret with the same parameters as real hashes. Verifying
 * against it when there is no usable account (unknown email, deactivated)
 * makes those failures cost the same as a wrong password.
 */
export function createDummyHash(): Promise<string> {
  return hashPassword(randomBytes(32).toString('base64url'));
}
