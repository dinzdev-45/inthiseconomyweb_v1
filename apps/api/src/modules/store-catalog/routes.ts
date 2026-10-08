import {
  StoreCatalogFilters,
  StoreProductListQuery,
  StoreProductListResponse,
  StoreProductDetail,
  StoreProductParams,
} from '@ite/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import type { StoreCatalogService } from './service.ts';

/** Successful catalog responses may be cached by browsers and shared caches for a minute. */
const CACHE_CONTROL = 'public, max-age=60';
// Set only after the data is loaded, so an error response never carries it.

/**
 * /api/v1/store — the public, read-only catalog (store-catalog-api spec). GET only (Fastify adds
 * HEAD); any other method falls through to the not-found handler. No credentials are read.
 */
export const storeCatalogRoutes: FastifyPluginAsyncZod<{ catalog: StoreCatalogService }> = async (
  app,
  { catalog },
) => {
  app.get(
    '/products',
    { schema: { querystring: StoreProductListQuery, response: { 200: StoreProductListResponse } } },
    async (request, reply) => {
      const page = await catalog.list(request.query);
      reply.header('cache-control', CACHE_CONTROL);
      return page;
    },
  );

  app.get(
    '/products/:slug',
    { schema: { params: StoreProductParams, response: { 200: StoreProductDetail } } },
    async (request, reply) => {
      const product = await catalog.get(request.params.slug);
      reply.header('cache-control', CACHE_CONTROL);
      return product;
    },
  );

  app.get(
    '/catalog/filters',
    { schema: { response: { 200: StoreCatalogFilters } } },
    async (_request, reply) => {
      const filters = await catalog.filters();
      reply.header('cache-control', CACHE_CONTROL);
      return filters;
    },
  );
};
