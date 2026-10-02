'use client'

import { StreakBand, useAtStake } from '@supersuit/streak-steward/client'
import { sources } from '../lib/sources'

export function Band() {
  return <StreakBand result={useAtStake(sources, 'ana')} names={{ ben: 'Ben' }} theme={{ accent: '#225588' }} />
}
