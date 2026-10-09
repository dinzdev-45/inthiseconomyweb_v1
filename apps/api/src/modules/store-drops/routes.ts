import { Slug, StoreDropDetail, StoreDropsOverview } from '@ite/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import type { StoreDropService } from './service.ts';

/** Successful responses may be cached for a minute, like the catalog. */
const CACHE_CONTROL = 'public, max-age=60';

/** /api/v1/store/drops — published drops (store-drops-api spec). GET only; no credentials read. */
export const storeDropRoutes: FastifyPluginAsyncZod<{ drops: StoreDropService }> = async (
  app,
  { drops },
) => {
  app.get(
    '/drops',
    { schema: { response: { 200: StoreDropsOverview } } },
    async (_request, reply) => {
      const overview = await drops.overview();
      reply.header('cache-control', CACHE_CONTROL);
      return overview;
    },
  );

  app.get(
    '/drops/:slug',
    { schema: { params: z.strictObject({ slug: Slug }), response: { 200: StoreDropDetail } } },
    async (request, reply) => {
      const drop = await drops.get(request.params.slug);
      reply.header('cache-control', CACHE_CONTROL);
      return drop;
    },
  );
};
