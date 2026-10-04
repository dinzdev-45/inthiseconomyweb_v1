import type { Permission } from '@ite/contracts';

/**
 * What the current staff member may do in the catalog UI (admin-catalog-ui spec). This is a
 * UX layer only: the API checks `catalog:read` / `catalog:manage` on every request regardless.
 */
export type CatalogAccess = {
  /** May open catalog pages and see catalog data. */
  canRead: boolean;
  /** May see and use controls that change catalog data. */
  canManage: boolean;
};

export function catalogAccess(permissions: readonly Permission[]): CatalogAccess {
  const canRead = permissions.includes('catalog:read');
  return { canRead, canManage: canRead && permissions.includes('catalog:manage') };
}

export type CatalogPage<T> =
  { permitted: false } | { permitted: true; access: CatalogAccess; data: T };

/**
 * The page guard every catalog page uses: without `catalog:read` (or without `catalog:manage`
 * when the page itself is for changes) it returns "not permitted" without calling `load`, so
 * no catalog data is ever requested for that staff member.
 */
export async function guardCatalogPage<T>(
  permissions: readonly Permission[],
  load: (access: CatalogAccess) => Promise<T>,
  { requireManage = false }: { requireManage?: boolean } = {},
): Promise<CatalogPage<T>> {
  const access = catalogAccess(permissions);
  if (!access.canRead || (requireManage && !access.canManage)) return { permitted: false };
  return { permitted: true, access, data: await load(access) };
}
