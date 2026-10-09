import {
  CART_TOKEN_HEADER,
  CheckoutSummary,
  ORDER_KEY_HEADER,
  PlaceOrderRequest,
  PlaceOrderResponse,
  StoreOrder,
} from '@ite/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import type { OrderService } from './service.ts';

const header = (headers: Record<string, string | string[] | undefined>, name: string) => {
  const value = headers[name];
  return typeof value === 'string' ? value : undefined;
};

/**
 * /api/v1/store — checkout and guest orders (store-checkout-api spec). The cart is named by
 * `X-Cart-Token`, an order's key comes only in `X-Order-Key`. Nothing is cacheable, and request
 * bodies (guest contact and address details) are never logged.
 */
export const orderRoutes: FastifyPluginAsyncZod<{ orders: OrderService }> = async (
  app,
  { orders },
) => {
  app.addHook('onRequest', async (_request, reply) => {
    reply.header('cache-control', 'no-store');
  });

  app.get('/checkout', { schema: { response: { 200: CheckoutSummary } } }, async (request) =>
    orders.summary(header(request.headers, CART_TOKEN_HEADER)),
  );

  app.post(
    '/orders',
    { schema: { body: PlaceOrderRequest, response: { 201: PlaceOrderResponse } } },
    async (request, reply) =>
      reply
        .code(201)
        .send(await orders.place(header(request.headers, CART_TOKEN_HEADER), request.body)),
  );

  app.get(
    '/orders/:number',
    // The number is checked by the service, so a malformed one is the same 404 as an unknown one.
    {
      schema: {
        params: z.strictObject({ number: z.string().max(64) }),
        response: { 200: StoreOrder },
      },
    },
    async (request) => orders.get(request.params.number, header(request.headers, ORDER_KEY_HEADER)),
  );
};
