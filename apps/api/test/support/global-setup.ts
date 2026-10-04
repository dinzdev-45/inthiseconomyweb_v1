import type { TestProject } from 'vitest/node';

import { migrate, startPostgres } from './postgres.ts';

declare module 'vitest' {
  export interface ProvidedContext {
    /** Connection URL for the `postgres` maintenance database of the shared test container. */
    pgAdminUrl: string;
    /** Name of the migrated database that each test file clones. */
    pgTemplate: string;
  }
}

/** One PostgreSQL container per test run, migrated once and used as a template. */
export default async function setup(project: TestProject) {
  const container = await startPostgres();
  migrate(container.getConnectionUri());

  const adminUrl = new URL(container.getConnectionUri());
  adminUrl.pathname = '/postgres';
  project.provide('pgAdminUrl', adminUrl.toString());
  project.provide('pgTemplate', container.getDatabase());

  return async () => {
    await container.stop();
  };
}
