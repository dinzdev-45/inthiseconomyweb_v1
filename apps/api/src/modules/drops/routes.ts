import {
  AdminDrop,
  AdminDropListResponse,
  CatalogIdParams,
  CreateDropRequest,
  DropCandidatesQuery,
  DropCandidatesResponse,
  SetDropProductsRequest,
  UpdateDropRequest,
} from '@ite/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import type { DropService } from './service.ts';

/**
 * /api/v1/admin/drops — drops (drops-management spec). Reads need `catalog:read`, changes
 * `catalog:manage`. Publishing is an explicit action, never `PATCH status`.
 */
export const dropRoutes: FastifyPluginAsyncZod<{ drops: DropService }> = async (app, { drops }) => {
  app.get(
    '/drops',
    {
      config: { permission: 'catalog:read' },
      schema: { response: { 200: AdminDropListResponse } },
    },
    async () => ({ data: await drops.list() }),
  );

  app.post(
    '/drops',
    {
      config: { permission: 'catalog:manage' },
      schema: { body: CreateDropRequest, response: { 201: AdminDrop } },
    },
    async (request, reply) =>
      reply.code(201).send(await drops.create(request.adminSession!.staffId, request.body)),
  );

  app.get(
    '/drops/:id',
    {
      config: { permission: 'catalog:read' },
      schema: { params: CatalogIdParams, response: { 200: AdminDrop } },
    },
    async (request) => drops.get(request.params.id),
  );

  app.patch(
    '/drops/:id',
    {
      config: { permission: 'catalog:manage' },
      schema: { params: CatalogIdParams, body: UpdateDropRequest, response: { 200: AdminDrop } },
    },
    async (request) => drops.update(request.adminSession!.staffId, request.params.id, request.body),
  );

  app.put(
    '/drops/:id/products',
    {
      config: { permission: 'catalog:manage' },
      schema: {
        params: CatalogIdParams,
        body: SetDropProductsRequest,
        response: { 200: AdminDrop },
      },
    },
    async (request) =>
      drops.setProducts(request.adminSession!.staffId, request.params.id, request.body.productIds),
  );

  for (const action of ['publish', 'unpublish'] as const) {
    app.post(
      `/drops/:id/${action}`,
      {
        config: { permission: 'catalog:manage' },
        schema: { params: CatalogIdParams, response: { 200: AdminDrop } },
      },
      async (request) => drops[action](request.adminSession!.staffId, request.params.id),
    );
  }

  app.delete(
    '/drops/:id',
    { config: { permission: 'catalog:manage' }, schema: { params: CatalogIdParams } },
    async (request, reply) => {
      await drops.remove(request.params.id);
      return reply.code(204).send();
    },
  );

  app.get(
    '/drops/:id/candidates',
    {
      config: { permission: 'catalog:read' },
      schema: {
        params: CatalogIdParams,
        querystring: DropCandidatesQuery,
        response: { 200: DropCandidatesResponse },
      },
    },
    async (request) => ({ data: await drops.candidates(request.params.id, request.query.q) }),
  );
};
