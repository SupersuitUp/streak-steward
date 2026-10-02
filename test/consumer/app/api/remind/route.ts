import { reminderFor } from '@supersuit/streak-steward/server'
import { sources } from '../../../lib/sources'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function GET() {
  const r = reminderFor({ sources, me: 'ana', timeZone: 'America/Los_Angeles' })
  return Response.json({ due: r.due, text: r.text ?? null, day: r.day })
}
