import { ROLE_PERMISSIONS } from '@ite/contracts';
import { describe, expect, it } from 'vitest';

import { visibleNav } from './nav.ts';

describe('visibleNav', () => {
  it('shows Staff to OWNER only', () => {
    expect(visibleNav(ROLE_PERMISSIONS.OWNER).map((i) => i.label)).toEqual([
      'Dashboard',
      'Products',
      'Categories',
      'Sizes',
      'Colors',
      'Staff',
    ]);
    expect(visibleNav(ROLE_PERMISSIONS.ADMIN).map((i) => i.label)).toEqual([
      'Dashboard',
      'Products',
      'Categories',
      'Sizes',
      'Colors',
    ]);
  });
});

describe('admin-catalog-ui: Catalog navigation and page access', () => {
  it('Catalog navigation entries', () => {
    for (const role of ['OWNER', 'ADMIN'] as const) {
      const catalog = visibleNav(ROLE_PERMISSIONS[role]).filter((item) =>
        item.href.startsWith('/catalog/'),
      );
      expect(catalog.map((item) => [item.label, item.href])).toEqual([
        ['Products', '/catalog/products'],
        ['Categories', '/catalog/categories'],
        ['Sizes', '/catalog/sizes'],
        ['Colors', '/catalog/colors'],
      ]);
    }
    // Hidden without catalog:read, even with other permissions.
    expect(
      visibleNav(['admin:access', 'staff:read', 'catalog:manage']).map((item) => item.label),
    ).toEqual(['Dashboard', 'Staff']);
  });
});
