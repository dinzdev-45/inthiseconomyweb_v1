import { describe, expect, it } from 'vitest';

import { ErrorCode, ProblemDetails } from './errors.ts';

const base = {
  type: 'about:blank',
  title: 'Bad Request',
  status: 400,
  detail: 'The request body is invalid.',
  requestId: 'req-123',
};

describe('ErrorCode', () => {
  it.each(['STAFF_EMAIL_EXISTS', 'LAST_OWNER', 'RATE_LIMITED', 'PASSWORD_CHANGE_REQUIRED'])(
    'accepts spec code %s',
    (code) => expect(ErrorCode.safeParse(code).success).toBe(true),
  );

  it('rejects unknown codes', () => {
    expect(ErrorCode.safeParse('SOMETHING_ELSE').success).toBe(false);
  });
});

describe('ProblemDetails', () => {
  it('accepts the required fields alone', () => {
    expect(ProblemDetails.safeParse(base).success).toBe(true);
  });

  it('accepts optional code and field errors', () => {
    const body = {
      ...base,
      code: 'VALIDATION_FAILED',
      errors: [{ path: 'email', message: 'Required' }],
    };
    expect(ProblemDetails.safeParse(body).success).toBe(true);
  });

  it.each(['type', 'title', 'status', 'detail', 'requestId'])(
    'rejects a body missing %s',
    (key) => {
      const body: Record<string, unknown> = { ...base };
      delete body[key];
      expect(ProblemDetails.safeParse(body).success).toBe(false);
    },
  );

  it('rejects extra fields such as a stack trace', () => {
    expect(ProblemDetails.safeParse({ ...base, stack: 'Error: boom\n at x' }).success).toBe(false);
  });

  it.each([200, 399, 600, 400.5])('rejects non-error status %s', (status) => {
    expect(ProblemDetails.safeParse({ ...base, status }).success).toBe(false);
  });

  it('rejects an unknown code', () => {
    expect(ProblemDetails.safeParse({ ...base, code: 'NOPE' }).success).toBe(false);
  });

  it('rejects malformed field errors', () => {
    expect(ProblemDetails.safeParse({ ...base, errors: [{ path: 'email' }] }).success).toBe(false);
  });
});
