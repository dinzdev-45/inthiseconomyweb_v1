import 'server-only';

import { CART_TOKEN_HEADER, HealthResponse, ProblemDetails, type ErrorCode } from '@ite/contracts';
import type { z } from 'zod';

import { loadEnv } from '../../env.ts';

/** A failed store API call, with the server's problem details when it sent any. */
export class StoreApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | undefined;
  readonly requestId: string | undefined;
  /** The problem details the API sent, if any (field errors live in `problem.errors`). */
  readonly problem: ProblemDetails | undefined;

  constructor(status: number, problem?: ProblemDetails) {
    super(problem?.detail ?? `Store API request failed with status ${status}.`);
    this.name = 'StoreApiError';
    this.status = status;
    this.code = problem?.code;
    this.requestId = problem?.requestId;
    this.problem = problem;
  }
}

type StorePath = `/api/v1/store/${string}` | '/health';

/**
 * Server-side GET to apps/api. The storefront never calls the API from the
 * browser and sends no credentials (the store zone is public). Responses are
 * validated with the shared @ite/contracts schema; failures throw.
 */
export async function storeGet<S extends z.ZodType>(
  path: StorePath,
  schema: S,
  init: { revalidate?: number } = {},
): Promise<z.infer<S>> {
  const response = await fetch(`${loadEnv().API_URL}${path}`, {
    method: 'GET',
    headers: { accept: 'application/json' },
    ...(init.revalidate === undefined
      ? { cache: 'no-store' }
      : { next: { revalidate: init.revalidate } }),
  });
  return parseResponse(response, schema);
}

/** The validated body of a successful response; a failure becomes a StoreApiError. */
async function parseResponse<S extends z.ZodType>(
  response: Response,
  schema: S,
): Promise<z.infer<S>> {
  if (!response.ok) {
    const problem = response.headers.get('content-type')?.includes('application/problem+json')
      ? ProblemDetails.safeParse(await response.json().catch(() => undefined))
      : undefined;
    throw new StoreApiError(response.status, problem?.success ? problem.data : undefined);
  }
  return schema.parse(await response.json());
}

/**
 * Server-side call to the store API that is never cached, for carts (guest-cart design D5):
 * any method, an optional JSON body, and the cart token in `X-Cart-Token` when given (never in
 * the URL). Same validation and errors as `storeGet`.
 */
export async function storeRequest<S extends z.ZodType>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: `/api/v1/store/${string}`,
  schema: S,
  {
    cartToken,
    body,
    headers = {},
  }: { cartToken?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<z.infer<S>> {
  const response = await fetch(`${loadEnv().API_URL}${path}`, {
    method,
    headers: {
      accept: 'application/json',
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(cartToken === undefined ? {} : { [CART_TOKEN_HEADER]: cartToken }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: 'no-store',
  });
  return parseResponse(response, schema);
}

/** Liveness of the API, used by the placeholder home page. */
export function getApiHealth() {
  return storeGet('/health', HealthResponse);
}
