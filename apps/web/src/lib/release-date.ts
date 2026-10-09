/**
 * Time zone for presenting release dates. Placeholder pricing uses IDR, so dates
 * follow Jakarta time for now; change here when the market is decided.
 */
export const STORE_TIME_ZONE = 'Asia/Jakarta';

/** "1 November 2026 at 10:00 WIB": a release date and time in Western Indonesian Time. */
export function formatReleaseDateTime(iso: string, timeZone = STORE_TIME_ZONE): string {
  const text = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(iso));
  return `${text} WIB`;
}

/** "1 October 2026"-style date for an ISO timestamp, in the store's time zone. */
export function formatReleaseDate(iso: string, timeZone = STORE_TIME_ZONE): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone,
  }).format(new Date(iso));
}
