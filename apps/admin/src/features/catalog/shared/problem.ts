import type { ErrorCode } from '@ite/contracts';

import { ApiError } from '../../../lib/api/errors.ts';

/*
 * How a failed catalog request is shown (admin-catalog-ui spec, design D3). The API's own
 * messages are shown wherever they are meant for people (problem `detail` and field errors);
 * the admin never re-derives business rules such as readiness or stock limits from them.
 */

export type CatalogProblemKind =
  /** 400: the request was rejected field by field (or as a whole, e.g. an invalid cursor). */
  | 'validation'
  /** 401 or a temporary password: the caller should redirect (see `authRedirectFor`). */
  | 'session'
  /** 403 FORBIDDEN: the API refused the action for this staff member. */
  | 'not-permitted'
  /** 404: the record no longer exists. */
  | 'not-found'
  /** 409 or 422 with a catalog code: a business rule refused it; `message` is the API's detail. */
  | 'rejected'
  /** Anything else: a generic message, with the request id as a reference. */
  | 'unexpected';

export type CatalogProblem = {
  kind: CatalogProblemKind;
  /** Text for the error summary. */
  message: string;
  /** Messages keyed by form field name (API paths such as `basePrice.amount`). */
  fieldErrors: Record<string, string>;
  code?: ErrorCode;
  /** Request id to quote for unexpected failures. */
  reference?: string;
};

export const GENERIC_MESSAGE = 'Something went wrong. Please try again.';
export const NOT_PERMITTED_MESSAGE = 'You do not have permission to do this.';
export const VALIDATION_SUMMARY = 'Some fields need attention.';

/**
 * Codes whose explanation belongs next to one form field. The API detail is still the message;
 * only its placement is decided here. Forms name their fields after the request body paths.
 */
const FIELD_FOR_CODE: Partial<Record<ErrorCode, string>> = {
  SLUG_EXISTS: 'slug',
  SLUG_LOCKED: 'slug',
  SKU_EXISTS: 'sku',
  SKU_LOCKED: 'sku',
  CODE_EXISTS: 'code',
  VARIANT_EXISTS: 'sizeId',
  VARIANT_MISMATCH: 'variantId',
};

/** Maps any error from a catalog request to what the screen shows. */
export function toCatalogProblem(error: unknown): CatalogProblem {
  if (!(error instanceof ApiError)) {
    // Network failure, a bug, or a response that did not match its schema.
    return { kind: 'unexpected', message: GENERIC_MESSAGE, fieldErrors: {} };
  }
  const { status, code, detail } = error;

  if (status === 401 || code === 'PASSWORD_CHANGE_REQUIRED') {
    return { kind: 'session', message: detail, fieldErrors: {}, code };
  }
  if (status === 403) {
    return { kind: 'not-permitted', message: NOT_PERMITTED_MESSAGE, fieldErrors: {}, code };
  }
  if (status === 400) {
    const fieldErrors = error.fieldErrors();
    const hasFields = Object.keys(fieldErrors).length > 0;
    return {
      kind: 'validation',
      message: hasFields ? VALIDATION_SUMMARY : detail,
      fieldErrors,
      code,
    };
  }
  if (status === 404) {
    return { kind: 'not-found', message: detail, fieldErrors: {}, code };
  }
  if ((status === 409 || status === 422) && code) {
    const field = FIELD_FOR_CODE[code];
    return {
      kind: 'rejected',
      message: detail,
      fieldErrors: field ? { [field]: detail } : {},
      code,
    };
  }
  return {
    kind: 'unexpected',
    message: GENERIC_MESSAGE,
    fieldErrors: {},
    code,
    ...(error.requestId ? { reference: error.requestId } : {}),
  };
}

/**
 * A problem from a check made in the form before sending (for example an unreadable price),
 * shown exactly like an API validation error.
 */
export function formProblem(fieldErrors: Record<string, string>): CatalogProblem {
  return { kind: 'validation', message: VALIDATION_SUMMARY, fieldErrors };
}
