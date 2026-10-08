import {
  AddCartItemRequest,
  CART_TOKEN_HEADER,
  CartLineParams,
  CreateCartResponse,
  StoreCart,
  UpdateCartItemRequest,
} from '@ite/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import type { StoreCartService } from './service.ts';

/**
 * /api/v1/store/cart — guest carts (store-cart-api spec). The cart is named only by the
 * `X-Cart-Token` header; cookies and authorization headers are never read. Nothing is cacheable.
 */
export const storeCartRoutes: FastifyPluginAsyncZod<{ carts: StoreCartService }> = async (
  app,
  { carts },
) => {
  app.addHook('onRequest', async (_request, reply) => {
    reply.header('cache-control', 'no-store');
  });
  const token = (headers: Record<string, string | string[] | undefined>) => {
    const value = headers[CART_TOKEN_HEADER];
    return typeof value === 'string' ? value : undefined;
  };

  app.post(
    '/cart',
    { schema: { response: { 201: CreateCartResponse } } },
    async (_request, reply) => reply.code(201).send(await carts.create()),
  );

  app.get('/cart', { schema: { response: { 200: StoreCart } } }, async (request) =>
    carts.get(token(request.headers)),
  );

  app.post(
    '/cart/items',
    { schema: { body: AddCartItemRequest, response: { 200: StoreCart } } },
    async (request) => carts.addItem(token(request.headers), request.body),
  );

  app.patch(
    '/cart/items/:lineId',
    {
      schema: { params: CartLineParams, body: UpdateCartItemRequest, response: { 200: StoreCart } },
    },
    async (request) =>
      carts.updateItem(token(request.headers), request.params.lineId, request.body.quantity),
  );

  app.delete(
    '/cart/items/:lineId',
    { schema: { params: CartLineParams, response: { 200: StoreCart } } },
    async (request) => carts.removeItem(token(request.headers), request.params.lineId),
  );
};
