/** Minimal session shape for streak calculation. */
export interface StreakSession {
  timestamp: number;
  type: string;
}

/** Local calendar day as YYYY-MM-DD (matches how the UI shows "today"). */
export function toLocalDayKey(timestamp: number): string {
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Previous local calendar day key (handles month/year boundaries and DST). */
export function previousLocalDayKey(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const prev = new Date(y, m - 1, d - 1);
  return toLocalDayKey(prev.getTime());
}

/**
 * Current streak of consecutive local calendar days that have at least one
 * work session, counting backwards from the most recent work day.
 */
export function calcStreak(sessions: StreakSession[]): number {
  const work = sessions.filter((s) => s.type === 'work');
  if (work.length === 0) return 0;

  const unique = [
    ...new Set(work.map((s) => toLocalDayKey(s.timestamp))),
  ].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));

  let streak = 1;
  for (let i = 1; i < unique.length; i++) {
    if (previousLocalDayKey(unique[i - 1]!) === unique[i]) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}
