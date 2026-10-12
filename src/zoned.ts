// Calendar arithmetic on day keys (YYYY-MM-DD) in one named time zone. The arithmetic itself runs in
// UTC so a daylight-saving shift can never add or lose a day.
export const DAY_MS = 86_400_000

export function zoned(date: Date, timeZone: string): { dayKey: string; hhmm: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? '00'
  return { dayKey: `${get('year')}-${get('month')}-${get('day')}`, hhmm: `${get('hour')}:${get('minute')}` }
}

const toUtc = (key: string) => { const [y, m, d] = key.split('-').map(Number); return Date.UTC(y, m - 1, d) }
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export const addDays = (key: string, n: number) => fromUtc(toUtc(key) + n * DAY_MS)
export const daysBetween = (from: string, to: string) => Math.round((toUtc(to) - toUtc(from)) / DAY_MS)
export const weekStart = (key: string) => addDays(key, -((new Date(toUtc(key)).getUTCDay() + 6) % 7))
export const minutesOf = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }

// A reminder run every ten minutes may be late; a slot stays due for an hour after its time.
export function inWindow(slot: string, nowHhmm: string, windowMin = 60): boolean {
  const d = minutesOf(nowHhmm) - minutesOf(slot)
  return d >= 0 && d < windowMin
}

// The device's own calendar day, in the same padded key the helpers above take, so one count can be
// read in the phone's day or in a named zone without two formats and two Monday rules.
const pad = (n: number) => String(n).padStart(2, '0')
export const localDayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// How long until a count would read a different day, so a screen left open overnight stops saying
// yesterday's streaks are at stake. One second past midnight, in the named zone or the device's.
// Every zone offset is a whole number of minutes, so the seconds are the same in all of them; a
// clock change between now and midnight moves this by an hour at most, and the next look corrects it.
export function msUntilMidnight(now: Date, timeZone?: string): number {
  if (!timeZone) return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1).getTime() - now.getTime()
  const sinceMidnight = minutesOf(zoned(now, timeZone).hhmm) * 60_000 + now.getSeconds() * 1000 + now.getMilliseconds()
  return DAY_MS - sinceMidnight + 1000
}
