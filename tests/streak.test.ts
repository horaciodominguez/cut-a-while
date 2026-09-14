import { describe, it, expect } from 'vitest'
import {
  calcStreak,
  previousLocalDayKey,
  toLocalDayKey,
} from '../src/core/utils/streak.js'

/** Noon local time — avoids DST edge cases at midnight. */
function localNoon(year: number, monthIndex: number, day: number): number {
  return new Date(year, monthIndex, day, 12, 0, 0).getTime()
}

function work(timestamp: number) {
  return { timestamp, type: 'work' as const }
}

function brk(timestamp: number) {
  return { timestamp, type: 'break' as const }
}

describe('toLocalDayKey / previousLocalDayKey', () => {
  it('formats local calendar day', () => {
    expect(toLocalDayKey(localNoon(2026, 2, 1))).toBe('2026-03-01')
  })

  it('previous day crosses February → March', () => {
    expect(previousLocalDayKey('2026-03-01')).toBe('2026-02-28')
  })

  it('previous day crosses year boundary', () => {
    expect(previousLocalDayKey('2026-01-01')).toBe('2025-12-31')
  })
})

describe('calcStreak', () => {
  it('returns 0 with no sessions', () => {
    expect(calcStreak([])).toBe(0)
  })

  it('returns 0 when only break sessions exist', () => {
    expect(calcStreak([brk(localNoon(2026, 2, 1))])).toBe(0)
  })

  it('returns 1 for a single work day', () => {
    expect(calcStreak([work(localNoon(2026, 2, 10))])).toBe(1)
  })

  it('counts consecutive days in the same month', () => {
    expect(
      calcStreak([
        work(localNoon(2026, 2, 10)),
        work(localNoon(2026, 2, 11)),
        work(localNoon(2026, 2, 12)),
      ]),
    ).toBe(3)
  })

  it('counts consecutive days across February → March (old bug)', () => {
    // Old YYYYMMDD diff: 20260301 - 20260228 = 73, not 1 → streak stopped at 1
    expect(
      calcStreak([
        work(localNoon(2026, 1, 28)),
        work(localNoon(2026, 2, 1)),
      ]),
    ).toBe(2)
  })

  it('counts consecutive days across year boundary (old bug)', () => {
    // Old YYYYMMDD diff: 20260101 - 20251231 = 8870, not 1
    expect(
      calcStreak([
        work(localNoon(2025, 11, 31)),
        work(localNoon(2026, 0, 1)),
      ]),
    ).toBe(2)
  })

  it('stops at a gap', () => {
    expect(
      calcStreak([
        work(localNoon(2026, 2, 1)),
        work(localNoon(2026, 2, 2)),
        // gap on the 3rd
        work(localNoon(2026, 2, 4)),
        work(localNoon(2026, 2, 5)),
      ]),
    ).toBe(2) // only Mar 5 and Mar 4
  })

  it('dedupes multiple work sessions on the same day', () => {
    expect(
      calcStreak([
        work(localNoon(2026, 2, 1)),
        work(new Date(2026, 2, 1, 18, 0, 0).getTime()),
        work(localNoon(2026, 2, 2)),
      ]),
    ).toBe(2)
  })

  it('ignores break sessions when computing streak', () => {
    expect(
      calcStreak([
        work(localNoon(2026, 2, 1)),
        brk(localNoon(2026, 2, 2)),
        work(localNoon(2026, 2, 3)),
      ]),
    ).toBe(1) // Mar 3 alone; Mar 1 is not consecutive via work days
  })
})
