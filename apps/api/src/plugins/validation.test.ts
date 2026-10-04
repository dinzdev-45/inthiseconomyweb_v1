import { ProblemDetails } from '@ite/contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { buildTestApp } from '../../test/support/app.ts';

let app: FastifyInstance;
let handled: number;

const Body = z.strictObject({ email: z.email(), quantity: z.int().min(1) });
const Params = z.strictObject({ id: z.uuidv7() });
const Query = z.strictObject({ limit: z.coerce.number().int().max(100).optional() });
const Reply = z.strictObject({ id: z.string(), email: z.email() });

beforeEach(async () => {
  handled = 0;
  app = await buildTestApp({
    setup: (a) => {
      const typed = a.withTypeProvider<ZodTypeProvider>();
      typed.post(
        '/test/items/:id',
        { schema: { params: Params, querystring: Query, body: Body, response: { 200: Reply } } },
        async (request) => {
          handled += 1;
          return { id: request.params.id, email: request.body.email };
        },
      );
      typed.get('/test/leaky', { schema: { response: { 200: Reply } } }, async () => {
        return { id: '1', email: 'a@example.com', passwordHash: 'secret' } as never;
      });
    },
  });
});
afterEach(async () => app.close());

const ID = '0199a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b';
const post = (payload: unknown, url = `/test/items/${ID}`) =>
  app.inject({ method: 'POST', url, payload: payload as object });

describe('api-conventions: Request validation', () => {
  it('Invalid body', async () => {
    const res = await post({ quantity: 'three' });

    expect(res.statusCode).toBe(400);
    const body = ProblemDetails.parse(res.json());
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(body.errors?.map((e) => e.path).sort()).toEqual(['email', 'quantity']);
    for (const error of body.errors ?? []) expect(error.message.length).toBeGreaterThan(0);
    expect(handled).toBe(0);
  });

  it('Unknown property', async () => {
    const res = await post({ email: 'a@example.com', quantity: 1, role: 'OWNER' });

    expect(res.statusCode).toBe(400);
    expect(ProblemDetails.parse(res.json()).errors).toEqual([
      { path: 'role', message: 'Unknown property "role"' },
    ]);
    expect(handled).toBe(0);
  });

  it('validates path parameters and query strings with prefixed paths', async () => {
    const badParams = await post({ email: 'a@example.com', quantity: 1 }, '/test/items/42');
    expect(badParams.statusCode).toBe(400);
    expect(badParams.json().errors[0].path).toBe('params.id');

    const badQuery = await post(
      { email: 'a@example.com', quantity: 1 },
      `/test/items/${ID}?limit=500`,
    );
    expect(badQuery.statusCode).toBe(400);
    expect(badQuery.json().errors[0].path).toBe('query.limit');
    expect(handled).toBe(0);
  });

  it('runs the handler and serializes the response for a valid request', async () => {
    const res = await post({ email: 'a@example.com', quantity: 2 }, `/test/items/${ID}?limit=10`);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ id: ID, email: 'a@example.com' });
    expect(handled).toBe(1);
  });

  it('refuses to send a response that does not match its schema', async () => {
    const res = await app.inject({ method: 'GET', url: '/test/leaky' });
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('secret');
  });
});
