import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { StreakBand } from './streak-band.js'
import { useAtStake } from './use-at-stake.js'
import type { AtStake, AtStakeResult, StreakSource } from '../steward.js'

const row = (o: Partial<AtStake>): AtStake => ({
  id: 'x', label: 'Snaps', href: '/snaps', actionLabel: 'Share a snap', count: 12, whoseMove: 'you', waitingOn: [], ...o,
})
const result = (rows: AtStake[], safe = 0): AtStakeResult => ({ rows, safe, total: rows.length + safe })

describe('StreakBand', () => {
  it('renders nothing with no result, and nothing when no streak is alive', () => {
    expect(render(<StreakBand result={null} />).container).toBeEmptyDOMElement()
    expect(render(<StreakBand result={result([])} />).container).toBeEmptyDOMElement()
  })

  it('says how many end at midnight, one row each with the action that saves it', () => {
    render(<StreakBand result={result([row({}), row({ id: 'q', label: 'Daily question', href: '/q', actionLabel: "Answer today's question", count: 5 })])} />)
    expect(screen.getByRole('status')).toHaveTextContent('2 streaks end at midnight')
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Snaps · 12 days · Share a snap',
      "Daily question · 5 days · Answer today's question",
    ])
    const link = screen.getByRole('link', { name: 'Share a snap to keep your 12 day Snaps streak' })
    expect(link).toHaveAttribute('href', '/snaps')
  })

  it('uses the singular for one streak and one day', () => {
    render(<StreakBand result={result([row({ count: 1 })])} />)
    expect(screen.getByRole('status')).toHaveTextContent('1 streak ends at midnight')
    expect(screen.getByRole('listitem').textContent).toBe('Snaps · 1 day · Share a snap')
  })

  it("says who it is waiting on instead of asking you to act, when the move is theirs", () => {
    render(<StreakBand names={{ ben: 'Ben' }} result={result([row({ whoseMove: 'them', waitingOn: ['ben'] })])} />)
    expect(screen.getByRole('listitem').textContent).toBe('Snaps · 12 days · Waiting on Ben')
    expect(screen.queryByRole('link')).toBeNull()
  })

  it("uses the source's own waiting words, and joins several names", () => {
    render(<StreakBand
      names={{ ben: 'Ben', cy: 'Cy' }}
      result={result([row({ whoseMove: 'them', waitingOn: ['ben', 'cy'], waitingLabel: (n) => `${n} still to answer` })])}
    />)
    expect(screen.getByRole('listitem').textContent).toBe('Snaps · 12 days · Ben and Cy still to answer')
  })

  it('still offers the action when both of you have to act', () => {
    render(<StreakBand result={result([row({ whoseMove: 'both', waitingOn: ['ben'] })])} />)
    expect(screen.getByRole('link', { name: /Share a snap/ })).toBeInTheDocument()
  })

  it('says quietly that everything is safe when nothing is at stake', () => {
    render(<StreakBand result={result([], 3)} />)
    expect(screen.getByRole('status')).toHaveTextContent('All 3 streaks safe today.')
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('uses the singular when the one streak is safe', () => {
    render(<StreakBand result={result([], 1)} />)
    expect(screen.getByRole('status')).toHaveTextContent('Your streak is safe today.')
  })

  it('draws with the theme it is handed, and never in red', () => {
    const { container } = render(<StreakBand theme={{ accent: '#123456', card: '#fafafa' }} result={result([row({})])} />)
    expect(screen.getByRole('link').getAttribute('style')).toContain('rgb(18, 52, 86)')
    expect(screen.getByRole('status').getAttribute('style')).toContain('rgb(250, 250, 250)')
    expect(container.innerHTML).not.toMatch(/red|#f00|rgb\(255, 0, 0\)|🔥/i)
  })

  it('renders to a string on a server', () => {
    const html = renderToString(<StreakBand result={result([row({})])} />)
    expect(html).toContain('1 streak ends at midnight')
    expect(html).toContain('href="/snaps"')
  })
})

describe('useAtStake', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] }); vi.setSystemTime(new Date(2026, 8, 27, 18)) })
  afterEach(() => vi.useRealTimers())

  const sources: StreakSource[] = [{
    id: 'snaps', label: 'Snaps', href: '/snaps', actionLabel: 'Share a snap', mode: 'each', members: ['ana'],
    times: { ana: [new Date(2026, 8, 26, 12).toISOString(), new Date(2026, 8, 25, 12).toISOString()] },
  }]
  function Home() {
    // A new array on every render, as an app that builds its sources inline would pass.
    return <StreakBand result={useAtStake([...sources], 'ana')} />
  }

  it('is null in the server render, so the band is absent there and the markup matches', () => {
    expect(renderToString(<Home />)).toBe('')
  })

  it('computes on the phone after mount, and settles rather than re-rendering forever', () => {
    render(<Home />)
    expect(screen.getByRole('status')).toHaveTextContent('1 streak ends at midnight')
    expect(screen.getByRole('listitem').textContent).toBe('Snaps · 2 days · Share a snap')
  })

  it('counts again at local midnight', () => {
    render(<Home />)
    expect(screen.getByRole('listitem').textContent).toBe('Snaps · 2 days · Share a snap')
    // Past midnight the 26th is two days ago: the streak broke, so the band goes away.
    act(() => { vi.advanceTimersByTime(7 * 3600 * 1000) })
    expect(screen.queryByRole('status')).toBeNull()
  })
})

// Two zones a day and an hour apart, so the same moment is a different calendar day in each and
// neither can be the machine the suite happens to run on.
describe('useAtStake in a named zone', () => {
  const EARLY = 'Pacific/Kiritimati' // the first zone into a new day
  const LATE = 'Pacific/Pago_Pago' // the last one out of the old day
  const NOW = new Date('2026-10-12T10:40:00Z')
  const sources: StreakSource[] = [{
    id: 'snaps', label: 'Snaps', href: '/snaps', actionLabel: 'Share a snap', mode: 'each', members: ['ana'],
    times: { ana: ['2026-10-11T12:00:00Z'] },
  }]
  const Home = ({ zone }: { zone?: string }) => <StreakBand result={useAtStake(sources, 'ana', zone)} />

  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] }); vi.setSystemTime(NOW) })
  afterEach(() => vi.useRealTimers())

  it('reads the day in the zone it is given, not the one the device is in', () => {
    // In the early zone that snap was yesterday, so the streak ends tonight.
    render(<Home zone={EARLY} />)
    expect(screen.getByRole('status')).toHaveTextContent('1 streak ends at midnight')
    // In the late zone the same snap is today's, so there is nothing to do.
    render(<Home zone={LATE} />)
    expect(screen.getAllByRole('status').at(-1)).toHaveTextContent('Your streak is safe today.')
  })

  it('counts again at midnight in that zone rather than the device\'s', () => {
    render(<Home zone={LATE} />)
    expect(screen.getByRole('status')).toHaveTextContent('Your streak is safe today.')
    // The next day begins in the late zone twenty minutes from now; the device's own midnight is
    // somewhere else entirely, and waiting for it would leave the band a day stale.
    act(() => { vi.advanceTimersToNextTimer() })
    expect(new Date().toISOString()).toBe('2026-10-12T11:00:01.000Z')
    expect(screen.getByRole('status')).toHaveTextContent('1 streak ends at midnight')
  })
})
