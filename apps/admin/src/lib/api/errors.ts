import { ProblemDetails, type ErrorCode, type FieldError } from '@ite/contracts';

/** A failed API call, carrying the server's problem details when it sent any. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | undefined;
  readonly detail: string;
  readonly errors: FieldError[];
  readonly requestId: string | undefined;

  constructor(status: number, problem?: ProblemDetails, requestId?: string) {
    super(problem?.detail ?? `Request failed with status ${status}.`);
    this.name = 'ApiError';
    this.status = status;
    this.code = problem?.code;
    this.detail = problem?.detail ?? 'Something went wrong. Please try again.';
    this.errors = problem?.errors ?? [];
    this.requestId = problem?.requestId ?? requestId;
  }

  /** Field-level messages keyed by field path, for forms. */
  fieldErrors(): Record<string, string> {
    return Object.fromEntries(this.errors.map((error) => [error.path, error.message]));
  }
}

/**
 * Builds an ApiError from a non-OK response, parsing `application/problem+json` when present.
 * Without a problem body, the `X-Request-Id` header (when the API set one) is kept as the
 * reference to quote for support.
 */
export async function toApiError(response: Response): Promise<ApiError> {
  if (response.headers.get('content-type')?.includes('application/problem+json')) {
    const parsed = ProblemDetails.safeParse(await response.json().catch(() => undefined));
    if (parsed.success) return new ApiError(response.status, parsed.data);
  }
  return new ApiError(
    response.status,
    undefined,
    response.headers.get('x-request-id') ?? undefined,
  );
}

/** Where the UI should send the user for an authentication-related error, if anywhere. */
export function authRedirectFor(error: unknown): '/login' | '/account/password' | null {
  if (!(error instanceof ApiError)) return null;
  if (error.status === 401) return '/login';
  if (error.code === 'PASSWORD_CHANGE_REQUIRED') return '/account/password';
  return null;
}
