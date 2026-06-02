'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { LeaderboardEntry } from '@/types/events'
import { PlayerAvatar } from './PlayerAvatar'
import { Trophy } from 'lucide-react'

const MEDAL_COLORS = [
  'text-yellow-400',   // 🥇 Gold
  'text-slate-300',    // 🥈 Silver
  'text-amber-600',    // 🥉 Bronze
]
const MEDAL_BG = [
  'border-yellow-400/30 bg-yellow-400/8',
  'border-slate-300/30 bg-slate-300/6',
  'border-amber-600/30 bg-amber-600/8',
]
const MEDAL_LABELS = ['🥇', '🥈', '🥉']

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    return (
      <span className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-full text-base font-black',
        MEDAL_COLORS[rank - 1]
      )}>
        {MEDAL_LABELS[rank - 1]}
      </span>
    )
  }
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/5 text-[11px] font-bold text-white/50">
      {rank}
    </span>
  )
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) return null
  const positive = delta > 0
  return (
    <motion.span
      key={delta}
      initial={{ opacity: 0, y: positive ? 6 : -6, scale: 0.85 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
      className={cn(
        'ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
        positive
          ? 'bg-emerald-400/15 text-emerald-400'
          : 'bg-red-400/15 text-red-400'
      )}
    >
      {positive ? '+' : ''}{delta.toLocaleString()}
    </motion.span>
  )
}

/**
 * TopLeaderboard — animated live top-10 panel.
 * Used in the host control panel during question/result/kahoot phases.
 */
export function TopLeaderboard({
  entries,
  showDelta = false,
  title = 'Top 10',
  className,
}: {
  entries: LeaderboardEntry[]
  showDelta?: boolean
  title?: string
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Trophy className="size-4 text-yellow-400" style={{ filter: 'drop-shadow(0 0 8px rgba(250,204,21,0.6))' }} />
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-yellow-400/90">
          {title}
        </p>
      </div>

      {/* Entries */}
      <div className="flex flex-col gap-1.5">
        <AnimatePresence initial={false}>
          {entries.length === 0 ? (
            <motion.p
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-4 text-center text-xs text-white/30"
            >
              Chờ kết thúc câu hỏi…
            </motion.p>
          ) : (
            entries.map((entry) => (
              <motion.div
                key={entry.id}
                layout
                layoutId={`lb-${entry.id}`}
                initial={{ opacity: 0, x: 16, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -16, scale: 0.9 }}
                transition={{
                  layout: { type: 'spring', stiffness: 380, damping: 34 },
                  opacity: { duration: 0.3 },
                  x: { duration: 0.3, ease: [0.32, 0.72, 0, 1] },
                }}
                className={cn(
                  'flex items-center gap-2 rounded-xl border px-3 py-2 transition-all duration-500',
                  entry.rank <= 3
                    ? MEDAL_BG[entry.rank - 1]
                    : 'border-white/8 bg-white/4 hover:bg-white/6',
                )}
                style={{
                  boxShadow: entry.rank === 1
                    ? 'inset 0 1px 0 rgba(250,204,21,0.12)'
                    : 'inset 0 1px 0 rgba(255,255,255,0.04)',
                }}
              >
                <RankBadge rank={entry.rank} />
                <PlayerAvatar nickname={entry.nickname} size="xs" pulse={entry.rank <= 3} />
                <span className={cn(
                  'min-w-0 flex-1 truncate text-[11px] font-semibold leading-tight',
                  entry.rank === 1 ? 'text-yellow-300' :
                  entry.rank === 2 ? 'text-slate-200' :
                  entry.rank === 3 ? 'text-amber-400' :
                  'text-white/80'
                )}>
                  {entry.nickname}
                </span>
                <span className={cn(
                  'shrink-0 font-mono text-[11px] font-bold',
                  entry.rank <= 3 ? MEDAL_COLORS[entry.rank - 1] : 'text-white/50'
                )}>
                  {entry.score.toLocaleString()}
                </span>
                {showDelta && <DeltaBadge delta={entry.delta} />}
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
