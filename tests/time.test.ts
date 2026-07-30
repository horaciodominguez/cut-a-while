import { describe, it, expect } from 'vitest'
import { formatSecondsToTime } from '../src/core/utils/time.js'

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
