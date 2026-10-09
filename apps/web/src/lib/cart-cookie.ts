import 'server-only';

import { CartToken } from '@ite/contracts';
import { cookies } from 'next/headers';

import { loadEnv } from '@/env';

/** The storefront's cart cookie: the cart token, readable only by the storefront server. */
export const CART_COOKIE = 'ite_cart';
/** Matches the API's cart lifetime (30 days after the last change). */
export const CART_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

/** Attributes for the cart cookie (guest-cart design D5). */
export function cartCookieOptions(production = loadEnv().NODE_ENV === 'production') {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: production,
    path: '/',
    maxAge: CART_COOKIE_MAX_AGE,
  };
}

/** The cart token from the cookie, or undefined when there is none or it is malformed. */
export async function readCartToken(): Promise<string | undefined> {
  const value = (await cookies()).get(CART_COOKIE)?.value;
  return CartToken.safeParse(value).success ? value : undefined;
}

/** Stores the cart token (Server Actions and Route Handlers only). */
export async function writeCartToken(token: string): Promise<void> {
  (await cookies()).set(CART_COOKIE, token, cartCookieOptions());
}
