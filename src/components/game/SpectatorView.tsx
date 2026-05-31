'use client'
import { motion, AnimatePresence } from 'framer-motion'
import type { PlayerView, PublicQuestion } from '@/types/events'
import { PlayerAvatar } from './PlayerAvatar'
import { Radio, Users, UserX, AlertTriangle } from 'lucide-react'

/**
 * SpectatorView — shown to eliminated players. Focused, low-noise:
 * status badge + active-agent grid + offline-agent list. No ticker, no slogan.
 */
export function SpectatorView({
  survivors,
  eliminatedCount,
  question,
  allPlayers = [],
}: {
  survivors: PlayerView[]
  eliminatedCount: number
  question: PublicQuestion | null
  allPlayers?: PlayerView[]
}) {
  const activePlayers = allPlayers.length > 0 ? allPlayers.filter(p => !p.eliminated) : survivors
  const eliminatedPlayers = allPlayers.length > 0 ? allPlayers.filter(p => p.eliminated) : []

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
      className="relative flex flex-col gap-4 overflow-hidden rounded-2xl hud-frame-quad p-5"
      style={{ background: 'rgba(4,16,38,0.97)' }}
    >
      <span className="hud-corner-tr" aria-hidden />
      <span className="hud-corner-bl" aria-hidden />

      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-[rgba(0,191,255,0.12)] pb-3">
        <div className="flex items-center gap-2">
          <Radio className="size-4 text-[var(--accent)] animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
            Chế độ khán giả
          </span>
        </div>
        {question && (
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Câu {question.index + 1}
          </span>
        )}
      </div>

      {/* Active */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Users className="size-3.5 text-emerald-400" />
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-400">
              Đang chơi
            </span>
          </div>
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
            {activePlayers.length}
          </span>
        </div>

        {activePlayers.length === 0 ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-red-500/20 bg-red-500/5 py-4">
            <AlertTriangle className="size-4 text-red-400" />
            <p className="text-xs font-semibold text-red-400">Không còn ai sống sót</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            <AnimatePresence initial={false}>
              {activePlayers.map((p, i) => (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 35, delay: Math.min(i, 12) * 0.02 }}
                  className="flex items-center gap-2 rounded-xl border border-[rgba(0,212,255,0.12)] bg-[rgba(6,24,48,0.8)] p-2"
                >
                  <PlayerAvatar nickname={p.nickname} size="xs" pulse />
                  <span className="truncate text-xs font-semibold text-white">{p.nickname}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Eliminated */}
      {(eliminatedCount > 0 || eliminatedPlayers.length > 0) && (
        <div className="flex flex-col gap-2 border-t border-[rgba(0,191,255,0.06)] pt-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <UserX className="size-3.5 text-rose-400" />
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-rose-400/80">
                Đã loại
              </span>
            </div>
            <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-400 border border-rose-500/20">
              {eliminatedPlayers.length > 0 ? eliminatedPlayers.length : eliminatedCount}
            </span>
          </div>

          {eliminatedPlayers.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {eliminatedPlayers.map((p) => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/15 bg-rose-500/5 px-2 py-0.5 text-[10px] font-medium text-rose-400/80"
                >
                  <PlayerAvatar nickname={p.nickname} size="xs" eliminated />
                  {p.nickname}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}
