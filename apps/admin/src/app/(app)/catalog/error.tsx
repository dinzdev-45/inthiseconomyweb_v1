'use client';

import { Button } from '@/components/ui';

/**
 * Catalog page error boundary: a generic message, the error digest as a reference (it matches
 * the server log entry), and a retry. Internal details are never shown.
 */
export default function CatalogError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section role="alert" className="space-y-3">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-muted">This catalog page could not be loaded. Please try again.</p>
      {error.digest ? <p className="text-xs text-muted">Reference: {error.digest}</p> : null}
      <Button type="button" variant="secondary" onClick={reset}>
        Try again
      </Button>
    </section>
  );
}
