import { describe, it, expect } from 'vitest'
import {
  completionNotice,
  filledSessionDots,
  formatSecondsToTime,
  isLongBreakPhase,
  isSameCalendarDay,
  sessionsUntilLongBreak,
  todayWorkSessions,
} from '../src/core/utils/time.js'

describe('formatSecondsToTime', () => {
  it('formats zero', () => {
    expect(formatSecondsToTime(0)).toBe('00:00')
  })

  it('formats seconds only', () => {
    expect(formatSecondsToTime(45)).toBe('00:45')
  })

  it('formats minutes and seconds', () => {
    expect(formatSecondsToTime(150)).toBe('02:30')
  })

  it('formats one hour', () => {
    expect(formatSecondsToTime(3600)).toBe('60:00')
  })

  it('caps at 99 minutes 59 seconds', () => {
    expect(formatSecondsToTime(99 * 60 + 59)).toBe('99:59')
  })

  it('returns cap for values exceeding 99:59', () => {
    expect(formatSecondsToTime(100 * 60)).toBe('99:59')
    expect(formatSecondsToTime(9999)).toBe('99:59')
  })

  it('handles negative values', () => {
    expect(formatSecondsToTime(-1)).toBe('00:00')
  })

  it('handles NaN', () => {
    expect(formatSecondsToTime(NaN)).toBe('00:00')
  })

  it('pads single digit minutes', () => {
    expect(formatSecondsToTime(5 * 60 + 3)).toBe('05:03')
  })

  it('pads single digit seconds', () => {
    expect(formatSecondsToTime(7)).toBe('00:07')
  })
})

describe('cycle progress', () => {
  it('matches a calendar day only', () => {
    const morning = new Date(2026, 9, 6, 9, 0, 0).getTime()
    const evening = new Date(2026, 9, 6, 22, 0, 0).getTime()
    const nextDay = new Date(2026, 9, 7, 0, 1, 0).getTime()
    expect(isSameCalendarDay(morning, evening)).toBe(true)
    expect(isSameCalendarDay(morning, nextDay)).toBe(false)
  })

  it('treats a finished cycle as a new one during focus', () => {
    expect(filledSessionDots(4, 4, 'break')).toBe(4)
    expect(filledSessionDots(4, 4, 'work')).toBe(0)
    expect(filledSessionDots(1, 4, 'work')).toBe(1)
    expect(filledSessionDots(0, 4, 'work')).toBe(0)
  })

  it('marks a long break only while that break is running', () => {
    expect(isLongBreakPhase(4, 4, 'break')).toBe(true)
    expect(isLongBreakPhase(4, 4, 'work')).toBe(false)
    expect(isLongBreakPhase(2, 4, 'break')).toBe(false)
  })

  it('counts sessions left before the next long break', () => {
    expect(sessionsUntilLongBreak(0, 4)).toBe(4)
    expect(sessionsUntilLongBreak(1, 4)).toBe(3)
    expect(sessionsUntilLongBreak(3, 4)).toBe(1)
    expect(sessionsUntilLongBreak(4, 4)).toBe(4)
    expect(sessionsUntilLongBreak(8, 4)).toBe(4)
    expect(sessionsUntilLongBreak(5, 0)).toBe(0)
  })

  it.each([
    [0, 4, 'work', 0],
    [1, 4, 'work', 1],
    [3, 4, 'break', 3],
    [4, 4, 'break', 4],
    [4, 4, 'work', 0],
    [5, 4, 'work', 1],
    [8, 4, 'break', 4],
    [8, 4, 'work', 0],
    [1, 1, 'break', 1],
    [1, 1, 'work', 0],
    [2, 0, 'break', 0],
    [-1, 4, 'work', 0],
  ] as const)('fills %i of %i dots during %s as %i', (completed, total, cycle, filled) => {
    expect(filledSessionDots(completed, total, cycle)).toBe(filled)
  })

  it.each([
    [4, 4, 'break', true],
    [4, 4, 'work', false],
    [8, 4, 'break', true],
    [2, 4, 'break', false],
    [0, 4, 'break', false],
    [4, 0, 'break', false],
  ] as const)('long break %i/%i during %s is %s', (completed, interval, cycle, expected) => {
    expect(isLongBreakPhase(completed, interval, cycle)).toBe(expected)
  })

  it('counts only work sessions from the same calendar day', () => {
    const now = new Date(2026, 0, 1, 0, 30, 0).getTime()
    const sessions = [
      { type: 'work', timestamp: new Date(2025, 11, 31, 23, 0, 0).getTime(), task: 'last year' },
      { type: 'work', timestamp: new Date(2026, 0, 1, 0, 1, 0).getTime(), task: 'today' },
      { type: 'break', timestamp: new Date(2026, 0, 1, 0, 20, 0).getTime(), task: 'break' },
      { type: 'work', timestamp: new Date(2026, 1, 1, 0, 0, 0).getTime(), task: 'next month' },
    ]
    expect(todayWorkSessions(sessions, now).map((session) => session.task)).toEqual(['today'])
  })

  it.each([
    ['Focus done — short break', 'work', { status: 'break', completedSessions: 1, cycleType: 'break' as const }, 4],
    ['Focus done — long break', 'work', { status: 'break', completedSessions: 4, cycleType: 'break' as const }, 4],
    ['Focus done — short break', 'work', { status: 'break', completedSessions: 4, cycleType: 'work' as const }, 4],
    ['Break done — focus started', 'break', { status: 'running', completedSessions: 1, cycleType: 'work' as const }, 4],
    ['Break done', 'break', { status: 'idle', completedSessions: 1, cycleType: 'work' as const }, 4],
  ] as const)('completion notice is %s', (notice, finished, state, interval) => {
    expect(completionNotice(finished, state, interval)).toBe(notice)
  })
})
