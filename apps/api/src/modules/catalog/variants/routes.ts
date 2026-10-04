import {
  CatalogIdParams,
  CreateVariantRequest,
  ProductVariant,
  StockAdjustmentRequest,
  StockAdjustmentResult,
  UpdateVariantRequest,
  VariantParams,
} from '@ite/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import type { VariantService } from './service.ts';

/**
 * /api/v1/admin/products/:id/variants — variants and stock (product-variants-inventory spec).
 * All need `catalog:manage`; variants are read through the product detail. No delete route:
 * variants are deactivated. Stock changes only through adjustments.
 */
export const variantRoutes: FastifyPluginAsyncZod<{ variants: VariantService }> = async (
  app,
  { variants },
) => {
  app.post(
    '/products/:id/variants',
    {
      config: { permission: 'catalog:manage' },
      schema: {
        params: CatalogIdParams,
        body: CreateVariantRequest,
        response: { 201: ProductVariant },
      },
    },
    async (request, reply) => {
      const variant = await variants.create(
        request.adminSession!.staffId,
        request.params.id,
        request.body,
      );
      return reply.code(201).send(variant);
    },
  );

  app.patch(
    '/products/:id/variants/:variantId',
    {
      config: { permission: 'catalog:manage' },
      schema: {
        params: VariantParams,
        body: UpdateVariantRequest,
        response: { 200: ProductVariant },
      },
    },
    async (request) =>
      variants.update(
        request.adminSession!.staffId,
        request.params.id,
        request.params.variantId,
        request.body,
      ),
  );

  app.post(
    '/products/:id/variants/:variantId/activate',
    {
      config: { permission: 'catalog:manage' },
      schema: { params: VariantParams, response: { 200: ProductVariant } },
    },
    async (request) =>
      variants.activate(request.adminSession!.staffId, request.params.id, request.params.variantId),
  );

  app.post(
    '/products/:id/variants/:variantId/deactivate',
    {
      config: { permission: 'catalog:manage' },
      schema: { params: VariantParams, response: { 200: ProductVariant } },
    },
    async (request) =>
      variants.deactivate(
        request.adminSession!.staffId,
        request.params.id,
        request.params.variantId,
      ),
  );

  app.post(
    '/products/:id/variants/:variantId/stock-adjustments',
    {
      config: { permission: 'catalog:manage' },
      schema: {
        params: VariantParams,
        body: StockAdjustmentRequest,
        response: { 200: StockAdjustmentResult },
      },
    },
    async (request) =>
      variants.adjustStock(
        request.adminSession!.staffId,
        request.params.id,
        request.params.variantId,
        request.body.delta,
      ),
  );
};
