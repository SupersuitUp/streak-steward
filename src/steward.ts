// The steward: given every streak an app tracks, which ones end at midnight if nobody acts today,
// whose move it is, and whether a reminder is due. Pure. The band on the phone calls atStake with
// no time zone, so a day is the phone's own day, exactly as streakOf counts it. A server job passes
// the person's time zone, because a server has no phone to ask.
import { streaksOf, zonedStreaksOf, type StreakRow, type Streaks } from './streak.js'
import { minutesOf, zoned } from './zoned.js'

/** One streak an app tracks, declared by the tile that owns it. */
export interface StreakSource {
  id: string
  /** The name of the thing, as a person reads it: "Snaps", "Daily question". */
  label: string
  /** Where the action that saves the streak lives. */
  href: string
  /** What saves it, as a short imperative: "Share a snap". */
  actionLabel: string
  /** The words for a together streak waiting on someone else. Default: "Waiting on <name>". */
  waitingLabel?: (otherName: string) => string
  /** each: every member has their own streak, and you are shown yours. together: one streak, kept by days every member did it. */
  mode: 'each' | 'together'
  members: readonly string[]
  /** ISO times per member that count toward the streak. */
  times: Record<string, string[]>
}

export type WhoseMove = 'you' | 'them' | 'both'

/** A streak that ends at midnight unless someone acts today. */
export interface AtStake {
  id: string; label: string; href: string; actionLabel: string
  count: number
  whoseMove: WhoseMove
  /** The other members who have not done it today, in the source's member order. */
  waitingOn: string[]
  waitingLabel?: (otherName: string) => string
}

export interface AtStakeResult {
  /** Longest first, then by label. */
  rows: AtStake[]
  /** Alive and already done today. */
  safe: number
  /** Alive: a count above zero. Always rows.length + safe. */
  total: number
}

export interface AtStakeOptions {
  /** Read the day in this IANA zone instead of the device's own. For a server. */
  timeZone?: string
}

function streaksFor(src: StreakSource, now: Date, timeZone?: string): Streaks {
  const rows: StreakRow[] = src.members.flatMap((m) => (src.times[m] ?? []).map((createdAt) => ({ by: m, createdAt })))
  return timeZone ? zonedStreaksOf(rows, now, src.members, timeZone) : streaksOf(rows, now, src.members)
}

export function atStake(sources: StreakSource[], me: string, now: Date = new Date(), options: AtStakeOptions = {}): AtStakeResult {
  const rows: AtStake[] = []
  let safe = 0
  let total = 0
  for (const src of sources) {
    // A streak that is not yours to keep is not shown to you.
    if (!src.members.includes(me)) continue
    const s = streaksFor(src, now, options.timeZone)
    const streak = src.mode === 'each' ? s[me] : s.together
    // Nothing to lose: a broken or never-started streak is not at stake.
    if (streak.count === 0) continue
    total++
    if (streak.postedToday) { safe++; continue }
    let whoseMove: WhoseMove = 'you'
    let waitingOn: string[] = []
    if (src.mode === 'together') {
      waitingOn = src.members.filter((m) => m !== me && !s[m].postedToday)
      const mine = s[me].postedToday
      whoseMove = mine ? 'them' : waitingOn.length ? 'both' : 'you'
    }
    rows.push({
      id: src.id, label: src.label, href: src.href, actionLabel: src.actionLabel,
      count: streak.count, whoseMove, waitingOn,
      ...(src.waitingLabel ? { waitingLabel: src.waitingLabel } : {}),
    })
  }
  rows.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  return { rows, safe, total }
}

/** The day (YYYY-MM-DD) and the time (HH:MM, 24-hour) in a named time zone. */
export function localClock(now: Date, timeZone: string): { day: string; time: string } {
  const z = zoned(now, timeZone)
  return { day: z.dayKey, time: z.hhmm }
}

export interface ReminderInput {
  rows: AtStake[]
  /** The person's own time now, HH:MM. */
  localTime: string
  /** When they asked to be reminded, HH:MM. */
  remindAt: string
  /** The day a reminder was last sent to them, YYYY-MM-DD. */
  lastRemindedDay?: string
  /** Their own day now, YYYY-MM-DD. */
  today: string
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`
const sentence = (s: string) => (/[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`)

/** "a", "a and b", "a, b and c". */
export function listOf(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

// One reminder a day at most, however many streaks are at risk, and only for streaks the person
// can save themselves: a together streak waiting only on someone else is not theirs to act on. A
// malformed time is never due, so one bad stored setting cannot stop a job that loops over people.
export function reminderDue(input: ReminderInput): { due: boolean; text?: string } {
  const { rows, localTime, remindAt, lastRemindedDay, today } = input
  const mine = rows.filter((r) => r.whoseMove !== 'them')
  if (!mine.length) return { due: false }
  if (!HHMM.test(localTime) || !HHMM.test(remindAt)) return { due: false }
  if (minutesOf(localTime) < minutesOf(remindAt)) return { due: false }
  if (lastRemindedDay === today) return { due: false }
  if (mine.length === 1) {
    const r = mine[0]
    return { due: true, text: `Your ${r.count} day ${r.label} streak ends at midnight. ${sentence(r.actionLabel)}` }
  }
  const list = listOf(mine.map((r) => `${r.label} (${days(r.count)})`))
  return { due: true, text: `${mine.length} streaks end at midnight: ${list}.` }
}
