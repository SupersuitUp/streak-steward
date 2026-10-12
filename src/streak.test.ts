import { describe, expect, it } from 'vitest'
import { captureStreak, householdStreakOf, streakOf, streaksOf, zonedStreakOf, zonedStreaksOf, zonesOf } from './streak.js'
import { zoned } from './zoned.js'
import type { StreakRow } from './streak.js'

// Ported verbatim from the app these streaks came from, whose rows carried more than a streak reads.
type SnapRow = StreakRow & Record<string, unknown>

// Local noon on a given day, so the tests read the same in any time zone the suite runs in.
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString()
const NOW = new Date(2026, 8, 27, 18) // Sunday 27 September 2026, 6pm local

const row = (by: 'ana' | 'ben', createdAt: string, hidden = false): SnapRow => ({
  id: createdAt + by, by, caption: '', kind: 'photo', thumbUrl: null, durationSec: null,
  createdAt, witnessedAt: null, hidden,
})

describe('streakOf', () => {
  it('is nothing with no snaps', () => {
    expect(streakOf([], NOW)).toEqual({ count: 0, postedToday: false })
  })
  it('counts consecutive days ending today', () => {
    expect(streakOf([at(2026, 9, 27), at(2026, 9, 26), at(2026, 9, 25)], NOW)).toEqual({ count: 3, postedToday: true })
  })
  it('counts several snaps on one day once', () => {
    expect(streakOf([at(2026, 9, 27, 9), at(2026, 9, 27, 17), at(2026, 9, 26)], NOW)).toEqual({ count: 2, postedToday: true })
  })
  it('stays alive through today when the last snap was yesterday, and says today is still owed', () => {
    expect(streakOf([at(2026, 9, 26), at(2026, 9, 25)], NOW)).toEqual({ count: 2, postedToday: false })
  })
  it('is broken by a missed day', () => {
    expect(streakOf([at(2026, 9, 25), at(2026, 9, 24)], NOW)).toEqual({ count: 0, postedToday: false })
  })
  it('stops counting at the first gap', () => {
    expect(streakOf([at(2026, 9, 27), at(2026, 9, 26), at(2026, 9, 24), at(2026, 9, 23)], NOW)).toEqual({ count: 2, postedToday: true })
  })
  it('uses the local calendar day, so a snap just after midnight is today', () => {
    expect(streakOf([at(2026, 9, 27, 0), at(2026, 9, 26, 23)], NOW)).toEqual({ count: 2, postedToday: true })
  })
})

describe('streaksOf', () => {
  it('gives each member their own streak and a together streak for days you both shared', () => {
    const rows = [
      row('ana', at(2026, 9, 27)), row('ana', at(2026, 9, 26)), row('ana', at(2026, 9, 25)),
      row('ben', at(2026, 9, 26)), row('ben', at(2026, 9, 25)), row('ben', at(2026, 9, 24)),
    ]
    expect(streaksOf(rows, NOW, ['ana', 'ben'])).toEqual({
      ana: { count: 3, postedToday: true },
      ben: { count: 3, postedToday: false },
      together: { count: 2, postedToday: false },
    })
  })
  it('does not count a hidden snap, so both of you see the same number', () => {
    const rows = [row('ana', at(2026, 9, 27), true), row('ana', at(2026, 9, 26))]
    expect(streaksOf(rows, NOW, ['ana', 'ben']).ana).toEqual({ count: 1, postedToday: false })
  })
})

describe('the household streak', () => {
  const days = (...ks: string[]) => new Set(ks)
  const SINCE = '2026-09-01'
  it('counts consecutive days ending today, and owes today rather than breaking on it', () => {
    expect(captureStreak(days('2026-09-29', '2026-09-30', '2026-10-01'), '2026-10-01', SINCE, 1)).toMatchObject({ count: 3, capturedToday: true })
    expect(captureStreak(days('2026-09-29', '2026-09-30'), '2026-10-01', SINCE, 1)).toMatchObject({ count: 2, capturedToday: false, skipUsedThisWeek: false })
  })
  it('forgives one missed day a week', () => {
    expect(captureStreak(days('2026-10-01', '2026-09-29', '2026-09-28', '2026-09-27'), '2026-10-01', SINCE, 1))
      .toEqual({ count: 4, capturedToday: true, skipUsedThisWeek: true })
  })
  it('breaks on a second missed day in one week, and on any missed day with no free skip', () => {
    expect(captureStreak(days('2026-10-01', '2026-09-28'), '2026-10-01', SINCE, 1).count).toBe(1)
    expect(captureStreak(days('2026-10-01', '2026-09-29'), '2026-10-01', SINCE, 0).count).toBe(1)
  })
  it('never counts before the start date, and is zero with nothing shared', () => {
    expect(captureStreak(days('2026-09-29', '2026-09-30', '2026-10-01'), '2026-10-01', '2026-09-29', 1).count).toBe(3)
    expect(captureStreak(days(), '2026-10-01', SINCE, 1).count).toBe(0)
  })
  it('reads each snap\'s day in the rule\'s zone and leaves out what is hidden', () => {
    const r = (createdAt: string, hidden = false) => ({ id: createdAt, by: 'ana', caption: '', kind: 'photo' as const, thumbUrl: null, durationSec: null, createdAt, witnessedAt: null, hidden })
    const rule = { kind: 'household' as const, timeZone: 'America/Los_Angeles', since: SINCE, freeSkipsPerWeek: 1 as const }
    // Early morning in UTC is still the evening before in that zone, so today is owed, not missed.
    const now = new Date('2026-10-01T06:30:00Z')
    expect(householdStreakOf([r('2026-09-30T20:00:00Z'), r('2026-09-29T20:00:00Z')], now, rule)).toMatchObject({ count: 2, capturedToday: true })
    expect(householdStreakOf([r('2026-09-30T20:00:00Z', true)], now, rule).count).toBe(0)
  })
  it('counts a snap shared just after local midnight on the clock-change day in that day', () => {
    const r = (createdAt: string) => ({ id: createdAt, by: 'ana', caption: '', kind: 'photo' as const, thumbUrl: null, durationSec: null, createdAt, witnessedAt: null, hidden: false })
    const rule = { kind: 'household' as const, timeZone: 'America/Los_Angeles', since: SINCE, freeSkipsPerWeek: 0 as const }
    // The zone falls back this weekend: three snaps on three local days, 07:30 UTC being 00:30 local before and 23:30 local after.
    const rows = [r('2026-10-31T07:30:00Z'), r('2026-11-01T08:30:00Z'), r('2026-11-02T08:30:00Z')]
    expect(householdStreakOf(rows, new Date('2026-11-02T20:00:00Z'), rule)).toMatchObject({ count: 3, capturedToday: true })
  })
})

// NOW is a Sunday, so a week (Monday to Sunday) holds every day these cases name.
describe('a free skip a week on the device\'s own day', () => {
  it('forgives one missed day a week, and counts nothing differently without the skip', () => {
    expect(streakOf([at(2026, 9, 27), at(2026, 9, 25)], NOW, 1)).toEqual({ count: 2, postedToday: true })
    expect(streakOf([at(2026, 9, 27), at(2026, 9, 25)], NOW)).toEqual({ count: 1, postedToday: true })
  })
  it('breaks on a second missed day in the same week', () => {
    expect(streakOf([at(2026, 9, 27), at(2026, 9, 24)], NOW, 1)).toEqual({ count: 1, postedToday: true })
  })
  it('ends rather than walking back forever: nothing shared, and nothing shared for weeks', () => {
    expect(streakOf([], NOW, 1)).toEqual({ count: 0, postedToday: false })
    expect(streakOf([at(2026, 9, 1)], NOW, 1)).toEqual({ count: 0, postedToday: false })
  })
  it('gives each member and the together count the same forgiveness', () => {
    const rows = [
      row('ana', at(2026, 9, 27)), row('ana', at(2026, 9, 25)),
      row('ben', at(2026, 9, 27)), row('ben', at(2026, 9, 25)),
    ]
    expect(streaksOf(rows, NOW, ['ana', 'ben'], 1)).toEqual({
      ana: { count: 2, postedToday: true },
      ben: { count: 2, postedToday: true },
      together: { count: 2, postedToday: true },
    })
    expect(streaksOf(rows, NOW, ['ana', 'ben']).together).toEqual({ count: 1, postedToday: true })
  })
})

// Two zones an hour apart, with the clock near midnight in the earlier one. Every instant here is
// written in UTC and every zone is named, so these read the same wherever the suite runs.
describe('a group day in several zones', () => {
  const CENTRAL = 'America/Chicago'
  const EASTERN = 'America/New_York'
  const ZONES = { ana: EASTERN, ben: CENTRAL }
  // 23:50 Monday in Central, which is already 00:50 Tuesday in Eastern.
  const NOW_Z = new Date('2026-10-13T04:50:00Z')
  // Ana shares late on Monday and late on Saturday: 23:30 Central both times, so Eastern reads
  // each of them as the small hours of the next day.
  const ANA = ['2026-10-13T04:30:00Z', '2026-10-11T04:30:00Z']
  // Ben shares at 22:00 Central on Monday and on Sunday, which is the same day in both zones.
  const BEN = ['2026-10-13T03:00:00Z', '2026-10-12T03:00:00Z']
  const rows = [...ANA.map((createdAt) => ({ by: 'ana', createdAt })), ...BEN.map((createdAt) => ({ by: 'ben', createdAt }))]
  const keys = ['ana', 'ben']

  it('counts a time toward its day in every zone in play, so the shared evening holds', () => {
    // Monday is Ana's in Central and Sunday is hers in Eastern; both are Ben's, so both are theirs.
    expect(zonedStreaksOf(rows, NOW_Z, keys, ZONES)).toEqual({
      ana: { count: 3, postedToday: true },
      ben: { count: 2, postedToday: true },
      together: { count: 2, postedToday: true },
    })
  })

  it('is more generous than any one zone, and than each member in their own zone alone', () => {
    // Central only: Ana's Saturday night is Saturday, so Sunday is not a day they shared.
    expect(zonedStreaksOf(rows, NOW_Z, keys, CENTRAL).together).toEqual({ count: 1, postedToday: true })
    // Eastern only: Ana's Monday night is Tuesday, so Monday is not one either and nothing is left.
    expect(zonedStreaksOf(rows, NOW_Z, keys, EASTERN).together).toEqual({ count: 0, postedToday: false })
    // Each in their own zone, which is the answer that looks right: Ana's days read in Eastern and
    // Ben's in Central share only the Sunday, so Monday is lost and the pair is told tonight is
    // the night it ends, with one day to its name instead of two that are safe.
    const own = (times: string[], z: string) => times.map((t) => zoned(new Date(t), z).dayKey)
    const anaOwn = own(ANA, EASTERN)
    const benOwn = own(BEN, CENTRAL)
    const bothKept = anaOwn.filter((d) => benOwn.includes(d))
    expect({ anaOwn, benOwn, bothKept }).toEqual({
      anaOwn: ['2026-10-13', '2026-10-11'], benOwn: ['2026-10-12', '2026-10-11'], bothKept: ['2026-10-11'],
    })
    expect(captureStreak(new Set(bothKept), '2026-10-12', '', 0)).toMatchObject({ count: 1, capturedToday: false })
  })

  it('never lets the together count pass a member\'s own', () => {
    const s = zonedStreaksOf(rows, NOW_Z, keys, ZONES)
    for (const m of keys) expect(s.together.count).toBeLessThanOrEqual(s[m].count)
  })

  it('reads one zone named for everyone exactly as a plain zone', () => {
    const same = { ana: CENTRAL, ben: CENTRAL }
    expect(zonedStreaksOf(rows, NOW_Z, keys, same)).toEqual(zonedStreaksOf(rows, NOW_Z, keys, CENTRAL))
  })

  it('counts today as done when it is done in any zone in play', () => {
    // Zones a day and an hour apart: an hour ago is still yesterday in the later one.
    const far = { ana: 'Pacific/Pago_Pago', ben: 'Pacific/Kiritimati' }
    const now = new Date('2026-10-12T12:00:00Z')
    const shared = [{ by: 'ana', createdAt: '2026-10-12T10:30:00Z' }]
    expect(zonedStreaksOf(shared, now, ['ana'], far).ana.postedToday).toBe(true)
    expect(zonedStreaksOf(shared, now, ['ana'], 'Pacific/Pago_Pago').ana.postedToday).toBe(false)
  })

  it('forgives one missed day a week here too, and counts one person on their own', () => {
    const times = ['2026-10-13T03:00:00Z', '2026-10-11T03:00:00Z']
    expect(zonedStreakOf(times, NOW_Z, CENTRAL, 1)).toEqual({ count: 2, postedToday: true })
    expect(zonedStreakOf(times, NOW_Z, CENTRAL)).toEqual({ count: 1, postedToday: true })
  })

  it('refuses a record that names no zone, rather than counting nothing', () => {
    expect(() => zonesOf({})).toThrow(/no zone/)
    expect(zonesOf(CENTRAL)).toEqual([CENTRAL])
    expect(zonesOf(ZONES)).toEqual([EASTERN, CENTRAL])
  })
})
