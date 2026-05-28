'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { LeaderboardRow } from '@/types/events'

const MEDAL = ['🥇', '🥈', '🥉']

export function Leaderboard({
  rows,
  highlightId,
  max = 8,
}: {
  rows: LeaderboardRow[]
  highlightId?: string
  max?: number
}) {
  const top = rows.slice(0, max)
  return (
    <div className="flex w-full flex-col gap-2">
      <AnimatePresence initial={false}>
        {top.map((r) => {
          const mine = r.playerId === highlightId
          return (
            <motion.div
              key={r.playerId}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-4 py-3',
                mine ? 'border-accent glow-cyan bg-accent/10' : 'border-[var(--section-border)] bg-card/60'
              )}
            >
              <span className="w-7 text-center text-lg font-bold tabular-nums">
                {MEDAL[r.rank - 1] ?? r.rank}
              </span>
              <span className="flex-1 truncate font-semibold">{r.nickname}</span>
              {r.lastGain > 0 && (
                <span className="text-sm font-bold text-correct">+{r.lastGain}</span>
              )}
              <span className="w-20 text-right text-lg font-bold tabular-nums text-accent">
                {r.score}
              </span>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
