import type { ErrorCode, FieldError } from '@ite/contracts';

/**
 * An expected, client-facing failure (a business rule, missing session,
 * unavailable dependency). The error handler turns it into a problem body
 * with this status, code, and detail; nothing else from the error is exposed.
 */
export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly detail: string;
  /** Optional itemized problems (e.g. what a drop still needs before publishing). */
  readonly errors: FieldError[] | undefined;

  constructor(code: ErrorCode, status: number, detail: string, errors?: FieldError[]) {
    super(detail);
    this.name = 'DomainError';
    this.code = code;
    this.status = status;
    this.detail = detail;
    this.errors = errors;
  }
}
