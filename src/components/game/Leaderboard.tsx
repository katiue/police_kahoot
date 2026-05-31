'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { PlayerView } from '@/types/events'
import { PlayerAvatar } from './PlayerAvatar'

/**
 * PlayerStatus — avatar card grid for active survivors, compact list for eliminated.
 * Used on host screen during question/result phases.
 */
export function PlayerStatus({
  players,
  highlightId,
  max = 24,
}: {
  players: PlayerView[]
  highlightId?: string
  max?: number
}) {
  const allActive = players.filter((p) => !p.eliminated)
  const active = allActive.slice(0, max)
  const hiddenCount = allActive.length - active.length
  const eliminated = players.filter((p) => p.eliminated)

  return (
    <div className="flex w-full flex-col gap-5">
      {/* ── Active survivors grid ─────────────────────── */}
      {active.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">
              Còn lại ({active.length})
            </p>
          </div>

          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
            {hiddenCount > 0 && (
              <div
                className="flex items-center justify-center rounded-xl border border-[rgba(0,212,255,0.18)] bg-[rgba(0,212,255,0.05)] px-2 py-3 text-[11px] font-bold text-[var(--accent)]"
                aria-label={`Còn ${hiddenCount} người chơi khác không hiển thị`}
              >
                +{hiddenCount}
              </div>
            )}
            <AnimatePresence initial={false}>
              {active.map((p, i) => {
                const isHighlight = p.id === highlightId
                return (
                  <motion.div
                    key={p.id}
                    layout
                    initial={{ opacity: 0, scale: 0.75, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{
                      opacity: 0,
                      scale: 0.6,
                      y: -6,
                      filter: 'grayscale(1)',
                      transition: { duration: 0.45, ease: [0.32, 0.72, 0, 1] },
                    }}
                    transition={{
                      type: 'spring',
                      stiffness: 460,
                      damping: 36,
                      delay: i * 0.025,
                    }}
                    className={cn(
                      'relative flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3',
                      'transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]',
                      isHighlight
                        ? 'border-[var(--accent)]/50 bg-[var(--accent)]/10 glow-cyan'
                        : 'border-[rgba(0,212,255,0.12)] bg-[rgba(6,24,48,0.7)]',
                    )}
                    style={{ boxShadow: isHighlight ? undefined : 'inset 0 1px 0 rgba(255,255,255,0.03)' }}
                  >
                    <PlayerAvatar nickname={p.nickname} size="sm" pulse={!isHighlight} />
                    <span className="w-full truncate text-center text-[11px] font-semibold leading-tight text-[var(--foreground)]">
                      {p.nickname}
                    </span>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* ── Eliminated compact list ───────────────────── */}
      {eliminated.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-400/70">
            Đã bị loại ({eliminated.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            <AnimatePresence initial={false}>
              {eliminated.map((p) => (
                <motion.span
                  key={p.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 0.55, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  className="flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/5 px-2.5 py-1"
                >
                  <PlayerAvatar nickname={p.nickname} size="xs" eliminated />
                  <span className="text-[11px] font-medium text-red-300/80">
                    {p.nickname}
                  </span>
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  )
}

// Keep legacy export name for any residual imports
export { PlayerStatus as Leaderboard }
