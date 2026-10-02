import { atStake, localClock, reminderDue, type AtStakeResult, type StreakSource } from '../steward.js'

export interface ReminderForInput {
  sources: StreakSource[]
  me: string
  /** The person's own IANA time zone. */
  timeZone: string
  /** HH:MM in their zone. Default 20:00. */
  remindAt?: string
  /** The day a reminder was last sent to them. Store `day` from the result when you send. */
  lastRemindedDay?: string
  now?: Date
}

export interface ReminderFor { due: boolean; text?: string; day: string; result: AtStakeResult }

// The whole decision for one person, for a job that runs every few minutes: count their streaks in
// their own zone, then ask whether a reminder is due. Sending it, and remembering `day` as the last
// reminded day, are the app's: the package never sends anything and keeps no state.
export function reminderFor(input: ReminderForInput): ReminderFor {
  const now = input.now ?? new Date()
  const clock = localClock(now, input.timeZone)
  const result = atStake(input.sources, input.me, now, { timeZone: input.timeZone })
  const r = reminderDue({
    rows: result.rows, localTime: clock.time, remindAt: input.remindAt ?? '20:00',
    lastRemindedDay: input.lastRemindedDay, today: clock.day,
  })
  return { ...r, day: clock.day, result }
}
