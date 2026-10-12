'use client'

import { useEffect, useRef, useState } from 'react'
import { atStake, type AtStakeResult, type StreakSource } from '../steward.js'
import { zonesOf, type StreakZones } from '../streak.js'
import { msUntilMidnight } from '../zoned.js'

// The data a result depends on, as a string, so a caller that builds its sources afresh on every
// render does not recompute (and re-render) forever.
const keyOf = (sources: StreakSource[], me: string, timeZone?: StreakZones) =>
  JSON.stringify([me, timeZone ?? null, sources.map((s) => [s.id, s.label, s.href, s.actionLabel, s.mode, s.members, s.times, s.freeSkipsPerWeek ?? 0])])

// The next moment a count would read a different day: the earliest midnight among the zones in
// play, or the device's own when the app keeps no zone.
const msToNextDay = (now: Date, timeZone?: StreakZones) =>
  timeZone ? Math.min(...zonesOf(timeZone).map((z) => msUntilMidnight(now, z))) : msUntilMidnight(now)

// atStake on the phone, after mount. With no zone a day is the phone's own day, which the server
// cannot know, so this is null during the server render and the first client render (no hydration
// mismatch), then the result. Pass the zone the app keeps its streaks in and the phone counts in
// that zone instead, so a traveller's phone and the server agree about which day it is. It counts
// again when the page comes back into view and at the next midnight in play, so a home screen left
// open overnight does not keep saying yesterday's streaks are at stake.
export function useAtStake(sources: StreakSource[], me: string, timeZone?: StreakZones): AtStakeResult | null {
  const [result, setResult] = useState<AtStakeResult | null>(null)
  const latest = useRef({ sources, me, timeZone })
  latest.current = { sources, me, timeZone }
  const key = keyOf(sources, me, timeZone)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const run = () => {
      const now = new Date()
      const zone = latest.current.timeZone
      setResult(atStake(latest.current.sources, latest.current.me, now, zone ? { timeZone: zone } : {}))
      clearTimeout(timer)
      timer = setTimeout(run, msToNextDay(now, zone))
    }
    const onVisible = () => { if (document.visibilityState === 'visible') run() }
    run()
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [key])
  return result
}
