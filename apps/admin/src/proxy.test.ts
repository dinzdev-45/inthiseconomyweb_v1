import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { proxy } from './proxy.ts';

/** Request headers that Next will forward to the rewrite destination, as set by the proxy. */
function forwardedHeaders(path: string, headers: Record<string, string>) {
  const response = proxy(new NextRequest(`http://localhost:3001${path}`, { headers }));
  const overridden = response.headers.get('x-middleware-override-headers')?.split(',') ?? [];
  return Object.fromEntries(
    overridden.map((name) => [name, response.headers.get(`x-middleware-request-${name}`)]),
  );
}

afterEach(() => vi.unstubAllEnvs());

describe('admin proxy', () => {
  it('strips client forwarding headers from API requests by default', () => {
    vi.stubEnv('API_URL', 'http://127.0.0.1:4000');
    const forwarded = forwardedHeaders('/api/v1/admin/auth/login', {
      'x-forwarded-for': '6.6.6.6',
      'x-real-ip': '6.6.6.6',
      forwarded: 'for=6.6.6.6',
    });
    expect(forwarded).not.toHaveProperty('x-forwarded-for');
    expect(forwarded).not.toHaveProperty('x-real-ip');
    expect(forwarded).not.toHaveProperty('forwarded');
  });

  it('passes X-Forwarded-For through when an upstream proxy is trusted', () => {
    vi.stubEnv('API_URL', 'http://127.0.0.1:4000');
    vi.stubEnv('TRUST_UPSTREAM_PROXY', 'true');
    expect(
      forwardedHeaders('/api/v1/admin/auth/login', { 'x-forwarded-for': '198.51.100.7' })[
        'x-forwarded-for'
      ],
    ).toBe('198.51.100.7');
  });

  it('sets x-pathname from the URL, ignoring a client-supplied value', () => {
    vi.stubEnv('API_URL', 'http://127.0.0.1:4000');
    expect(forwardedHeaders('/staff', { 'x-pathname': '/account/password' })['x-pathname']).toBe(
      '/staff',
    );
  });
});
