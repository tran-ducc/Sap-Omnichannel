/**
 * Shops operate on Vietnam time (UTC+7, no DST). Day boundaries for reports
 * are computed in that zone and converted back to UTC instants for queries.
 */
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC instant of 00:00 Vietnam time on the day containing `at`, shifted by `days`. */
export function startOfVnDay(at: Date = new Date(), days = 0): Date {
  const local = new Date(at.getTime() + VN_OFFSET_MS);
  const midnightLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return new Date(midnightLocal - VN_OFFSET_MS + days * DAY_MS);
}

/** UTC instant of 00:00 Vietnam time on the 1st of the month containing `at`, shifted by `months`. */
export function startOfVnMonth(at: Date = new Date(), months = 0): Date {
  const local = new Date(at.getTime() + VN_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + months, 1) - VN_OFFSET_MS);
}

/** "2026-10-30" for the Vietnam calendar day of `at`. */
export function vnDateKey(at: Date): string {
  return new Date(at.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}
