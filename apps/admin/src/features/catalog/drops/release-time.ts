/*
 * Drop release times in the admin (admin-drops spec, drops design D6). Staff enter them as a
 * date and time in Western Indonesian Time (WIB, UTC+07:00, no daylight saving time) in a
 * `datetime-local` field; the API stores and returns UTC instants.
 */

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** A `datetime-local` value ("2099-01-01T10:00") showing an instant in WIB. */
export function toWibInput(iso: string): string {
  return new Date(Date.parse(iso) + WIB_OFFSET_MS).toISOString().slice(0, 16);
}

/**
 * The UTC instant (ISO 8601) for a `datetime-local` value read as WIB, or null when the value is
 * not a real date and time (seconds are not accepted; the field asks for minutes).
 */
export function fromWibInput(value: string): string | null {
  const match = LOCAL.exec(value.trim());
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number) as number[];
  const ms = Date.UTC(year!, month! - 1, day!, hour!, minute!) - WIB_OFFSET_MS;
  const iso = new Date(ms).toISOString();
  // Date.UTC rolls over (31 April becomes 1 May); a real date reads back unchanged.
  return toWibInput(iso) === value.trim() ? iso : null;
}

const FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Asia/Jakarta',
});

/** A release time for display, e.g. "1 Jan 2099, 10:00 WIB". */
export function formatWib(iso: string): string {
  return `${FORMAT.format(new Date(iso))} WIB`;
}
