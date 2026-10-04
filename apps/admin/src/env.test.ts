import { describe, expect, it } from 'vitest';

import { loadEnv } from './env.ts';

describe('admin env', () => {
  it('requires API_URL and strips a trailing slash', () => {
    expect(() => loadEnv({})).toThrow(/API_URL: is required/);
    expect(() => loadEnv({ API_URL: 'not a url' })).toThrow(/API_URL: must be an http\(s\) URL/);
    expect(loadEnv({ API_URL: 'http://127.0.0.1:4000/' }).API_URL).toBe('http://127.0.0.1:4000');
  });

  it('does not trust an upstream proxy unless told to', () => {
    expect(loadEnv({ API_URL: 'http://127.0.0.1:4000' }).TRUST_UPSTREAM_PROXY).toBe(false);
    expect(
      loadEnv({ API_URL: 'http://127.0.0.1:4000', TRUST_UPSTREAM_PROXY: 'true' })
        .TRUST_UPSTREAM_PROXY,
    ).toBe(true);
    expect(() =>
      loadEnv({ API_URL: 'http://127.0.0.1:4000', TRUST_UPSTREAM_PROXY: 'yes' }),
    ).toThrow(/TRUST_UPSTREAM_PROXY: must be true or false/);
  });

  it('rejects a URL with a path without echoing it', () => {
    expect(() => loadEnv({ API_URL: 'http://api.internal/secret-path' })).toThrow(
      /must not include a path/,
    );
    expect(() => loadEnv({ API_URL: 'http://api.internal/secret-path' })).not.toThrow(
      /secret-path/,
    );
  });
});
