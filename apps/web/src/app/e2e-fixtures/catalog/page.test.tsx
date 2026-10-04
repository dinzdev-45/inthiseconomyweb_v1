import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));
const { default: CatalogFixturesPage } = await import('./page.tsx');

afterEach(() => vi.unstubAllEnvs());

describe('e2e fixtures page', () => {
  it('is a 404 unless STOREFRONT_E2E_FIXTURES=1', () => {
    vi.stubEnv('STOREFRONT_E2E_FIXTURES', '');
    expect(() => CatalogFixturesPage()).toThrow('NEXT_NOT_FOUND');
    vi.stubEnv('STOREFRONT_E2E_FIXTURES', '1');
    expect(() => CatalogFixturesPage()).not.toThrow();
  });
});
