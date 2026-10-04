import 'server-only';

import { ADMIN_SESSION_COOKIE } from '@ite/contracts';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { z } from 'zod';

import { loadEnv } from '../../env.ts';
import { ApiError, authRedirectFor, toApiError } from './errors.ts';

/**
 * GET from apps/api on behalf of the signed-in staff member, server to server.
 * Only the session cookie is forwarded. GET only: mutations go through the
 * browser so the API can check their Origin (design D8).
 */
export async function apiGet<S extends z.ZodType>(
  path: `/api/v1/admin/${string}`,
  schema: S,
): Promise<z.infer<S>> {
  const session = (await cookies()).get(ADMIN_SESSION_COOKIE);
  const response = await fetch(`${loadEnv().API_URL}${path}`, {
    method: 'GET',
    headers: session ? { cookie: `${ADMIN_SESSION_COOKIE}=${session.value}` } : {},
    cache: 'no-store',
  });
  if (!response.ok) throw await toApiError(response);
  return schema.parse(await response.json());
}

/** apiGet for pages: a missing session redirects to login, a temporary password to change-password. */
export async function apiGetForPage<S extends z.ZodType>(
  path: `/api/v1/admin/${string}`,
  schema: S,
): Promise<z.infer<S>> {
  try {
    return await apiGet(path, schema);
  } catch (error) {
    const target = authRedirectFor(error);
    if (target) redirect(target);
    throw error;
  }
}

export { ApiError };
