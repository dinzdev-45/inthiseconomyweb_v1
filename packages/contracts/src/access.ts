import { z } from 'zod';

/** Staff roles. Must stay in sync with the `AdminRole` database enum. */
export const Role = z.enum(['OWNER', 'ADMIN']);
export type Role = z.infer<typeof Role>;

/**
 * Named permissions. Endpoints and admin UI check permissions, never role
 * names, so adding a role only changes ROLE_PERMISSIONS. Feature changes add
 * their own permissions here.
 */
export const Permission = z.enum([
  'admin:access',
  'staff:read',
  'staff:manage',
  'catalog:read',
  'catalog:manage',
]);
export type Permission = z.infer<typeof Permission>;

/** The fixed permission set granted by each role. */
export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = Object.freeze({
  OWNER: Object.freeze([
    'admin:access',
    'staff:read',
    'staff:manage',
    'catalog:read',
    'catalog:manage',
  ] as const),
  // Everything except staff account management.
  ADMIN: Object.freeze(['admin:access', 'catalog:read', 'catalog:manage'] as const),
});
