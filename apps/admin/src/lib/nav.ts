import type { Permission } from '@ite/contracts';

export type NavItem = { href: string; label: string; permission: Permission };

/** Admin navigation. Each entry is shown only to staff holding its permission; the API still enforces access. */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Dashboard', permission: 'admin:access' },
  { href: '/catalog/products', label: 'Products', permission: 'catalog:read' },
  { href: '/catalog/categories', label: 'Categories', permission: 'catalog:read' },
  { href: '/catalog/sizes', label: 'Sizes', permission: 'catalog:read' },
  { href: '/catalog/colors', label: 'Colors', permission: 'catalog:read' },
  { href: '/staff', label: 'Staff', permission: 'staff:read' },
];

export function visibleNav(permissions: readonly Permission[]): NavItem[] {
  return NAV_ITEMS.filter((item) => permissions.includes(item.permission));
}
