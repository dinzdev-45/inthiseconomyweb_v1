import { describe, expect, it } from 'vitest';

import { loadEnv } from './env.ts';

const API_URL = 'http://127.0.0.1:4000';

describe('storefront env', () => {
  it('requires a path-less API_URL', () => {
    expect(() => loadEnv({})).toThrow(/API_URL: is required/);
    expect(() => loadEnv({ API_URL: 'not a url' })).toThrow(/API_URL: must be an http\(s\) URL/);
    expect(() => loadEnv({ API_URL: 'http://api.internal/v1' })).toThrow(/must not include a path/);
    expect(loadEnv({ API_URL: 'http://127.0.0.1:4000/' }).API_URL).toBe('http://127.0.0.1:4000');
  });

  it('accepts a valid SITE_URL and image host list', () => {
    const env = loadEnv({
      NODE_ENV: 'production',
      API_URL,
      SITE_URL: 'https://shop.example.com/',
      STOREFRONT_IMAGE_HOSTS: ' CDN.example.com, images.example.net ,',
    });
    expect(env.SITE_URL).toBe('https://shop.example.com');
    expect(env.STOREFRONT_IMAGE_HOSTS).toEqual(['cdn.example.com', 'images.example.net']);
  });

  it('defaults SITE_URL outside production and allows no image hosts', () => {
    const env = loadEnv({ API_URL });
    expect(env.SITE_URL).toBe('http://localhost:3000');
    expect(env.STOREFRONT_IMAGE_HOSTS).toEqual([]);
  });

  it('requires SITE_URL in production', () => {
    for (const SITE_URL of [undefined, '']) {
      expect(() => loadEnv({ NODE_ENV: 'production', API_URL, SITE_URL })).toThrow(
        /SITE_URL: is required in production/,
      );
    }
  });

  it.each(['shop.example.com', 'ftp://shop.example.com', 'https://shop.example.com/store'])(
    'rejects a malformed SITE_URL without printing it (%s)',
    (value) => {
      let message = '';
      try {
        loadEnv({ API_URL, SITE_URL: value });
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toMatch(/SITE_URL: must/);
      expect(message).not.toContain(value);
    },
  );

  it.each([
    'https://cdn.example.com',
    'cdn.example.com:8443',
    'cdn.example.com/images',
    'localhost',
    'bad_host.example.com',
    '*.example.com',
  ])('rejects a malformed image host without printing it (%s)', (value) => {
    let message = '';
    try {
      loadEnv({ API_URL, STOREFRONT_IMAGE_HOSTS: `images.example.net,${value}` });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/STOREFRONT_IMAGE_HOSTS: must be comma-separated hostnames/);
    expect(message).not.toContain(value);
  });
});
