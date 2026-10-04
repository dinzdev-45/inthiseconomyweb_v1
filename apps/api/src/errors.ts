import type { ErrorCode } from '@ite/contracts';

/**
 * An expected, client-facing failure (a business rule, missing session,
 * unavailable dependency). The error handler turns it into a problem body
 * with this status, code, and detail; nothing else from the error is exposed.
 */
export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly detail: string;

  constructor(code: ErrorCode, status: number, detail: string) {
    super(detail);
    this.name = 'DomainError';
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}
