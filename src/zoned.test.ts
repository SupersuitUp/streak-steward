import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, inWindow, localDayKey, minutesOf, msUntilMidnight, weekStart, zoned } from './zoned.js'

describe('zoned', () => {
  it('reads the day and the time in the zone, not the server\'s', () => {
    expect(zoned(new Date('2026-10-01T06:00:00Z'), 'America/Los_Angeles')).toEqual({ dayKey: '2026-09-30', hhmm: '23:00' })
    expect(zoned(new Date('2026-10-01T06:00:00Z'), 'UTC')).toEqual({ dayKey: '2026-10-01', hhmm: '06:00' })
  })
  it('reads midnight as 00 and follows the zone across a clock change', () => {
    expect(zoned(new Date('2026-10-01T07:05:00Z'), 'America/Los_Angeles').hhmm).toBe('00:05')
    expect(zoned(new Date('2026-11-01T07:30:00Z'), 'America/Los_Angeles')).toEqual({ dayKey: '2026-11-01', hhmm: '00:30' })
    expect(zoned(new Date('2026-11-01T09:30:00Z'), 'America/Los_Angeles')).toEqual({ dayKey: '2026-11-01', hhmm: '01:30' })
    expect(zoned(new Date('2026-11-01T12:00:00Z'), 'America/Los_Angeles')).toEqual({ dayKey: '2026-11-01', hhmm: '04:00' })
  })
  it('counts days across a clock change without gaining or losing one', () => {
    expect(addDays('2026-10-31', 2)).toBe('2026-11-02')
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2)
    expect(addDays('2026-03-07', 2)).toBe('2026-03-09')
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2)
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
  it('starts a week on Monday', () => {
    expect(weekStart('2026-10-01')).toBe('2026-09-28')
    expect(weekStart('2026-09-28')).toBe('2026-09-28')
    expect(weekStart('2026-09-27')).toBe('2026-09-21')
  })
  it('keeps a slot due for the hour after it', () => {
    expect(inWindow('08:30', '08:30')).toBe(true)
    expect(inWindow('08:30', '09:29')).toBe(true)
    expect(inWindow('08:30', '09:30')).toBe(false)
    expect(inWindow('08:30', '08:29')).toBe(false)
    expect(minutesOf('01:05')).toBe(65)
  })
})

describe('localDayKey', () => {
  it('pads the device\'s own day, so it reads in the same key the week and day helpers take', () => {
    expect(localDayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(localDayKey(new Date(2026, 10, 12, 0, 0))).toBe('2026-11-12')
    expect(weekStart(localDayKey(new Date(2026, 9, 1, 12)))).toBe('2026-09-28')
  })
})

describe('msUntilMidnight', () => {
  // The same instant, read in two zones a day apart: 00:40 on one calendar day, 23:40 the evening
  // before on the other. A screen counting in one of them must not wait for the other's midnight.
  const now = new Date('2026-10-12T10:40:30.000Z')
  it('is the time left in the named zone\'s day, one second past its midnight', () => {
    expect(msUntilMidnight(now, 'Pacific/Kiritimati')).toBe(83_971_000)
    expect(msUntilMidnight(now, 'Pacific/Pago_Pago')).toBe(1_171_000)
  })
  it('is the device\'s own midnight when no zone is named', () => {
    expect(msUntilMidnight(new Date(2026, 9, 12, 23, 59, 0))).toBe(61_000)
  })
})
