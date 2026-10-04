const FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZone: 'UTC',
});

/**
 * A timestamp for display, e.g. "4 Oct 2026, 09:15:30 UTC". Always UTC, so the server render and
 * the browser render produce the same text.
 */
export function formatTimestamp(iso: string): string {
  return `${FORMAT.format(new Date(iso))} UTC`;
}
