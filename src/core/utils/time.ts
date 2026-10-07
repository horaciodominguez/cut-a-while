const MAX_DISPLAY_SECONDS = 99 * 60 + 59; // 5999

export function isSameCalendarDay(ts: number, now = Date.now()): boolean {
  const d = new Date(ts);
  const n = new Date(now);
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

/** True only while the long break earned by a full cycle is the current phase. */
export function isLongBreakPhase(
  completedSessions: number,
  interval: number,
  cycleType: 'work' | 'break',
): boolean {
  if (cycleType !== 'break' || interval <= 0) return false;
  return completedSessions > 0 && completedSessions % interval === 0;
}

/** Sessions still needed before the next long break. A finished cycle counts as a fresh start. */
export function sessionsUntilLongBreak(completedSessions: number, interval: number): number {
  if (interval <= 0) return 0;
  const mod = completedSessions % interval;
  return mod === 0 ? interval : interval - mod;
}

export function todayWorkSessions<T extends { type: string; timestamp: number }>(
  sessions: readonly T[],
  now = Date.now(),
): T[] {
  return sessions.filter((session) => session.type === 'work' && isSameCalendarDay(session.timestamp, now));
}

export function completionNotice(
  finished: 'work' | 'break',
  state: { status: string; completedSessions: number; cycleType: 'work' | 'break' },
  interval: number,
): string {
  if (finished === 'work') {
    return isLongBreakPhase(state.completedSessions, interval, state.cycleType)
      ? 'Focus done — long break'
      : 'Focus done — short break';
  }
  return state.status === 'running' ? 'Break done — focus started' : 'Break done';
}

/** Filled dots for the current cycle. A full count shows only during the break that closed it. */
export function filledSessionDots(
  completed: number,
  total: number,
  cycleType: 'work' | 'break',
): number {
  if (total <= 0 || completed <= 0) return 0;
  const mod = completed % total;
  if (mod === 0) return cycleType === 'break' ? total : 0;
  return mod;
}

export const formatSecondsToTime = (seconds: number) => {
  if (isNaN(seconds) || seconds < 0) {
    return '00:00';
  }

  if (seconds > MAX_DISPLAY_SECONDS) {
    return '99:59';
  }

  const minutes = Math.floor(seconds / 60);
  const s = seconds % 60;

  const formattedMinutes = String(minutes).padStart(2, '0');
  const formattedSeconds = String(s).padStart(2, '0');
  return `${formattedMinutes}:${formattedSeconds}`;
}