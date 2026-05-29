'use client'
import { motion, AnimatePresence } from 'framer-motion'
import type { PlayerView, PublicQuestion } from '@/types/events'
import { PlayerAvatar } from './PlayerAvatar'
import { Radio, Users, UserX, AlertTriangle } from 'lucide-react'

/**
 * SpectatorView — shown to eliminated players during an active question.
 * Focuses on WHO is still standing in a cybersec monitoring center format.
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
      transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
      className="spectator-scanlines relative flex flex-col gap-5 overflow-hidden rounded-2xl hud-frame-quad p-5"
      style={{ background: 'rgba(4,16,38,0.97)' }}
    >
      {/* All-4-corner accent spans */}
      <span className="hud-corner-tr" aria-hidden />
      <span className="hud-corner-bl" aria-hidden />

      {/* Scan-line sweep decoration */}
      <div
        className="animate-scan-line absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400/35 to-transparent"
        aria-hidden
      />

      {/* Header Panel */}
      <div className="relative z-10 flex flex-col gap-2 border-b border-[rgba(0,191,255,0.12)] pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Radio className="size-5 text-[var(--cyan-accent)] animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-[var(--cyan-accent)]">
              GIÁM SÁT AN NINH SỐ
            </span>
          </div>
          <span className="text-[10px] rounded border border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5 font-bold uppercase tracking-wider text-emerald-400">
            CHẾ ĐỘ KHÁN GIẢ
          </span>
        </div>

        {/* minimized question ticker */}
        {question && (
          <div className="flex items-center gap-2 rounded bg-black/45 px-3 py-1.5 border border-border/10 overflow-hidden w-full">
            <span className="text-[9px] font-bold uppercase tracking-widest text-accent shrink-0 z-10 bg-black/45 pr-1">TIẾN TRÌNH:</span>
            <div className="flex-1 overflow-hidden relative h-5 flex items-center">
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: '-120%' }}
                transition={{ repeat: Infinity, ease: 'linear', duration: 18 }}
                className="absolute whitespace-nowrap text-xs font-semibold text-muted-foreground uppercase"
              >
                CÂU {question.index + 1}: {question.text} — KIỂM CHỨNG KỸ, NHẬN DIỆN ĐÚNG, HÀNH ĐỘNG AN TOÀN!
              </motion.div>
            </div>
          </div>
        )}
      </div>

      {/* Main Grid: Active Agents and Offline Agents */}
      <div className="relative z-10 flex flex-col gap-4">
        
        {/* Active Agents (Survivors) Section */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-emerald-400" />
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-400">
                LỰC LƯỢNG ĐANG TRỰC
              </span>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
              {activePlayers.length} ĐẶC VỤ
            </span>
          </div>

          {activePlayers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 rounded-xl border border-dashed border-red-500/20 bg-red-500/5 gap-2">
              <AlertTriangle className="size-6 text-red-400" />
              <p className="text-xs font-semibold text-red-400 uppercase tracking-wider">LỰC LƯỢNG ĐÃ THẤT THỦ</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              <AnimatePresence initial={false}>
                {activePlayers.map((p, i) => (
                  <motion.div
                    key={p.id}
                    layout
                    initial={{ opacity: 0, scale: 0.8, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{
                      type: 'spring',
                      stiffness: 420,
                      damping: 35,
                      delay: i * 0.02,
                    }}
                    className="flex items-center gap-2 rounded-xl border border-[rgba(0,212,255,0.12)] bg-[rgba(6,24,48,0.8)] p-2"
                  >
                    <PlayerAvatar nickname={p.nickname} size="xs" pulse />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="truncate text-xs font-bold text-white leading-tight">
                        {p.nickname}
                      </span>
                      <span className="text-[8px] font-bold tracking-wider text-emerald-400 uppercase leading-none mt-0.5 flex items-center gap-1">
                        <span className="size-1 rounded-full bg-emerald-400 animate-pulse" />
                        ĐANG TRỰC
                      </span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Offline / Eliminated Section */}
        {(eliminatedCount > 0 || eliminatedPlayers.length > 0) && (
          <div className="flex flex-col gap-2.5 border-t border-[rgba(0,191,255,0.06)] pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserX className="size-4 text-rose-400" />
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-rose-400/80">
                  ĐẶC VỤ NGẮT KẾT NỐI
                </span>
              </div>
              <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-400 border border-rose-500/20">
                {(eliminatedPlayers.length > 0 ? eliminatedPlayers.length : eliminatedCount)} BỊ LOẠI
              </span>
            </div>

            {eliminatedPlayers.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {eliminatedPlayers.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/15 bg-rose-500/5 px-2.5 py-0.5 text-[10px] font-bold text-rose-400/70"
                  >
                    <PlayerAvatar nickname={p.nickname} size="xs" eliminated />
                    {p.nickname}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400/60 pl-1">
                Gồm {eliminatedCount} đặc vụ đã ngắt kết nối hệ thống an ninh.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Bottom status text */}
      <div className="relative z-10 border-t border-[rgba(0,191,255,0.08)] pt-3 text-center">
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground opacity-60">
          AN TOÀN SỐ BẮT ĐẦU TỪ NHẬN THỨC · HÀNH ĐỘNG AN TOÀN
        </p>
      </div>
    </motion.div>
  )
}

