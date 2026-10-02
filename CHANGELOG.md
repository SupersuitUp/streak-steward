# Changelog

Version convention: below 1.0, an addition is a patch and a breaking change is a minor (npm reads `^0.1.0` as 0.1.x only).

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
