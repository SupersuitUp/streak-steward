// Streaks: how many days in a row someone did the thing. Pure, and computed wherever the day is
// known: on the phone, where a "day" is the viewer's local calendar day, or in named time zones,
// which a server can be told. The member keys are passed in rather than read from any app's list of
// people, and "together" is the days every one of them did it.
import type { HouseholdStreakRule } from './rule.js'
import { addDays, localDayKey, weekStart, zoned } from './zoned.js'

export interface Streak { count: number; postedToday: boolean }
export type Streaks = Record<string, Streak> & { together: Streak }

/** One thing that counts toward a streak: who did it, when (ISO), and whether it is hidden. */
export interface StreakRow { by: string; createdAt: string; hidden?: boolean }

/** One zone for everyone, or the zone each member keeps: `{ ana: 'America/Chicago', ben: 'America/New_York' }`. */
export type StreakZones = string | Record<string, string>

// Every zone in play, in the order a record names them, each named once.
export function zonesOf(zones: StreakZones): string[] {
  if (typeof zones === 'string') return [zones]
  const named = [...new Set(Object.values(zones))]
  if (!named.length) throw new Error('streak zones: the record names no zone')
  return named
}

// A group day is read as generously as the zones in play allow: a time counts toward its day in
// EVERY one of them, never only one, so a member's days are the union of those keys and a together
// day is the intersection of the members' unions. Two people an hour apart then keep the evening
// they shared, which neither one fixed zone nor each-member-in-their-own-zone would give them.
function daysInZones(isoTimes: string[], zones: string[]): Set<string> {
  const out = new Set<string>()
  for (const t of isoTimes) {
    const d = new Date(t)
    for (const z of zones) out.add(zoned(d, z).dayKey)
  }
  return out
}

// The count anchors on the earliest day the zones are still in, because a day is missed only once
// it is over in every one of them. Today is generous the same way: done today in any zone is done
// today, which is what carrying the latest key back onto the anchor day says.
function countInZones(days: Set<string>, todayKeys: string[], freeSkipsPerWeek: 0 | 1): Streak {
  const today = [...todayKeys].sort()[0]
  const generous = todayKeys.some((k) => days.has(k)) ? new Set(days).add(today) : days
  const { count, capturedToday } = captureStreak(generous, today, '', freeSkipsPerWeek)
  return { count, postedToday: capturedToday }
}

// The device's own day, counted by the same rule, so the phone and the server can only disagree
// about which day it is, never about what a streak is.
function countFrom(days: Set<string>, now: Date, freeSkipsPerWeek: 0 | 1 = 0): Streak {
  const { count, capturedToday } = captureStreak(days, localDayKey(now), '', freeSkipsPerWeek)
  return { count, postedToday: capturedToday }
}

const daysOf = (isoTimes: string[]) => new Set(isoTimes.map((t) => localDayKey(new Date(t))))

export function streakOf(isoTimes: string[], now = new Date(), freeSkipsPerWeek: 0 | 1 = 0): Streak {
  return countFrom(daysOf(isoTimes), now, freeSkipsPerWeek)
}

// A hidden row is left out, so the number is the same on every phone: the others cannot see it.
export function streaksOf(rows: StreakRow[], now: Date, keys: readonly string[], freeSkipsPerWeek: 0 | 1 = 0): Streaks {
  const shared = rows.filter((r) => !r.hidden)
  const sets = keys.map((m) => daysOf(shared.filter((r) => r.by === m).map((r) => r.createdAt)))
  const together = new Set([...(sets[0] ?? [])].filter((d) => sets.every((s) => s.has(d))))
  const out = { together: countFrom(together, now, freeSkipsPerWeek) } as Streaks
  keys.forEach((m, i) => { out[m] = countFrom(sets[i], now, freeSkipsPerWeek) })
  return out
}

// One count for everyone who shares. A day counts when anything was shared that day, in the rule's
// time zone. A missed day breaks it, except one free skip per Monday-to-Sunday week when the rule
// allows it. Today is owed, not missed, until it is over, and nothing before `since` counts.
export interface HouseholdStreak { count: number; capturedToday: boolean; skipUsedThisWeek: boolean }

// The one walk backwards every streak in this package is counted by: the household rule, the
// each-and-together counts in named zones, and the device's own day, which hands it local day keys
// in this same padded form so there is never a second idea of what a day or a week is.
export function captureStreak(days: Set<string>, today: string, since: string, freeSkipsPerWeek: 0 | 1): HouseholdStreak {
  const capturedToday = days.has(today)
  // A missed day spends its week's skip only once a shared day lies beyond it; misses before the
  // streak began are where it began, not skips.
  const used = new Set<string>()
  let pending: string[] = []
  let d = capturedToday ? today : addDays(today, -1)
  let count = 0
  while (d >= since) {
    if (days.has(d)) {
      count++
      pending.forEach((w) => used.add(w))
      pending = []
    } else {
      const w = weekStart(d)
      if (freeSkipsPerWeek === 0 || used.has(w) || pending.includes(w)) break
      pending.push(w)
    }
    d = addDays(d, -1)
  }
  return { count, capturedToday, skipUsedThisWeek: used.has(weekStart(today)) }
}

export function householdStreakOf(rows: StreakRow[], now: Date, rule: HouseholdStreakRule): HouseholdStreak {
  const days = new Set(rows.filter((r) => !r.hidden).map((r) => zoned(new Date(r.createdAt), rule.timeZone).dayKey))
  return captureStreak(days, zoned(now, rule.timeZone).dayKey, rule.since, rule.freeSkipsPerWeek)
}

// The same each-and-together count as streaksOf, with the day read in named time zones instead of
// the device's. For a server, which has no phone to ask, and for a phone whose own zone is not the
// one the streak is kept in. Given several zones the days are the generous union above.
export function zonedStreaksOf(rows: StreakRow[], now: Date, keys: readonly string[], timeZone: StreakZones, freeSkipsPerWeek: 0 | 1 = 0): Streaks {
  const zones = zonesOf(timeZone)
  const todayKeys = zones.map((z) => zoned(now, z).dayKey)
  const shared = rows.filter((r) => !r.hidden)
  const sets = keys.map((m) => daysInZones(shared.filter((r) => r.by === m).map((r) => r.createdAt), zones))
  const together = new Set([...(sets[0] ?? [])].filter((d) => sets.every((s) => s.has(d))))
  const out = { together: countInZones(together, todayKeys, freeSkipsPerWeek) } as Streaks
  keys.forEach((m, i) => { out[m] = countInZones(sets[i], todayKeys, freeSkipsPerWeek) })
  return out
}

/** One person's streak, read in named time zones: streakOf for an app whose day is not the device's. */
export function zonedStreakOf(isoTimes: string[], now: Date, timeZone: StreakZones, freeSkipsPerWeek: 0 | 1 = 0): Streak {
  const zones = zonesOf(timeZone)
  return countInZones(daysInZones(isoTimes, zones), zones.map((z) => zoned(now, z).dayKey), freeSkipsPerWeek)
}
