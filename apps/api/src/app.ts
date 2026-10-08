import cookie from '@fastify/cookie';
import Fastify, { type FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

import { systemClock, type Clock } from './clock.ts';
import type { Env } from './env.ts';
import { loggerOptions } from './logger.ts';
import { createDummyHash } from './modules/admin-auth/password.ts';
import { RateLimiter } from './modules/admin-auth/rate-limit.ts';
import { createAdminAuthRepository } from './modules/admin-auth/repository.ts';
import { adminAuthRoutes } from './modules/admin-auth/routes.ts';
import { createAdminAuthService } from './modules/admin-auth/service.ts';
import { createImageRepository } from './modules/catalog/images/repository.ts';
import { imageRoutes } from './modules/catalog/images/routes.ts';
import { createImageService } from './modules/catalog/images/service.ts';
import { catalogSettingsRoutes } from './modules/catalog/settings/routes.ts';
import { createProductRepository } from './modules/catalog/products/repository.ts';
import { productRoutes } from './modules/catalog/products/routes.ts';
import { createProductService } from './modules/catalog/products/service.ts';
import { createVariantRepository } from './modules/catalog/variants/repository.ts';
import { variantRoutes } from './modules/catalog/variants/routes.ts';
import { createVariantService } from './modules/catalog/variants/service.ts';
import { createReferenceRepository } from './modules/catalog/reference/repository.ts';
import { referenceRoutes } from './modules/catalog/reference/routes.ts';
import { createReferenceService } from './modules/catalog/reference/service.ts';
import { createStoreCatalogRepository } from './modules/store-catalog/repository.ts';
import { storeCatalogRoutes } from './modules/store-catalog/routes.ts';
import { createStoreCatalogService } from './modules/store-catalog/service.ts';
import { createStaffRepository } from './modules/staff/repository.ts';
import { staffRoutes } from './modules/staff/routes.ts';
import { createStaffService } from './modules/staff/service.ts';
import type { AdminRouteRecord } from './plugins/authorize.ts';
import db from './plugins/db.ts';
import errorHandler from './plugins/error-handler.ts';
import requestId, { requestIdServerOptions } from './plugins/request-id.ts';
import securityHeaders from './plugins/security-headers.ts';
import { createCursorCodec } from './pagination.ts';
import { healthRoutes } from './routes/health.ts';
import { registerZones, type ZoneRoutes } from './zones.ts';

export type BuildAppOptions = {
  env: Env;
  /** Log destination override, used by tests. Defaults to stdout. */
  logStream?: NodeJS.WritableStream;
  /** Time source for session expiry and rate-limit windows. Defaults to the system clock. */
  clock?: Clock;
  /** Additional route plugins mounted in each API zone (used by tests). */
  routes?: ZoneRoutes;
  /** Collects every admin route and its permission declaration (used by the route-coverage test). */
  adminRouteRegistry?: AdminRouteRecord[];
};

/** Creates the API application. Call `ready()` (or `listen()`) before use. */
export async function buildApp({
  env,
  logStream,
  clock = systemClock,
  routes = {},
  adminRouteRegistry,
}: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: loggerOptions(env, logStream),
    ...requestIdServerOptions,
    // request.ip comes from X-Forwarded-For only when the peer is a configured proxy (design D8).
    // A hop count trusts exactly that many hops, the same rule proxy-addr applies to a number.
    trustProxy:
      typeof env.TRUST_PROXY === 'number'
        ? (_address: string, hop: number) => hop < (env.TRUST_PROXY as number)
        : env.TRUST_PROXY,
  });

  // Every route validates params/query/body and serializes responses with Zod.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(requestId);
  await app.register(securityHeaders, { production: env.NODE_ENV === 'production' });
  await app.register(errorHandler);
  await app.register(db, { databaseUrl: env.DATABASE_URL });
  await app.register(cookie);

  const auth = createAdminAuthService({
    repo: createAdminAuthRepository(app.db),
    clock,
    sessionSecret: env.SESSION_SECRET,
    dummyHash: createDummyHash(),
  });
  const loginLimiter = new RateLimiter(clock);
  const staff = createStaffService({ repo: createStaffRepository(app.db), clock });
  const reference = createReferenceService({ repo: createReferenceRepository(app.db), clock });
  const productRepository = createProductRepository(app.db);
  const products = createProductService({
    repo: productRepository,
    clock,
    storeCurrency: env.STORE_CURRENCY,
    cursors: createCursorCodec(env.SESSION_SECRET, 'admin.products'),
  });
  const images = createImageService({
    products: productRepository,
    images: createImageRepository(),
    clock,
  });
  const variants = createVariantService({
    products: productRepository,
    variants: createVariantRepository(app.db),
    clock,
    storeCurrency: env.STORE_CURRENCY,
  });
  const storeCatalog = createStoreCatalogService({ repo: createStoreCatalogRepository(app.db) });

  await app.register(healthRoutes);
  await registerZones(app, {
    env,
    auth,
    adminRouteRegistry,
    routes: {
      ...routes,
      store: [
        async (store) => store.register(storeCatalogRoutes, { catalog: storeCatalog }),
        ...(routes.store ?? []),
      ],
      admin: [
        async (admin) =>
          admin.register(adminAuthRoutes, {
            auth,
            loginLimiter,
            secureCookies: env.NODE_ENV !== 'development',
          }),
        async (admin) => admin.register(staffRoutes, { staff }),
        async (admin) => admin.register(referenceRoutes, { reference }),
        async (admin) => admin.register(productRoutes, { products }),
        async (admin) => admin.register(variantRoutes, { variants }),
        async (admin) => admin.register(imageRoutes, { images }),
        async (admin) =>
          admin.register(catalogSettingsRoutes, { storeCurrency: env.STORE_CURRENCY }),
        ...(routes.admin ?? []),
      ],
    },
  });

  return app;
}
