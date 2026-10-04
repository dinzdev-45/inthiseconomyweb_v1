import { ROLE_PERMISSIONS } from '@ite/contracts';
import { describe, expect, it, vi } from 'vitest';

import { catalogAccess, guardCatalogPage } from './access.ts';

describe('catalogAccess', () => {
  it('grants OWNER and ADMIN full catalog access', () => {
    expect(catalogAccess(ROLE_PERMISSIONS.OWNER)).toEqual({ canRead: true, canManage: true });
    expect(catalogAccess(ROLE_PERMISSIONS.ADMIN)).toEqual({ canRead: true, canManage: true });
  });

  it('treats catalog:manage without catalog:read as no access', () => {
    expect(catalogAccess(['admin:access', 'catalog:manage'])).toEqual({
      canRead: false,
      canManage: false,
    });
  });
});

describe('admin-catalog-ui: Permission-aware catalog controls', () => {
  it('Read-only catalog view', async () => {
    const readOnly = ['admin:access', 'catalog:read'] as const;
    expect(catalogAccess(readOnly)).toEqual({ canRead: true, canManage: false });

    // Viewing pages loads data, and tells components to hide every mutation control.
    const load = vi.fn(async () => 'catalog data');
    expect(await guardCatalogPage(readOnly, load)).toEqual({
      permitted: true,
      access: { canRead: true, canManage: false },
      data: 'catalog data',
    });
    // Pages that exist only to change data (e.g. "new product") are not permitted.
    const loadForm = vi.fn(async () => 'form data');
    expect(await guardCatalogPage(readOnly, loadForm, { requireManage: true })).toEqual({
      permitted: false,
    });
    expect(loadForm).not.toHaveBeenCalled();
  });
});

describe('admin-catalog-ui: Catalog navigation and page access', () => {
  it('Catalog page without catalog read permission', async () => {
    const load = vi.fn(async () => 'catalog data');
    for (const permissions of [
      ['admin:access'],
      ['admin:access', 'staff:read', 'staff:manage'],
    ] as const) {
      expect(await guardCatalogPage(permissions, load)).toEqual({ permitted: false });
    }
    // No catalog request is made on their behalf.
    expect(load).not.toHaveBeenCalled();
  });

  it('loads catalog data for staff with catalog:read', async () => {
    const load = vi.fn(async () => 42);
    expect(await guardCatalogPage(ROLE_PERMISSIONS.ADMIN, load)).toMatchObject({
      permitted: true,
      data: 42,
    });
    expect(load).toHaveBeenCalledOnce();
  });
});
