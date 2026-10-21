/**
 * Calendar-date helpers. The API stores `YYYY-MM-DD` string dates and derives
 * "today" from the account's profile timezone, never the server's local zone.
 */

/** Formats an instant as `YYYY-MM-DD` in the supplied IANA timezone. */
export function localDate(date: Date, timeZone = 'Africa/Lagos'): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

/** Today's calendar date in the supplied IANA timezone. */
export function todayInZone(timeZone = 'Africa/Lagos', now = new Date()): string {
  return localDate(now, timeZone);
}

/** Whole-day difference between two `YYYY-MM-DD` dates (later - earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

/** UTC midnight for a `YYYY-MM-DD` date, matching how dates are persisted. */
export function utcMidnight(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}
