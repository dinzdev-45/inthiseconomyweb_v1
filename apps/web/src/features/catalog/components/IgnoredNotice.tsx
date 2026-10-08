/** Shown when the URL had filter, sort, or page values that were not recognized. */
export function IgnoredNotice() {
  return (
    <p
      role="note"
      className="mt-4 border-l-2 border-brand pl-3 text-sm text-ink"
      data-ignored-notice
    >
      Some filters in this link weren’t recognized and were ignored.
    </p>
  );
}
