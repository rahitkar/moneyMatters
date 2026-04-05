const USER_TZ = 'Asia/Kolkata';

/** Returns today's calendar date as YYYY-MM-DD in the user's timezone (IST). */
export function todayLocal(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: USER_TZ }).format(new Date());
}

/** Converts a Date object to YYYY-MM-DD string in the user's timezone. */
export function dateToLocal(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: USER_TZ }).format(d);
}
