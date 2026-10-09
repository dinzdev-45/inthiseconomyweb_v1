import type { ProblemDetails } from '@ite/contracts';
import { describe, expect, it } from 'vitest';

import { ApiError, toApiError } from '../../../lib/api/errors.ts';

import {
  GENERIC_MESSAGE,
  NOT_PERMITTED_MESSAGE,
  VALIDATION_SUMMARY,
  formProblem,
  toCatalogProblem,
} from './problem.ts';

const apiError = (status: number, fields: Partial<ProblemDetails> = {}) =>
  new ApiError(status, {
    type: 'about:blank',
    title: 'Error',
    status,
    detail: `detail ${status}`,
    requestId: 'req-42',
    ...fields,
  });

describe('toCatalogProblem', () => {
  it('maps 400 field errors to a summary plus per-field messages', () => {
    const problem = toCatalogProblem(
      apiError(400, {
        code: 'VALIDATION_FAILED',
        errors: [
          { path: 'basePrice.amount', message: 'Too big' },
          { path: 'name', message: 'Required' },
        ],
      }),
    );
    expect(problem).toEqual({
      kind: 'validation',
      message: VALIDATION_SUMMARY,
      fieldErrors: { 'basePrice.amount': 'Too big', name: 'Required' },
      code: 'VALIDATION_FAILED',
    });
  });

  it('keeps the API detail for a 400 without field errors (e.g. an invalid cursor)', () => {
    const problem = toCatalogProblem(
      apiError(400, { code: 'VALIDATION_FAILED', detail: 'The cursor is invalid.' }),
    );
    expect(problem).toMatchObject({
      kind: 'validation',
      message: 'The cursor is invalid.',
      fieldErrors: {},
    });
  });

  it('maps 401 and a temporary password to the session kind', () => {
    expect(toCatalogProblem(apiError(401, { code: 'UNAUTHENTICATED' })).kind).toBe('session');
    expect(toCatalogProblem(apiError(403, { code: 'PASSWORD_CHANGE_REQUIRED' })).kind).toBe(
      'session',
    );
  });

  it('maps 403 FORBIDDEN to not permitted', () => {
    expect(toCatalogProblem(apiError(403, { code: 'FORBIDDEN' }))).toEqual({
      kind: 'not-permitted',
      message: NOT_PERMITTED_MESSAGE,
      fieldErrors: {},
      code: 'FORBIDDEN',
    });
  });

  it('maps 404 to not found with the API detail', () => {
    expect(
      toCatalogProblem(apiError(404, { code: 'NOT_FOUND', detail: 'Product not found.' })),
    ).toEqual({
      kind: 'not-found',
      message: 'Product not found.',
      fieldErrors: {},
      code: 'NOT_FOUND',
    });
  });

  it.each([
    ['SLUG_EXISTS', 409, 'slug'],
    ['SLUG_LOCKED', 409, 'slug'],
    ['SKU_EXISTS', 409, 'sku'],
    ['SKU_LOCKED', 409, 'sku'],
    ['CODE_EXISTS', 409, 'code'],
    ['VARIANT_EXISTS', 409, 'sizeId'],
    ['VARIANT_MISMATCH', 422, 'variantId'],
  ] as const)('places %s (%i) at the %s field with the API detail', (code, status, field) => {
    const problem = toCatalogProblem(apiError(status, { code, detail: `explained ${code}` }));
    expect(problem).toEqual({
      kind: 'rejected',
      message: `explained ${code}`,
      fieldErrors: { [field]: `explained ${code}` },
      code,
    });
  });

  it.each([
    ['PRODUCT_NOT_READY', 409],
    ['INSUFFICIENT_STOCK', 409],
    ['LAST_ACTIVE_VARIANT', 409],
    ['LAST_IMAGE', 409],
    ['IN_USE', 409],
    ['INVALID_STATE_TRANSITION', 409],
    ['IMAGE_LIMIT', 409],
    ['CURRENCY_MISMATCH', 422],
    ['UNKNOWN_REFERENCE', 422],
  ] as const)('shows %s (%i) as the API explanation, verbatim', (code, status) => {
    const detail =
      code === 'PRODUCT_NOT_READY'
        ? 'The product is not ready to activate: it has no active variant; it has no images.'
        : `explained ${code}`;
    expect(toCatalogProblem(apiError(status, { code, detail }))).toEqual({
      kind: 'rejected',
      message: detail,
      fieldErrors: {},
      code,
    });
  });

  it("keeps a refusal's itemised messages (what a drop still needs to publish)", () => {
    const problem = toCatalogProblem(
      apiError(409, {
        code: 'DROP_NOT_READY',
        detail: 'The drop cannot be published yet: it needs an image, at least one product.',
        errors: [
          { path: 'image', message: 'an image' },
          { path: 'products', message: 'at least one product' },
        ],
      }),
    );
    expect(problem).toMatchObject({
      kind: 'rejected',
      code: 'DROP_NOT_READY',
      fieldErrors: {},
      items: ['an image', 'at least one product'],
    });
  });

  it('maps 5xx to a generic message with the request id as reference', () => {
    const problem = toCatalogProblem(
      apiError(500, { code: 'INTERNAL_ERROR', detail: 'An unexpected error occurred.' }),
    );
    expect(problem).toEqual({
      kind: 'unexpected',
      message: GENERIC_MESSAGE,
      fieldErrors: {},
      code: 'INTERNAL_ERROR',
      reference: 'req-42',
    });
  });

  it('maps a 409 without a code, and other statuses, to unexpected', () => {
    expect(toCatalogProblem(apiError(409)).kind).toBe('unexpected');
    expect(toCatalogProblem(apiError(429, { code: 'RATE_LIMITED' })).kind).toBe('unexpected');
    expect(toCatalogProblem(apiError(503, { code: 'SERVICE_UNAVAILABLE' })).reference).toBe(
      'req-42',
    );
  });

  it('maps non-API errors (network failure, schema mismatch) to unexpected without a reference', () => {
    expect(toCatalogProblem(new TypeError('Failed to fetch'))).toEqual({
      kind: 'unexpected',
      message: GENERIC_MESSAGE,
      fieldErrors: {},
    });
  });

  it('keeps the X-Request-Id header as the reference when the response is not problem+json', async () => {
    const error = await toApiError(
      new Response('<html>Bad gateway</html>', {
        status: 502,
        headers: { 'content-type': 'text/html', 'x-request-id': 'req-from-header' },
      }),
    );
    expect(toCatalogProblem(error)).toMatchObject({
      kind: 'unexpected',
      reference: 'req-from-header',
    });
    // Never the raw body.
    expect(toCatalogProblem(error).message).toBe(GENERIC_MESSAGE);
  });
});

describe('formProblem', () => {
  it('shows checks made before sending like API validation errors', () => {
    expect(formProblem({ 'basePrice.amount': 'Enter an amount.' })).toEqual({
      kind: 'validation',
      message: VALIDATION_SUMMARY,
      fieldErrors: { 'basePrice.amount': 'Enter an amount.' },
    });
  });
});
