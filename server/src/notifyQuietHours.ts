/**
 * Quiet hours for notification email/SMS (not OTP / ARCO / password reset).
 * Local 23:00–06:00 inclusive of 06:00; sends resume at 06:01.
 */

export const NOTIFY_QUIET_START_HOUR = 23;
export const NOTIFY_QUIET_END_HOUR = 6;
export const NOTIFY_QUIET_END_MINUTE = 1;

export function clockInTimeZone(
  date: Date,
  timeZone: string,
): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  const minute = Number(parts.find((p) => p.type === "minute")?.value);
  return {
    hour: Number.isFinite(hour) ? hour % 24 : 0,
    minute: Number.isFinite(minute) ? minute : 0,
  };
}

/** True from 23:00 through 06:00:59 local; false from 06:01. */
export function isNotifyQuietHours(date: Date, timeZone: string): boolean {
  const { hour, minute } = clockInTimeZone(date, timeZone);
  if (hour >= NOTIFY_QUIET_START_HOUR) return true;
  if (hour < NOTIFY_QUIET_END_HOUR) return true;
  if (hour === NOTIFY_QUIET_END_HOUR && minute < NOTIFY_QUIET_END_MINUTE) return true;
  return false;
}
