import { NextResponse, type NextRequest } from 'next/server';

import { loadEnv } from './env.ts';

/** Headers a client could forge to choose the IP the API sees. */
const FORWARDING_HEADERS = ['x-forwarded-for', 'x-real-ip', 'forwarded'];

/**
 * - Page requests: exposes the path to server layouts as `x-pathname` (always
 *   overwritten, never taken from the client).
 * - `/api/*` requests (rewritten to apps/api): Next passes X-Forwarded-For
 *   through unchanged, so unless an upstream proxy is trusted to set it, the
 *   forwarding headers are removed and the API keys rate limits on this
 *   server's address rather than on a value the browser chose.
 */
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set('x-pathname', request.nextUrl.pathname);
  if (request.nextUrl.pathname.startsWith('/api/') && !loadEnv().TRUST_UPSTREAM_PROXY) {
    for (const name of FORWARDING_HEADERS) headers.delete(name);
  }
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/((?!_next/|favicon.ico).*)'],
};
