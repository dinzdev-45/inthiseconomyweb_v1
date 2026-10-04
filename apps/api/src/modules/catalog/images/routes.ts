import {
  CatalogIdParams,
  CreateImageRequest,
  ImageParams,
  ProductImage,
  ProductImageListResponse,
  ReorderImagesRequest,
  UpdateImageRequest,
} from '@ite/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import type { ImageService } from './service.ts';

/**
 * /api/v1/admin/products/:id/images — image metadata (product-management spec). All need
 * `catalog:manage`; images are read through the product detail. No files are uploaded or stored.
 */
export const imageRoutes: FastifyPluginAsyncZod<{ images: ImageService }> = async (
  app,
  { images },
) => {
  app.post(
    '/products/:id/images',
    {
      config: { permission: 'catalog:manage' },
      schema: {
        params: CatalogIdParams,
        body: CreateImageRequest,
        response: { 201: ProductImage },
      },
    },
    async (request, reply) => {
      const image = await images.add(
        request.adminSession!.staffId,
        request.params.id,
        request.body,
      );
      return reply.code(201).send(image);
    },
  );

  app.patch(
    '/products/:id/images/:imageId',
    {
      config: { permission: 'catalog:manage' },
      schema: { params: ImageParams, body: UpdateImageRequest, response: { 200: ProductImage } },
    },
    async (request) =>
      images.update(
        request.adminSession!.staffId,
        request.params.id,
        request.params.imageId,
        request.body,
      ),
  );

  app.delete(
    '/products/:id/images/:imageId',
    {
      config: { permission: 'catalog:manage' },
      schema: { params: ImageParams, response: { 204: z.null() } },
    },
    async (request, reply) => {
      await images.delete(request.adminSession!.staffId, request.params.id, request.params.imageId);
      return reply.code(204).send(null);
    },
  );

  app.put(
    '/products/:id/images/order',
    {
      config: { permission: 'catalog:manage' },
      schema: {
        params: CatalogIdParams,
        body: ReorderImagesRequest,
        response: { 200: ProductImageListResponse },
      },
    },
    async (request) => ({
      data: await images.reorder(request.adminSession!.staffId, request.params.id, request.body),
    }),
  );
};
