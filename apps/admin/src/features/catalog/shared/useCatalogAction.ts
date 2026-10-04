'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { authRedirectFor } from '../../../lib/api/errors.ts';

import { formProblem, toCatalogProblem, type CatalogProblem } from './problem.ts';
import { nextSuccessAt } from './success.ts';

type RunOptions<T> = {
  /** Announced in a polite live region after the API confirms the change. */
  success?: string | ((result: T) => string);
  /** Re-render from fresh server data after success (default true). */
  refresh?: boolean;
};

/**
 * Runs one catalog mutation at a time for a form or control (design D3):
 * - `busy` while the request is in flight, so the control can be disabled and marked busy;
 * - nothing is shown as done until the API confirms (no optimistic updates);
 * - on success, server data is refreshed and a success message is set;
 * - a 401 or temporary password redirects; other failures become a `CatalogProblem`, and focus
 *   moves to the error summary attached to `summaryRef`.
 */
export function useCatalogAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<CatalogProblem | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  /** When `success` was set, so a page with several actions can show only the newest message. */
  const [successAt, setSuccessAt] = useState(0);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (problem) summaryRef.current?.focus();
  }, [problem]);

  const run = useCallback(
    async <T>(action: () => Promise<T>, options: RunOptions<T> = {}): Promise<T | undefined> => {
      setBusy(true);
      setProblem(null);
      setSuccess(null);
      try {
        const result = await action();
        if (options.refresh !== false) router.refresh();
        if (options.success) {
          setSuccess(
            typeof options.success === 'string' ? options.success : options.success(result),
          );
          setSuccessAt(nextSuccessAt());
        }
        return result;
      } catch (error) {
        const target = authRedirectFor(error);
        if (target) {
          router.replace(target);
          return undefined;
        }
        setProblem(toCatalogProblem(error));
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  /** Shows errors found before sending (the request is not made). */
  const reject = useCallback((fieldErrors: Record<string, string>) => {
    setSuccess(null);
    setProblem(formProblem(fieldErrors));
  }, []);

  const clear = useCallback(() => {
    setProblem(null);
    setSuccess(null);
  }, []);

  return { run, reject, clear, busy, problem, success, successAt, summaryRef };
}

export type CatalogAction = ReturnType<typeof useCatalogAction>;
