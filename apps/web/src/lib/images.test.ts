import { describe, expect, it } from 'vitest';

import { isAllowedImage } from './images.ts';

const HOSTS = ['cdn.example.com'];

describe('isAllowedImage', () => {
  it.each([
    ['/images/a.jpg', true],
    ['https://cdn.example.com/a.jpg', true],
    ['https://CDN.example.com/a.jpg', true],
    ['https://cdn.example.com:8443/a.jpg', false],
    ['https://evil.example.com/a.jpg', false],
    ['https://cdn.example.com.evil.net/a.jpg', false],
    ['http://cdn.example.com/a.jpg', false],
    ['//cdn.example.com/a.jpg', false],
  ])('allows %s → %s', (url, allowed) => {
    expect(isAllowedImage(url, HOSTS)).toBe(allowed);
  });
});
