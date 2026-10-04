import {
  CatalogIdParams,
  Category,
  CategoryListQuery,
  CategoryListResponse,
  Color,
  ColorListResponse,
  CreateCategoryRequest,
  CreateColorRequest,
  CreateSizeRequest,
  Size,
  SizeListResponse,
  UpdateCategoryRequest,
  UpdateColorRequest,
  UpdateSizeRequest,
} from '@ite/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import type { ReferenceService } from './service.ts';

/**
 * /api/v1/admin/{categories,sizes,colors} — catalog reference data (catalog-reference-data
 * spec). Reads need `catalog:read`, changes `catalog:manage`.
 */
export const referenceRoutes: FastifyPluginAsyncZod<{ reference: ReferenceService }> = async (
  app,
  { reference },
) => {
  // Categories ---------------------------------------------------------------

  app.get(
    '/categories',
    {
      config: { permission: 'catalog:read' },
      schema: { querystring: CategoryListQuery, response: { 200: CategoryListResponse } },
    },
    async (request) => ({ data: await reference.listCategories(request.query.status) }),
  );

  app.post(
    '/categories',
    {
      config: { permission: 'catalog:manage' },
      schema: { body: CreateCategoryRequest, response: { 201: Category } },
    },
    async (request, reply) => {
      const category = await reference.createCategory(request.adminSession!.staffId, request.body);
      return reply.code(201).send(category);
    },
  );

  app.get(
    '/categories/:id',
    {
      config: { permission: 'catalog:read' },
      schema: { params: CatalogIdParams, response: { 200: Category } },
    },
    async (request) => reference.getCategory(request.params.id),
  );

  app.patch(
    '/categories/:id',
    {
      config: { permission: 'catalog:manage' },
      schema: { params: CatalogIdParams, body: UpdateCategoryRequest, response: { 200: Category } },
    },
    async (request) =>
      reference.updateCategory(request.adminSession!.staffId, request.params.id, request.body),
  );

  app.post(
    '/categories/:id/archive',
    {
      config: { permission: 'catalog:manage' },
      schema: { params: CatalogIdParams, response: { 200: Category } },
    },
    async (request) => reference.archiveCategory(request.adminSession!.staffId, request.params.id),
  );

  app.post(
    '/categories/:id/restore',
    {
      config: { permission: 'catalog:manage' },
      schema: { params: CatalogIdParams, response: { 200: Category } },
    },
    async (request) => reference.restoreCategory(request.adminSession!.staffId, request.params.id),
  );

  // Sizes --------------------------------------------------------------------

  app.get(
    '/sizes',
    { config: { permission: 'catalog:read' }, schema: { response: { 200: SizeListResponse } } },
    async () => ({ data: await reference.listSizes() }),
  );

  app.post(
    '/sizes',
    {
      config: { permission: 'catalog:manage' },
      schema: { body: CreateSizeRequest, response: { 201: Size } },
    },
    async (request, reply) => {
      const size = await reference.createSize(request.adminSession!.staffId, request.body);
      return reply.code(201).send(size);
    },
  );

  app.patch(
    '/sizes/:id',
    {
      config: { permission: 'catalog:manage' },
      schema: { params: CatalogIdParams, body: UpdateSizeRequest, response: { 200: Size } },
    },
    async (request) =>
      reference.updateSize(request.adminSession!.staffId, request.params.id, request.body),
  );

  app.delete(
    '/sizes/:id',
    {
      config: { permission: 'catalog:manage' },
      schema: { params: CatalogIdParams, response: { 204: z.null() } },
    },
    async (request, reply) => {
      await reference.deleteSize(request.params.id);
      return reply.code(204).send(null);
    },
  );

  // Colors -------------------------------------------------------------------

  app.get(
    '/colors',
    { config: { permission: 'catalog:read' }, schema: { response: { 200: ColorListResponse } } },
    async () => ({ data: await reference.listColors() }),
  );

  app.post(
    '/colors',
    {
      config: { permission: 'catalog:manage' },
      schema: { body: CreateColorRequest, response: { 201: Color } },
    },
    async (request, reply) => {
      const color = await reference.createColor(request.adminSession!.staffId, request.body);
      return reply.code(201).send(color);
    },
  );

  app.patch(
    '/colors/:id',
    {
      config: { permission: 'catalog:manage' },
      schema: { params: CatalogIdParams, body: UpdateColorRequest, response: { 200: Color } },
    },
    async (request) =>
      reference.updateColor(request.adminSession!.staffId, request.params.id, request.body),
  );

  app.delete(
    '/colors/:id',
    {
      config: { permission: 'catalog:manage' },
      schema: { params: CatalogIdParams, response: { 204: z.null() } },
    },
    async (request, reply) => {
      await reference.deleteColor(request.params.id);
      return reply.code(204).send(null);
    },
  );
};
