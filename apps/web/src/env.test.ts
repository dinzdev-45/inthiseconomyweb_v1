import { describe, expect, it } from 'vitest';

import { loadEnv } from './env.ts';

describe('storefront env', () => {
  it('requires a path-less API_URL', () => {
    expect(() => loadEnv({})).toThrow(/API_URL: is required/);
    expect(() => loadEnv({ API_URL: 'not a url' })).toThrow(/API_URL: must be an http\(s\) URL/);
    expect(() => loadEnv({ API_URL: 'http://api.internal/v1' })).toThrow(/must not include a path/);
    expect(loadEnv({ API_URL: 'http://127.0.0.1:4000/' }).API_URL).toBe('http://127.0.0.1:4000');
  });
});
