import type { StreakSource } from '@supersuit/streak-steward'

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

// Two streaks as an app would declare them: one each, one together.
export const sources: StreakSource[] = [
  { id: 'snaps', label: 'Snaps', href: '/snaps', actionLabel: 'Share a snap', mode: 'each', members: ['ana', 'ben'], times: { ana: [daysAgo(1), daysAgo(2)] } },
  { id: 'question', label: 'Daily question', href: '/question', actionLabel: "Answer today's question", mode: 'together', members: ['ana', 'ben'], times: { ana: [daysAgo(1)], ben: [daysAgo(1)] } },
]
