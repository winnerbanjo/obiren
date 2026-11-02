/**
 * Timezone helpers for doctor schedules.
 *
 * A doctor's weekly schedule is expressed in *their* wall-clock timezone
 * (Africa/Lagos, Europe/London, ...). Bookable slots are stored in UTC because
 * that is what the user app, the Doctor Portal and the database all agree on.
 *
 * These helpers use the platform `Intl` database, so DST transitions are
 * handled without adding a dependency. Every conversion is computed from the
 * zone's offset at the instant in question and refined once for the bracket
 * where an offset change occurs.
 */

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = formatters.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  formatters.set(timeZone, formatter);
  return formatter;
}

/** Throws on an invalid IANA zone so callers can reject bad input early. */
export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone || timeZone.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

function zoneParts(date: Date, timeZone: string) {
  const parts = formatterFor(timeZone).formatToParts(date);
  const values: Record<string, number> = {};
  for (const part of parts) {
    if (part.type === 'literal') continue;
    values[part.type] = Number(part.value);
  }
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    // Intl can emit hour 24 for midnight in some zones/locales.
    hour: values.hour % 24,
    minute: values.minute,
    second: values.second,
  };
}

/** Offset of `timeZone` from UTC at `date`, in milliseconds (east positive). */
export function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const p = zoneParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  // Compare against the same instant rounded to whole seconds.
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * Converts a wall-clock date + minutes-from-midnight in `timeZone` to a UTC
 * instant. `dateKey` must be YYYY-MM-DD.
 */
export function zonedWallClockToUtc(dateKey: string, minutes: number, timeZone: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const firstGuess = wallClockAsUtc - timeZoneOffsetMs(new Date(wallClockAsUtc), timeZone);
  // A DST bracket changes the offset between the guess and the real instant.
  return new Date(wallClockAsUtc - timeZoneOffsetMs(new Date(firstGuess), timeZone));
}

/** The calendar date (YYYY-MM-DD) of `date` in `timeZone`. */
export function localDateKey(date: Date, timeZone: string): string {
  const p = zoneParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Day of week in `timeZone` (0 = Sunday). */
export function localDayOfWeek(date: Date, timeZone: string): number {
  const key = localDateKey(date, timeZone);
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Adds whole days to a YYYY-MM-DD key without any timezone drift. */
export function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

export const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
