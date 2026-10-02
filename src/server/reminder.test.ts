// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { reminderFor } from './reminder.js'
import type { StreakSource } from '../steward.js'

const src: StreakSource = {
  id: 'snaps', label: 'Snaps', href: '/snaps', actionLabel: 'Share a snap', mode: 'each', members: ['ana', 'ben'],
  times: { ana: ['2026-09-29T20:00:00Z', '2026-09-28T20:00:00Z'] },
}

describe('reminderFor', () => {
  it("counts in the person's own zone and reminds at their time", () => {
    // 03:30 UTC on 1 October is 20:30 on 30 September in Los Angeles: Ana last shared on the 29th there.
    const r = reminderFor({ sources: [src], me: 'ana', timeZone: 'America/Los_Angeles', now: new Date('2026-10-01T03:30:00Z') })
    expect(r).toMatchObject({ due: true, day: '2026-09-30', text: 'Your 2 day Snaps streak ends at midnight. Share a snap.' })
  })

  it('defaults to 8 PM, and is not due before it', () => {
    const r = reminderFor({ sources: [src], me: 'ana', timeZone: 'America/Los_Angeles', now: new Date('2026-10-01T02:30:00Z') })
    expect(r).toMatchObject({ due: false, day: '2026-09-30' })
  })

  it('is not due again on a day already reminded', () => {
    const r = reminderFor({ sources: [src], me: 'ana', timeZone: 'America/Los_Angeles', lastRemindedDay: '2026-09-30', now: new Date('2026-10-01T03:30:00Z') })
    expect(r.due).toBe(false)
  })

  it('honours a chosen time', () => {
    const r = reminderFor({ sources: [src], me: 'ana', timeZone: 'America/Los_Angeles', remindAt: '21:00', now: new Date('2026-10-01T03:30:00Z') })
    expect(r.due).toBe(false)
  })
})
