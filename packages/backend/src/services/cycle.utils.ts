import { and, eq } from 'drizzle-orm';
import { db, schema } from '../db/index.js';

/**
 * Given a spend date and the configured cycle start day, return the YYYY-MM
 * bucket the date belongs to.
 *
 * cycleStartDay >= 2:
 *   day >= cycleStartDay  → next calendar month
 *   day <  cycleStartDay  → current calendar month
 *
 * cycleStartDay <= 1 (default): plain calendar month.
 */
export function getCycleMonth(spendDate: string, cycleStartDay: number): string {
  if (cycleStartDay <= 1) return spendDate.slice(0, 7);

  const d = new Date(spendDate + 'T00:00:00');
  const day = d.getDate();

  if (day >= cycleStartDay) {
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Return the inclusive start/end ISO dates (YYYY-MM-DD) for a given cycle
 * bucket.
 *
 * Cycle "YYYY-MM" with cycleStartDay D (>= 2):
 *   start = D-th of previous month
 *   end   = (D-1)-th of this month
 *
 * cycleStartDay <= 1: start = 1st of month, end = last day of month.
 */
export function getCycleDateRange(
  month: string,
  cycleStartDay: number,
): { start: string; end: string } {
  const [y, m] = month.split('-').map(Number);

  if (cycleStartDay <= 1) {
    const lastDay = new Date(y, m, 0).getDate();
    return {
      start: `${y}-${String(m).padStart(2, '0')}-01`,
      end: `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    };
  }

  // Previous month
  const prevDate = new Date(y, m - 2, 1); // m-1 is current (0-indexed), m-2 is prev
  const prevY = prevDate.getFullYear();
  const prevM = prevDate.getMonth() + 1;

  const endDay = cycleStartDay - 1;

  return {
    start: `${prevY}-${String(prevM).padStart(2, '0')}-${String(cycleStartDay).padStart(2, '0')}`,
    end: `${y}-${String(m).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`,
  };
}

/**
 * Read the persisted cycle start day from app_settings for the given user.
 * Returns 1 (calendar month) when not configured.
 */
export async function getCycleStartDay(userId: string): Promise<number> {
  const row = await db
    .select()
    .from(schema.appSettings)
    .where(and(eq(schema.appSettings.key, 'cycleStartDay'), eq(schema.appSettings.userId, userId)))
    .limit(1)
    .then((r) => r[0]);
  return row ? parseInt(row.value, 10) || 1 : 1;
}
