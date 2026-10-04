import {
  CatalogIdParams,
  CreateProductRequest,
  ProductDetail,
  ProductListQuery,
  ProductListResponse,
  UpdateProductRequest,
} from '@ite/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import type { ProductService } from './service.ts';

/**
 * /api/v1/admin/products — product create, read, update, and list (product-management spec).
 * Reads need `catalog:read`, changes `catalog:manage`. No delete route: products are archived.
 * Lifecycle actions: activate, deactivate, archive, restore.
 */
export const productRoutes: FastifyPluginAsyncZod<{ products: ProductService }> = async (
  app,
  { products },
) => {
  app.get(
    '/products',
    {
      config: { permission: 'catalog:read' },
      schema: { querystring: ProductListQuery, response: { 200: ProductListResponse } },
    },
    async (request) => products.list(request.query),
  );

  app.post(
    '/products',
    {
      config: { permission: 'catalog:manage' },
      schema: { body: CreateProductRequest, response: { 201: ProductDetail } },
    },
    async (request, reply) => {
      const product = await products.create(request.adminSession!.staffId, request.body);
      return reply.code(201).send(product);
    },
  );

  app.get(
    '/products/:id',
    {
      config: { permission: 'catalog:read' },
      schema: { params: CatalogIdParams, response: { 200: ProductDetail } },
    },
    async (request) => products.get(request.params.id),
  );

  app.patch(
    '/products/:id',
    {
      config: { permission: 'catalog:manage' },
      schema: {
        params: CatalogIdParams,
        body: UpdateProductRequest,
        response: { 200: ProductDetail },
      },
    },
    async (request) =>
      products.update(request.adminSession!.staffId, request.params.id, request.body),
  );

  // Lifecycle (design D3): explicit actions, never `PATCH status`.
  for (const action of ['activate', 'deactivate', 'archive', 'restore'] as const) {
    app.post(
      `/products/:id/${action}`,
      {
        config: { permission: 'catalog:manage' },
        schema: { params: CatalogIdParams, response: { 200: ProductDetail } },
      },
      async (request) => products[action](request.adminSession!.staffId, request.params.id),
    );
  }
};
