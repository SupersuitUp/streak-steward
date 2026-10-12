# Changelog

Version convention: below 1.0, an addition is a patch and a breaking change is a minor (npm reads `^0.1.0` as 0.1.x only).

## 0.1.1 (2026-10-12)

Three additions, all optional, so every existing call site counts exactly as it did.

- **One clock.** `useAtStake(sources, me, timeZone?)` takes the zone the app keeps its streaks in
  and counts the day there, on the phone as well as on the server. Left out, it is the device's own
  day as before. A phone an hour east of the zone its app counts in was breaking streaks the server
  still believed in; the band also recounts at the next midnight in play rather than the device's.
- **A group day is read as generously as the zones allow.** The `timeZone` of `atStake`,
  `zonedStreaksOf` and `useAtStake` now takes a record of each member's zone as well as one zone
  for everyone. A time then counts toward its day in every zone in play, so a member's days are the
  union of those keys and a day they shared is the intersection of the members' unions: 23:30
  Central and 22:00 Central are the same evening even when one of them reads as tomorrow an hour
  east. A plain string behaves exactly as it did. `reminderFor` takes the same record as
  `memberZones`, so a reminder is never stricter than the band.
- **A free skip a week on the each-and-together path.** `freeSkipsPerWeek: 0 | 1` on a
  `StreakSource` (and as the last argument of `streakOf`, `streaksOf`, `zonedStreakOf` and
  `zonedStreaksOf`), default 0. One walk backwards now counts every streak in the package,
  `captureStreak`'s, so the household rule and these cannot drift apart: the device's own day is
  read as a padded key like every other, and there is no second idea of a day or of a Monday.
- `zonedStreakOf` counts one person's streak in named zones, which two apps were writing by hand as
  a one-member `zonedStreaksOf`. `localDayKey` and `msUntilMidnight` are exported with it.

## 0.1.0 (2026-10-02)

- First version. The streak arithmetic moved out of `@supersuit/cowitness` unchanged in behaviour
  (`streakOf`, `streaksOf`, `captureStreak`, `householdStreakOf`, the `zoned` day helpers, and the
  `StreakRule` types), with its tests. `streaksOf` and `householdStreakOf` take any rows shaped
  `{ by, createdAt, hidden? }`.
- The steward: `atStake` says which streaks end at midnight, whose move it is and how many are
  safe; `reminderDue` decides one reminder a day; `localClock` reads a day and time in a zone;
  `zonedStreaksOf` counts each-and-together streaks in a named zone.
- `./client`: `StreakBand`, a calm home-screen band, and `useAtStake`, which counts on the phone
  after mount.
- `./server`: `reminderFor`, the whole reminder decision for one person in their own zone.
