# @supersuit/streak-steward

Count streaks the same way in every app, and say on the home screen which ones end today and what
saves them.

An app with several streaks (photos shared, a daily question answered, a verse sent) usually counts
each one its own way and tells you a streak is in danger only when you open that tile, which is
exactly when you least need telling. This package does both jobs once:

- **One way to count.** What a day is, whose day it is, when a streak breaks, a free skip per week.
  One clock: the phone and the server can be told the same zone, so they can never disagree about
  which day it is and break a streak the other believes in.
- **A band for the home screen.** Which streaks end at midnight, longest first, each with the one
  tap that saves it, and whose move it is, so it never asks you to do what only someone else can.
- **One reminder before it ends.** A pure decision a notification job calls: due or not, and the
  words to send.

No guilt: no flame, nothing red, no count of what was lost. A broken streak simply starts again.

## Install

```bash
npm install @supersuit/streak-steward
```

Peers: `react` and `react-dom` 19, for the client entry only. The root and server entries need
neither.

## Three entry points

- `@supersuit/streak-steward`: types and every rule, pure, safe anywhere. `atStake`, `reminderDue`,
  `localClock`, and the counting itself (`streakOf`, `streaksOf`, `zonedStreakOf`,
  `zonedStreaksOf`, `captureStreak`, `householdStreakOf`, the `zoned` day helpers).
- `@supersuit/streak-steward/client`: `StreakBand` and `useAtStake`.
- `@supersuit/streak-steward/server`: `reminderFor`, the whole reminder decision for one person.
  Server only.

## Declare a streak

Each tile that has a streak declares it. Adding a streak to a tile later is a declaration, not new
code.

```ts
import type { StreakSource } from '@supersuit/streak-steward'

const sources: StreakSource[] = [
  {
    id: 'snaps', label: 'Snaps', href: '/snaps', actionLabel: 'Share a snap',
    // each: every member keeps their own streak, and you are shown yours.
    mode: 'each', members: ['ana', 'ben'],
    times: { ana: anaSnapTimes, ben: benSnapTimes },     // ISO strings that count
  },
  {
    id: 'question', label: 'Daily question', href: '/question', actionLabel: "Answer today's question",
    // together: one streak, kept by the days every member did it.
    mode: 'together', members: ['ana', 'ben'],
    times: { ana: anaAnswerTimes, ben: benAnswerTimes },
    waitingLabel: (name) => `Waiting on ${name} to answer`,  // optional
    freeSkipsPerWeek: 1,                                     // optional, default 0
  },
]
```

`atStake(sources, me, now?)` returns `{ rows, safe, total }`:

- a streak with a count of zero is not at stake, and is not counted: there is nothing to lose;
- a streak done today is safe;
- `each`: your own streak is at stake when you have not done it today, and the move is `'you'`;
- `together`: at stake while it is alive and not every member has done it today. The move is
  `'you'` when only you are left, `'them'` when only others are (`waitingOn` lists them), and
  `'both'` when you and someone else still have to act;
- a source whose `members` does not include `me` is left out;
- rows come longest first, then by label. `total` counts alive streaks, `safe` the ones done today,
  and `total` is always `rows.length + safe`.

A streak may forgive one missed day per Monday-to-Sunday week: `freeSkipsPerWeek: 1` on the source,
so the tile that owns the streak declares it once and the band, the reminder and the tile's own
screen cannot disagree about it. A day is only forgiven once a later day is kept; misses before the
streak began are where it began, not skips. The same option is the last argument of `streakOf`,
`streaksOf`, `zonedStreakOf` and `zonedStreaksOf`, and defaults to 0 everywhere.

## Which day it is

A day is the local calendar day of `now`, on the device that runs it. Pass
`{ timeZone: 'America/Los_Angeles' }` as the fourth argument to read the day in a named zone
instead, on a phone as well as on a server: an app whose streaks are kept in one zone should pass
that zone everywhere, or a phone an hour east of it will break a streak the server still believes
in.

When the members keep different zones, name them all and a day is read as generously as they allow:

```ts
atStake(sources, 'ana', now, { timeZone: { ana: 'America/New_York', ben: 'America/Chicago' } })
```

A time counts toward its day in EVERY zone in play, never only one, so a member's days are the
union of those keys and a day they shared is the intersection of the members' unions. One of them
sharing at 23:30 Central, which is already tomorrow an hour east, still shares the evening with
someone who shared at 22:00 Central. Nobody loses a day to a line on a map. Reading each member
only in their own zone is the answer that looks right and is less generous than one fixed zone,
which is why it is not what this does. "Today" is generous the same way: done today in any zone in
play is done today.

## The band

```tsx
'use client'
import { StreakBand, useAtStake } from '@supersuit/streak-steward/client'

export function HomeBand({ sources, me, timeZone }) {
  const result = useAtStake(sources, me, timeZone)   // 'America/Chicago', or { ana, ben } zones, or nothing
  return <StreakBand result={result} names={{ ben: 'Ben' }} theme={{ accent: '#2b5d8a', serif: 'Georgia, serif' }} />
}
```

`useAtStake` counts on the phone, after mount. It returns `null` during the server render (the band
renders nothing, so the markup matches), then the result, and counts again when the page comes back
into view and at the next midnight in play. The third argument is the zone, or the zones the members
keep, exactly as `atStake` takes them; left out, "today" is the phone's own day.

The band renders nothing when no streak is alive. When some are at stake it reads:

```
2 streaks end at midnight
Snaps · 12 days · Share a snap
Daily question · 5 days · Waiting on Ben
```

and when everything is done, one quiet line: `All 3 streaks safe today.` It is a `role="status"`
region, and each action is a link to the source's `href`. Theme tokens (`ink`, `muted`, `card`,
`hairline`, `accent`, `serif`) are all optional, with neutral defaults.

## The reminder

The decision is pure, so any job can call it. One message for everything at stake, at most once a
day, and never for a streak that only someone else can save:

```ts
import { reminderDue } from '@supersuit/streak-steward'

reminderDue({ rows, localTime: '20:05', remindAt: '20:00', lastRemindedDay: '2031-05-04', today: '2031-05-05' })
// { due: true, text: 'Your 12 day Snaps streak ends at midnight. Share a snap.' }
// several: '3 streaks end at midnight: Snaps (12 days), Daily question (5 days) and Verses (2 days).'
```

On a server, `reminderFor` does the whole thing for one person in their own time zone:

```ts
import { reminderFor } from '@supersuit/streak-steward/server'

const r = reminderFor({ sources, me: 'ana', timeZone: person.timeZone, remindAt: person.remindAt ?? '20:00', lastRemindedDay: person.lastRemindedDay })
if (r.due) { await sendPush(person, r.text); await saveLastRemindedDay(person, r.day) }
```

The package never sends anything and keeps no state: sending, the person's notification switches,
and remembering `r.day` are the app's. A malformed time is never due rather than an error, so one bad
stored setting cannot stop a job that loops over everyone.

`timeZone` is the person's own clock, which decides when the reminder is due and which day it is
sent on. When the members keep different zones, pass them as `memberZones` as well and the counting
is as generous as the band's; without it the count reads in `timeZone` alone.

`localClock(now, timeZone)` gives `{ day: 'YYYY-MM-DD', time: 'HH:MM' }` in that zone, and
`msUntilMidnight(now, timeZone?)` says how long until a count there would read a different day.

## Checks

`npm run check` runs the types, the tests, the build (with a check that the client entry keeps
`'use client'` and the server entry is guarded), the private-words check, a check for dates in
comments, and a Next.js app that installs the packed tarball and builds.
