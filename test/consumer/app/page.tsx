import { atStake } from '@supersuit/streak-steward'
import { sources } from '../lib/sources'
import { Band } from './band'

export const dynamic = 'force-dynamic'

// A server component using the plain entry, rendering the client band beneath it.
export default function Page() {
  const r = atStake(sources, 'ana')
  return <main><p>{r.total} alive</p><Band /></main>
}
