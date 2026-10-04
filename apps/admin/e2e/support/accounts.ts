/**
 * E2E accounts on the fresh `ite_e2e` database. The bootstrapped Owner's password is generated
 * per run (E2E_OWNER_PASSWORD); the admin smoke journey changes it to OWNER_NEW_PASSWORD.
 */
export const OWNER_NEW_PASSWORD = 'owner-chosen-password';

/** A dedicated ADMIN for catalog tests (ADMIN holds catalog:read and catalog:manage). */
export const CATALOG_STAFF = {
  email: 'catalog@e2e.test',
  temporaryPassword: 'catalog-temporary-password',
  password: 'catalog-staff-password',
} as const;
