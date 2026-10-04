import cors, { type FastifyCorsOptionsDelegatePromise } from '@fastify/cors';
import type { FastifyInstance } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import type { Env } from './env.ts';
import adminSession from './plugins/admin-session.ts';
import authorize, { type AdminRouteRecord } from './plugins/authorize.ts';
import originCheck from './plugins/origin-check.ts';
import type { AdminAuthService } from './modules/admin-auth/service.ts';

/** Route plugins mounted inside each zone. Feature modules are added here as they are built. */
export type ZoneRoutes = {
  store?: FastifyPluginAsyncZod[];
  admin?: FastifyPluginAsyncZod[];
  webhooks?: FastifyPluginAsyncZod[];
};

export const ZONE_PREFIX = {
  store: '/api/v1/store',
  admin: '/api/v1/admin',
  webhooks: '/api/v1/webhooks',
} as const;

/**
 * Registers the three API zones as encapsulated contexts so each zone's
 * trust rules apply only to its own routes (design D6).
 */
export async function registerZones(
  app: FastifyInstance,
  {
    env,
    auth,
    routes = {},
    adminRouteRegistry,
  }: {
    env: Env;
    auth: AdminAuthService;
    routes?: ZoneRoutes;
    adminRouteRegistry?: AdminRouteRecord[];
  },
): Promise<void> {
  app.decorateRequest('adminSession', null);

  // Public storefront zone: no session handling exists here, by construction.
  await app.register(
    async (store) => {
      for (const plugin of routes.store ?? []) await store.register(plugin);
    },
    { prefix: ZONE_PREFIX.store },
  );

  // Staff-only zone, in order: credentialed CORS for the admin origin (answers preflights),
  // cross-site mutation check, the fail-closed session guard, then permission checks.
  await app.register(
    async (admin) => {
      // Decided per request: any other origin gets no CORS headers at all (not even Allow-Credentials).
      const corsForRequest: FastifyCorsOptionsDelegatePromise = async (request) =>
        request.headers.origin === env.ADMIN_ORIGIN
          ? { origin: true, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] }
          : { origin: false };
      await admin.register(cors, () => corsForRequest);
      await admin.register(originCheck, { allowedOrigin: env.ADMIN_ORIGIN });
      await admin.register(adminSession, { auth });
      await admin.register(authorize, { registry: adminRouteRegistry });
      for (const plugin of routes.admin ?? []) await admin.register(plugin);
    },
    { prefix: ZONE_PREFIX.admin },
  );

  // Third-party callbacks; signature verification and raw-body parsing arrive with the first webhook.
  await app.register(
    async (webhooks) => {
      for (const plugin of routes.webhooks ?? []) await webhooks.register(plugin);
    },
    { prefix: ZONE_PREFIX.webhooks },
  );
}
