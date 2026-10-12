import { describe, expect, it } from 'vitest'
import { atStake, listOf, localClock, reminderDue, type AtStake, type StreakSource } from './steward.js'

// Local noon on a day in September 2026, so the tests read the same in any zone the suite runs in.
const at = (d: number, h = 12) => new Date(2026, 8, d, h).toISOString()
const NOW = new Date(2026, 8, 27, 18) // 27 September, 6pm local

const each = (o: Partial<StreakSource> & { times: Record<string, string[]> }): StreakSource => ({
  id: 'snaps', label: 'Snaps', href: '/snaps', actionLabel: 'Share a snap', mode: 'each', members: ['ana', 'ben'], ...o,
})
const together = (o: Partial<StreakSource> & { times: Record<string, string[]> }): StreakSource => ({
  id: 'question', label: 'Daily question', href: '/question', actionLabel: "Answer today's question", mode: 'together', members: ['ana', 'ben'], ...o,
})

describe('atStake', () => {
  it('a streak with nothing to lose is not at stake, and is not counted at all', () => {
    const r = atStake([each({ times: { ana: [at(25), at(24)] } })], 'ana', NOW) // broken yesterday
    expect(r).toEqual({ rows: [], safe: 0, total: 0 })
    expect(atStake([each({ times: {} })], 'ana', NOW)).toEqual({ rows: [], safe: 0, total: 0 })
  })

  it('a streak done today is safe, not at stake', () => {
    expect(atStake([each({ times: { ana: [at(27), at(26)] } })], 'ana', NOW)).toEqual({ rows: [], safe: 1, total: 1 })
  })

  it('each: my own streak is at stake when I have not posted today, and the move is mine', () => {
    const r = atStake([each({ times: { ana: [at(26), at(25)], ben: [at(27)] } })], 'ana', NOW)
    expect(r.rows).toEqual([{ id: 'snaps', label: 'Snaps', href: '/snaps', actionLabel: 'Share a snap', count: 2, whoseMove: 'you', waitingOn: [] }])
    expect(r.total).toBe(1)
  })

  it("each: only my streak counts, never the other person's", () => {
    // Ben's streak is alive and owed today, Ana's is broken: nothing is at stake for Ana.
    expect(atStake([each({ times: { ben: [at(26), at(25)] } })], 'ana', NOW)).toEqual({ rows: [], safe: 0, total: 0 })
  })

  it('together: safe only when every member did it today', () => {
    const src = together({ times: { ana: [at(27), at(26)], ben: [at(27), at(26)] } })
    expect(atStake([src], 'ana', NOW)).toEqual({ rows: [], safe: 1, total: 1 })
  })

  it("together: waiting on the other person when I have done my part", () => {
    const r = atStake([together({ times: { ana: [at(27), at(26)], ben: [at(26)] } })], 'ana', NOW)
    expect(r.rows[0]).toMatchObject({ count: 1, whoseMove: 'them', waitingOn: ['ben'] })
  })

  it('together: my move when they have done theirs, both when neither has', () => {
    expect(atStake([together({ times: { ana: [at(26)], ben: [at(27), at(26)] } })], 'ana', NOW).rows[0])
      .toMatchObject({ whoseMove: 'you', waitingOn: [] })
    expect(atStake([together({ times: { ana: [at(26)], ben: [at(26)] } })], 'ana', NOW).rows[0])
      .toMatchObject({ whoseMove: 'both', waitingOn: ['ben'] })
  })

  it('together: lists everyone still to act, in member order', () => {
    const src = together({ members: ['ana', 'ben', 'cy'], times: { ana: [at(27), at(26)], ben: [at(26)], cy: [at(26)] } })
    expect(atStake([src], 'ana', NOW).rows[0]).toMatchObject({ whoseMove: 'them', waitingOn: ['ben', 'cy'] })
  })

  it('together: not at stake while it is not alive, even if I posted yesterday', () => {
    expect(atStake([together({ times: { ana: [at(26)], ben: [at(25)] } })], 'ana', NOW).total).toBe(0)
  })

  it('a source that does not list me is left out', () => {
    expect(atStake([each({ members: ['ben'], times: { ben: [at(26)] } })], 'ana', NOW)).toEqual({ rows: [], safe: 0, total: 0 })
  })

  it('orders rows longest first, then by label', () => {
    const r = atStake([
      each({ id: 'v', label: 'Verses', times: { ana: [at(26)] } }),
      each({ id: 's', label: 'Snaps', times: { ana: [at(26), at(25), at(24)] } }),
      each({ id: 'a', label: 'Art', times: { ana: [at(26)] } }),
    ], 'ana', NOW)
    expect(r.rows.map((x) => x.id)).toEqual(['s', 'a', 'v'])
  })

  it('counts safe and total across sources, and total is always rows plus safe', () => {
    const r = atStake([
      each({ id: '1', times: { ana: [at(27), at(26)] } }), // safe
      each({ id: '2', times: { ana: [at(26)] } }), // at stake
      together({ id: '3', times: { ana: [at(27)], ben: [at(27)] } }), // safe
      each({ id: '4', times: { ana: [at(20)] } }), // broken
    ], 'ana', NOW)
    expect(r).toMatchObject({ safe: 2, total: 3 })
    expect(r.rows.map((x) => x.id)).toEqual(['2'])
    expect(r.total).toBe(r.rows.length + r.safe)
  })

  it('passes a waiting label through to the row', () => {
    const waitingLabel = (n: string) => `${n} has not answered yet`
    const r = atStake([together({ waitingLabel, times: { ana: [at(27), at(26)], ben: [at(26)] } })], 'ana', NOW)
    expect(r.rows[0].waitingLabel?.('Ben')).toBe('Ben has not answered yet')
  })

  it('reads the day in a named zone when given one, for a server', () => {
    // 06:30 UTC on 1 October is still the evening of 30 September in Los Angeles.
    const now = new Date('2026-10-01T06:30:00Z')
    const src = each({ times: { ana: ['2026-09-30T20:00:00Z', '2026-09-29T20:00:00Z'] } })
    expect(atStake([src], 'ana', now, { timeZone: 'America/Los_Angeles' })).toEqual({ rows: [], safe: 1, total: 1 })
    expect(atStake([src], 'ana', now, { timeZone: 'UTC' }).rows[0]).toMatchObject({ count: 2, whoseMove: 'you' })
  })
})

const row = (o: Partial<AtStake>): AtStake => ({
  id: 'x', label: 'Snaps', href: '/s', actionLabel: 'Share a snap', count: 12, whoseMove: 'you', waitingOn: [], ...o,
})
const base = { localTime: '20:05', remindAt: '20:00', today: '2026-09-27' }

describe('reminderDue', () => {
  it('is due once the reminder time has come, with one sentence for one streak', () => {
    expect(reminderDue({ ...base, rows: [row({})] }))
      .toEqual({ due: true, text: 'Your 12 day Snaps streak ends at midnight. Share a snap.' })
  })

  it('is not due before the reminder time', () => {
    expect(reminderDue({ ...base, localTime: '19:59', rows: [row({})] })).toEqual({ due: false })
  })

  it('is due exactly at the reminder time', () => {
    expect(reminderDue({ ...base, localTime: '20:00', rows: [row({})] }).due).toBe(true)
  })

  it('is never sent twice on one day', () => {
    expect(reminderDue({ ...base, lastRemindedDay: '2026-09-27', rows: [row({})] })).toEqual({ due: false })
    expect(reminderDue({ ...base, lastRemindedDay: '2026-09-26', rows: [row({})] }).due).toBe(true)
  })

  it('is not due when nothing is at stake, or only streaks waiting on someone else', () => {
    expect(reminderDue({ ...base, rows: [] })).toEqual({ due: false })
    expect(reminderDue({ ...base, rows: [row({ whoseMove: 'them', waitingOn: ['ben'] })] })).toEqual({ due: false })
  })

  it('counts a streak where both of us still have to act as mine to save', () => {
    expect(reminderDue({ ...base, rows: [row({ whoseMove: 'both', waitingOn: ['ben'] })] }).due).toBe(true)
  })

  it('sends one message for several streaks, leaving out the ones waiting on someone else', () => {
    const rows = [
      row({ id: 'a', label: 'Snaps', count: 12 }),
      row({ id: 'b', label: 'Daily question', count: 5, whoseMove: 'both' }),
      row({ id: 'w', label: 'Walks', count: 4, whoseMove: 'them' }),
      row({ id: 'c', label: 'Verses', count: 1 }),
    ]
    expect(reminderDue({ ...base, rows }).text).toBe('3 streaks end at midnight: Snaps (12 days), Daily question (5 days) and Verses (1 day).')
    expect(reminderDue({ ...base, rows: rows.slice(0, 2) }).text).toBe('2 streaks end at midnight: Snaps (12 days) and Daily question (5 days).')
  })

  it('keeps an action that already ends a sentence as it is', () => {
    expect(reminderDue({ ...base, rows: [row({ actionLabel: 'Share one now!' })] }).text).toBe('Your 12 day Snaps streak ends at midnight. Share one now!')
  })

  it('a malformed time is never due, rather than throwing', () => {
    expect(reminderDue({ ...base, remindAt: '8pm', rows: [row({})] })).toEqual({ due: false })
    expect(reminderDue({ ...base, localTime: '25:00', rows: [row({})] })).toEqual({ due: false })
  })

  it('never writes an em dash', () => {
    const rows = [row({ id: 'a' }), row({ id: 'b', label: 'Verses', count: 2 })]
    expect(reminderDue({ ...base, rows }).text).not.toMatch(/\u2014/)
    expect(reminderDue({ ...base, rows: rows.slice(0, 1) }).text).not.toMatch(/\u2014/)
  })
})

describe('localClock', () => {
  it('gives the day and the 24-hour time in the zone', () => {
    expect(localClock(new Date('2026-10-01T06:00:00Z'), 'America/Los_Angeles')).toEqual({ day: '2026-09-30', time: '23:00' })
    expect(localClock(new Date('2026-10-01T06:00:00Z'), 'Asia/Tokyo')).toEqual({ day: '2026-10-01', time: '15:00' })
    expect(localClock(new Date('2026-10-01T07:05:00Z'), 'America/Los_Angeles')).toEqual({ day: '2026-10-01', time: '00:05' })
  })
})

describe('listOf', () => {
  it('joins with commas and a final and', () => {
    expect(listOf([])).toBe('')
    expect(listOf(['a'])).toBe('a')
    expect(listOf(['a', 'b'])).toBe('a and b')
    expect(listOf(['a', 'b', 'c'])).toBe('a, b and c')
  })
})

// Two zones an hour apart, read on the Tuesday morning after a late Monday night. Every instant is
// written in UTC and every zone is named, so these read the same wherever the suite runs.
describe('atStake across zones', () => {
  const CENTRAL = 'America/Chicago'
  const EASTERN = 'America/New_York'
  const NOW_Z = new Date('2026-10-13T14:00:00Z') // Tuesday morning in both
  // Ana shares at 23:30 Central on the Monday and the Saturday; Ben at 22:00 Central on the Monday
  // and the Sunday. Read in both zones, the days they both kept are the Sunday and the Monday.
  const src = together({
    times: {
      ana: ['2026-10-13T04:30:00Z', '2026-10-11T04:30:00Z'],
      ben: ['2026-10-13T03:00:00Z', '2026-10-12T03:00:00Z'],
    },
  })

  it('counts a day in every zone the members keep, so a late night is not a lost day', () => {
    const r = atStake([src], 'ana', NOW_Z, { timeZone: { ana: EASTERN, ben: CENTRAL } })
    expect(r.rows[0]).toMatchObject({ count: 2, whoseMove: 'them', waitingOn: ['ben'] })
  })

  it('is longer than the same streak read in either zone on its own', () => {
    // Central alone loses the Sunday (Ana's Saturday night is a Saturday there).
    expect(atStake([src], 'ana', NOW_Z, { timeZone: CENTRAL }).rows[0]).toMatchObject({ count: 1 })
    // Eastern alone loses the Monday as well, and with it the whole streak.
    expect(atStake([src], 'ana', NOW_Z, { timeZone: EASTERN })).toEqual({ rows: [], safe: 0, total: 0 })
  })
})

describe('a streak that declares a free skip a week', () => {
  // NOW is a Sunday, so the days below are one Monday-to-Sunday week.
  const times = { ana: [at(26), at(24)] }
  it('keeps the streak the band would otherwise have dropped a day of', () => {
    expect(atStake([each({ times, freeSkipsPerWeek: 1 })], 'ana', NOW).rows[0]).toMatchObject({ count: 2 })
    expect(atStake([each({ times })], 'ana', NOW).rows[0]).toMatchObject({ count: 1 })
  })
  it('is the tile\'s own declaration, so a zone changes nothing about it', () => {
    const src = each({ times: { ana: ['2026-10-13T03:00:00Z', '2026-10-11T03:00:00Z'] }, freeSkipsPerWeek: 1 })
    const r = atStake([src], 'ana', new Date('2026-10-13T14:00:00Z'), { timeZone: 'America/Chicago' })
    expect(r.rows[0]).toMatchObject({ count: 2 })
  })
})
