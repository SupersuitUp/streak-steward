'use client'

import type { CSSProperties } from 'react'
import type { AtStake, AtStakeResult } from '../steward.js'
import { listOf } from '../steward.js'

/** The look the band draws with. Every token is optional; the defaults are neutral. */
export interface StreakBandTheme { ink: string; muted: string; card: string; hairline: string; accent: string; serif: string }

export const DEFAULT_BAND_THEME: StreakBandTheme = {
  ink: '#1a1a1a', muted: '#767676', card: '#ffffff', hairline: '#ececec', accent: '#1a1a1a', serif: 'Georgia, serif',
}

const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`

export function bandHeading(n: number): string {
  return n === 1 ? '1 streak ends at midnight' : `${n} streaks end at midnight`
}

export function safeLine(n: number): string {
  return n === 1 ? 'Your streak is safe today.' : `All ${n} streaks safe today.`
}

function waitingText(row: AtStake, names: Record<string, string>): string {
  const who = listOf(row.waitingOn.map((m) => names[m] ?? m))
  return row.waitingLabel ? row.waitingLabel(who) : `Waiting on ${who}`
}

// A calm band for the top of a home screen: which streaks end at midnight and the one tap that
// saves each, longest first. Nothing red, no flame, no count of what was lost. It says whose move
// it is, so it never asks a person to do what only someone else can. Renders nothing until there
// is a result (see useAtStake) and nothing when no streak is alive.
export function StreakBand({ result, theme, names = {} }: {
  result: AtStakeResult | null
  theme?: Partial<StreakBandTheme>
  /** Display names for member keys, for "Waiting on <name>". */
  names?: Record<string, string>
}) {
  if (!result || result.total === 0) return null
  const t = { ...DEFAULT_BAND_THEME, ...theme }
  const box: CSSProperties = { backgroundColor: t.card, border: `1px solid ${t.hairline}`, borderRadius: 16, padding: '12px 16px', color: t.ink }
  if (result.rows.length === 0) {
    if (result.safe === 0) return null
    return (
      <section role="status" aria-label="Streaks" style={box}>
        <p style={{ margin: 0, color: t.muted, fontFamily: t.serif, fontSize: 14 }}>{safeLine(result.safe)}</p>
      </section>
    )
  }
  return (
    <section role="status" aria-label="Streaks" style={box}>
      <p style={{ margin: 0, fontFamily: t.serif, fontSize: 16, fontWeight: 500 }}>{bandHeading(result.rows.length)}</p>
      <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}>
        {result.rows.map((r) => (
          <li key={r.id} style={{ padding: '6px 0', borderTop: `1px solid ${t.hairline}`, fontSize: 14 }}>
            <span>{r.label}</span>
            <span aria-hidden style={{ color: t.muted }}> · </span>
            <span style={{ color: t.muted }}>{days(r.count)}</span>
            <span aria-hidden style={{ color: t.muted }}> · </span>
            {r.whoseMove === 'them'
              ? <span style={{ color: t.muted }}>{waitingText(r, names)}</span>
              : (
                <a
                  href={r.href}
                  aria-label={`${r.actionLabel} to keep your ${r.count} day ${r.label} streak`}
                  style={{ color: t.accent, fontWeight: 500, textDecoration: 'none' }}
                >{r.actionLabel}</a>
              )}
          </li>
        ))}
      </ul>
    </section>
  )
}
