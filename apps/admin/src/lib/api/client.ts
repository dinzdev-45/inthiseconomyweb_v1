import type { z } from 'zod';

import { toApiError } from './errors.ts';

type Method = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Mutation from the browser to the same-origin `/api/v1/admin/*` proxy. The
 * httpOnly session cookie travels automatically and the browser adds Origin;
 * no token is ever read or stored by JavaScript. Errors become ApiError.
 */
export async function apiSend<S extends z.ZodType | undefined = undefined>(
  method: Method,
  path: `/api/v1/admin/${string}`,
  { body, schema }: { body?: unknown; schema?: S } = {},
): Promise<S extends z.ZodType ? z.infer<S> : undefined> {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) throw await toApiError(response);
  if (response.status === 204 || !schema) return undefined as never;
  return schema.parse(await response.json()) as never;
}
