import 'server-only';

import { HealthResponse, ProblemDetails, type ErrorCode } from '@ite/contracts';
import type { z } from 'zod';

import { loadEnv } from '../../env.ts';

/** A failed store API call, with the server's problem details when it sent any. */
export class StoreApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | undefined;
  readonly requestId: string | undefined;

  constructor(status: number, problem?: ProblemDetails) {
    super(problem?.detail ?? `Store API request failed with status ${status}.`);
    this.name = 'StoreApiError';
    this.status = status;
    this.code = problem?.code;
    this.requestId = problem?.requestId;
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
  if (!response.ok) {
    const problem = response.headers.get('content-type')?.includes('application/problem+json')
      ? ProblemDetails.safeParse(await response.json().catch(() => undefined))
      : undefined;
    throw new StoreApiError(response.status, problem?.success ? problem.data : undefined);
  }
  return schema.parse(await response.json());
}

/** Liveness of the API, used by the placeholder home page. */
export function getApiHealth() {
  return storeGet('/health', HealthResponse);
}
