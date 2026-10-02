'use client'

import { useEffect, useRef, useState } from 'react'
import { atStake, type AtStakeResult, type StreakSource } from '../steward.js'

// The data a result depends on, as a string, so a caller that builds its sources afresh on every
// render does not recompute (and re-render) forever.
const keyOf = (sources: StreakSource[], me: string) =>
  JSON.stringify([me, sources.map((s) => [s.id, s.label, s.href, s.actionLabel, s.mode, s.members, s.times])])

const msToMidnight = (now: Date) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1).getTime() - now.getTime()

// atStake on the phone, after mount. A day is the phone's own day, which the server cannot know,
// so this is null during the server render and the first client render (no hydration mismatch),
// then the result. It counts again when the page comes back into view and at local midnight, so a
// home screen left open overnight does not keep saying yesterday's streaks are at stake.
export function useAtStake(sources: StreakSource[], me: string): AtStakeResult | null {
  const [result, setResult] = useState<AtStakeResult | null>(null)
  const latest = useRef({ sources, me })
  latest.current = { sources, me }
  const key = keyOf(sources, me)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const run = () => {
      const now = new Date()
      setResult(atStake(latest.current.sources, latest.current.me, now))
      clearTimeout(timer)
      timer = setTimeout(run, msToMidnight(now))
    }
    const onVisible = () => { if (document.visibilityState === 'visible') run() }
    run()
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [key])
  return result
}
