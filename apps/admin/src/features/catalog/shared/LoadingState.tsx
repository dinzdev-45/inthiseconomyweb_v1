/** Placeholder while a catalog page loads (used by `loading.tsx`). */
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <section aria-busy="true" aria-live="polite" className="space-y-4">
      <p className="text-sm text-muted">{label}</p>
      <div className="space-y-2" aria-hidden="true">
        <div className="h-6 w-48 animate-pulse rounded bg-line" />
        <div className="h-4 w-full animate-pulse rounded bg-line" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-line" />
      </div>
    </section>
  );
}
