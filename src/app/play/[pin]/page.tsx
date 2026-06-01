'use client'
import { use, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { Backdrop } from '@/components/game/Backdrop'
import { Button } from '@/components/ui/button'
import { Timer } from '@/components/game/Timer'
import { AnswerGrid } from '@/components/game/AnswerGrid'
import { SpectatorView } from '@/components/game/SpectatorView'
import { PlayerAvatar } from '@/components/game/PlayerAvatar'
import { PoliceEmblem } from '@/components/game/PoliceEmblem'
import { ConnectionDot } from '@/components/game/ConnectionDot'
import { getSocket } from '@/lib/socket-client'
import { formatPin, haptic } from '@/lib/utils'
import type { GameStatus, PublicQuestion, QuestionResult, PlayerView } from '@/types/events'
import { CheckCircle2, XCircle, Hourglass, Trophy, Frown, ShieldCheck } from 'lucide-react'

export default function PlayRoomPage({ params }: { params: Promise<{ pin: string }> }) {
  const { pin } = use(params)
  const router = useRouter()
  const [isMounted, setIsMounted] = useState(false)

  const [status, setStatus] = useState<GameStatus>('lobby')
  const [nickname, setNickname] = useState('')
  const [question, setQuestion] = useState<PublicQuestion | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [result, setResult] = useState<QuestionResult | null>(null)
  const [survivors, setSurvivors] = useState<PlayerView[]>([])
  const [eliminated, setEliminated] = useState<PlayerView[]>([])
  const [allPlayers, setAllPlayers] = useState<PlayerView[]>([])
  /** Whether THIS player has been eliminated */
  const [isEliminated, setIsEliminated] = useState(false)
  const playerIdRef = useRef<string>('')

  // Selected avatar overrides state
  const [customIconIndex, setCustomIconIndex] = useState<number | undefined>(undefined)
  const [customColorIndex, setCustomColorIndex] = useState<number | undefined>(undefined)

  useEffect(() => {
    setIsMounted(true)
    const saved = sessionStorage.getItem(`pk:${pin}`)
    if (!saved) {
      router.replace(`/play?pin=${pin}`)
      return
    }
    const { playerId, nickname: nick, avatarIconIndex, avatarColorIndex } = JSON.parse(saved) as { 
      playerId: string; 
      nickname: string;
      avatarIconIndex?: number;
      avatarColorIndex?: number;
    }
    playerIdRef.current = playerId
    setNickname(nick)
    
    if (avatarIconIndex !== undefined) setCustomIconIndex(avatarIconIndex)
    if (avatarColorIndex !== undefined) setCustomColorIndex(avatarColorIndex)


    const socket = getSocket()
    const rejoin = () =>
      socket.emit('player:join', { pin, nickname: nick, playerId }, (res) => {
        if (!res.ok) {
          toast.error(res.error ?? 'Mất kết nối phòng')
          router.replace(`/play?pin=${pin}`)
        } else if (res.playerId) {
          playerIdRef.current = res.playerId
        }
      })

    rejoin()
    socket.on('connect', rejoin)

    socket.on('game:question', (q) => {
      setQuestion(q)
      setSelected(null)
      setResult(null)
      setStatus('question')
    })
    socket.on('question:result', (r) => {
      setResult(r)
      // If eliminated this round via result payload
      if (r.you?.eliminated) {
        setIsEliminated(true)
        haptic([60, 40, 80])
      } else if (r.you?.correct) {
        haptic(30)
      }
      setStatus('result')
    })
    socket.on('player:eliminated', () => {
      setIsEliminated(true)
      haptic([60, 40, 80])
    })
    socket.on('lobby:update', (p) => {
      setAllPlayers(p.players)
      if (p.status === 'lobby') {
        setStatus('lobby')
        setQuestion(null)
        setSelected(null)
        setResult(null)
        setSurvivors([])
        setEliminated([])
        setIsEliminated(false)
      }
    })
    socket.on('game:over', (o) => {
      setSurvivors(o.survivors)
      setEliminated(o.eliminated)
      setAllPlayers([...o.survivors, ...o.eliminated])
      setStatus('ended')
    })

    return () => {
      socket.off('connect', rejoin)
      socket.off('game:question')
      socket.off('question:result')
      socket.off('player:eliminated')
      socket.off('lobby:update')
      socket.off('game:over')
    }
  }, [pin, router])

  function pick(answerId: number) {
    if (!question || selected !== null || isEliminated) return
    haptic(15)
    setSelected(answerId)
    getSocket().emit(
      'player:answer',
      { pin, questionIndex: question.index, answerId },
      (res) => {
        if (!res.ok) {
          toast.error(res.error ?? 'Không gửi được đáp án')
          setSelected(null)
        }
      }
    )
  }

  const isSurvivor = survivors.some((p) => p.id === playerIdRef.current)
  // Derive survivor list for spectator view (players not eliminated)
  const spectatorSurvivors = allPlayers.filter((p) => !p.eliminated)
  const spectatorEliminatedCount = allPlayers.filter((p) => p.eliminated).length

  return (
    <Backdrop>
      {/* ── Header ─────────────────────────────────────── */}
      <header className="relative z-10 border-b border-[rgba(0,191,255,0.15)] bg-transparent backdrop-blur-sm">
        {/* Logo strip centered */}
        <div className="flex flex-col items-center gap-1 px-5 py-2 text-center">
          <a
            href="https://bocongan.gov.vn/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Cục An Ninh Mạng và Phòng, Chống Tội Phạm Sử Dụng Công Nghệ Cao"
            className="inline-flex"
          >
            <PoliceEmblem
              className="h-7 w-7 shrink-0"
              style={{ filter: 'drop-shadow(0 0 6px rgba(200,150,12,0.5))' }}
            />
          </a>
          <p className="whitespace-pre-line text-center text-[0.4rem] font-medium leading-snug tracking-[0.08em] text-white">
            {`CỤC AN NINH MẠNG VÀ PHÒNG, CHỐNG\nTỘI PHẠM SỬ DỤNG CÔNG NGHỆ CAO`}
          </p>
        </div>
        {/* Player status row */}
        <div className="flex items-center justify-between border-t border-[rgba(0,212,255,0.1)] px-5 py-1.5">
          <div className="flex items-center gap-2">
            <PlayerAvatar nickname={nickname} size="xs" pulse={!isEliminated} eliminated={isEliminated} iconIndex={customIconIndex} colorIndex={customColorIndex} />
            <span className="font-semibold text-xs">{nickname}</span>
          </div>
          <div className="flex items-center gap-2">
            {isEliminated && status !== 'ended' && (
              <span className="flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-400">
                Khán giả
              </span>
            )}
            {!isEliminated && (
              <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                <ShieldCheck className="size-2.5" />
                Đang chơi
              </span>
            )}
            <ConnectionDot label={false} />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-6 px-5 py-8">
        {!isMounted ? (
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="hud-frame-quad relative flex flex-col items-center gap-3 rounded-2xl px-10 py-8">
              <span className="hud-corner-tr" aria-hidden />
              <span className="hud-corner-bl" aria-hidden />
              <Hourglass className="size-8 text-[var(--cyan-accent)] animate-pulse" />
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                Game PIN
              </p>
              <span className="pin-display text-4xl font-bold text-[var(--cyan-accent)] neon-text-cyan">
                {formatPin(pin)}
              </span>
              <p className="text-sm text-[var(--muted-foreground)]">Đã vào phòng — chờ host bắt đầu…</p>
            </div>
            <PlayerAvatar nickname={nickname} size="xl" pulse iconIndex={customIconIndex} colorIndex={customColorIndex} />
            <p className="text-base font-semibold">{nickname}</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">

          {/* ── Lobby ────────────────────────────────────── */}
          {status === 'lobby' && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
              className="flex flex-col items-center gap-6 text-center"
            >
              {/* HUD frame around PIN */}
              <div className="hud-frame-quad relative flex flex-col items-center gap-3 rounded-2xl px-10 py-8">
                <span className="hud-corner-tr" aria-hidden />
                <span className="hud-corner-bl" aria-hidden />
                <Hourglass className="size-8 text-[var(--cyan-accent)] animate-pulse" />
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                  Game PIN
                </p>
                <span className="pin-display text-4xl font-bold text-[var(--cyan-accent)] neon-text-cyan">
                  {pin}
                </span>
                <p className="text-sm text-[var(--muted-foreground)]">Đã vào phòng — chờ host bắt đầu…</p>
              </div>

              <PlayerAvatar nickname={nickname} size="xl" pulse iconIndex={customIconIndex} colorIndex={customColorIndex} />
              <p className="text-base font-semibold">{nickname}</p>
            </motion.div>
          )}

          {/* ── Question ─────────────────────────────────── */}
          {status === 'question' && question && (
            <motion.div
              key={`q-${question.index}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
              className="flex flex-col gap-5"
            >
              {/* Question counter + timer — no progress dots (open-ended game) */}
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full border border-[rgba(0,212,255,0.2)] bg-[rgba(0,212,255,0.06)] px-3 py-1 text-xs font-mono font-semibold text-[var(--muted-foreground)]">
                  Câu {question.index + 1}
                </span>
                <Timer endsAt={question.endsAt} timeLimitSec={question.timeLimitSec} />
              </div>

              {/* Question text */}
              <motion.h2
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                className="text-center text-xl font-bold leading-snug"
              >
                {question.text}
              </motion.h2>

              {/* Spectator or Answer area */}
              {isEliminated ? (
                <SpectatorView
                  survivors={spectatorSurvivors}
                  eliminatedCount={spectatorEliminatedCount}
                  question={question}
                  allPlayers={allPlayers}
                />
              ) : selected === null ? (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.18, duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                >
                  <AnswerGrid answers={question.answers} mode="play" selected={selected} onPick={pick} />
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                  className="flex flex-col items-center gap-4 py-8 text-center"
                >
                  <div className="relative">
                    <CheckCircle2 className="size-16 text-[var(--cyan-accent)] animate-correct-flash" />
                    <div className="absolute inset-0 rounded-full bg-[var(--cyan-accent)]/10 animate-ping" style={{ animationDuration: '1.2s' }} />
                  </div>
                  <p className="text-xl font-bold text-[var(--cyan-accent)] neon-text-cyan">Đã chọn!</p>
                  <p className="text-sm text-[var(--muted-foreground)]">Chờ người khác trả lời…</p>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ── Result ───────────────────────────────────── */}
          {status === 'result' && result && (
            <motion.div
              key={`result-${result.questionIndex}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
              className="flex flex-col items-center gap-5 text-center"
            >
              {result.you?.eliminated ? (
                /* Eliminated THIS round */
                <>
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 22 }}
                    className="cyber-media-card cyber-media-card-danger px-8 py-6 rounded-2xl flex flex-col items-center gap-3 w-full"
                  >
                    <XCircle className="size-16 text-rose-500" />
                    <p className="text-2xl font-bold uppercase tracking-wider text-rose-400">HỆ THỐNG NGẮT KẾT NỐI</p>
                    <p className="text-xs text-rose-300/80 uppercase tracking-widest font-bold">Đặc vụ đã bị loại</p>
                  </motion.div>
                  <p className="text-sm text-[var(--muted-foreground)] mt-2">
                    {result.you.answered ? 'Bạn đã trả lời sai.' : 'Hết giờ — bạn chưa trả lời.'}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)] opacity-70 mt-1">
                    Bạn sẽ tiếp tục theo dõi với tư cách khán giả.
                  </p>

                  {/* Show remaining players */}
                  {spectatorSurvivors.length > 0 && (
                    <div className="w-full mt-3">
                      <SpectatorView
                        survivors={spectatorSurvivors}
                        eliminatedCount={spectatorEliminatedCount}
                        question={null}
                        allPlayers={allPlayers}
                      />
                    </div>
                  )}
                </>
              ) : isEliminated ? (
                /* Already eliminated in a previous round */
                <>
                  <SpectatorView
                    survivors={spectatorSurvivors}
                    eliminatedCount={spectatorEliminatedCount}
                    question={null}
                    allPlayers={allPlayers}
                  />
                  <p className="text-xs text-[var(--muted-foreground)] mt-2">Chờ host sang câu tiếp…</p>
                </>
              ) : (
                /* Correct! */
                <>
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  >
                    <CheckCircle2
                      className="size-20 text-emerald-400"
                      style={{ filter: 'drop-shadow(0 0 20px rgba(0,230,118,0.7))' }}
                    />
                  </motion.div>
                  <p className="text-3xl font-bold text-emerald-400 tracking-tight">Chính xác!</p>
                  <p className="text-sm text-[var(--muted-foreground)]">Bạn tiếp tục vào vòng sau.</p>
                  <p className="text-xs text-[var(--muted-foreground)] opacity-60">Chờ host sang câu tiếp…</p>
                </>
              )}
            </motion.div>
          )}

          {/* ── Ended ────────────────────────────────────── */}
          {status === 'ended' && (
            <motion.div
              key="ended"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
              className="flex flex-col items-center gap-6 text-center"
            >
              <p className="text-display text-4xl font-bold neon-text-white">Kết thúc!</p>

              {isSurvivor ? (
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 22 }}
                  className="hud-frame-quad relative w-full rounded-2xl px-8 py-7"
                  style={{ background: 'rgba(0,212,255,0.06)' }}
                >
                  <span className="hud-corner-tr" aria-hidden />
                  <span className="hud-corner-bl" aria-hidden />
                  <Trophy
                    className="mx-auto mb-3 size-14 text-[var(--cyan-accent)]"
                    style={{ filter: 'drop-shadow(0 0 20px rgba(0,212,255,0.8))' }}
                  />
                  <p className="text-2xl font-bold text-[var(--cyan-accent)] neon-text-cyan">
                    Bạn đã chiến thắng!
                  </p>
                  <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                    Bạn là người sống sót cuối cùng 🎉
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 22 }}
                  className="w-full rounded-2xl border border-red-500/25 bg-red-500/8 px-8 py-6"
                >
                  <Frown className="mx-auto mb-3 size-12 text-red-400" />
                  <p className="text-2xl font-bold text-red-400">Bạn đã bị loại</p>
                  {survivors.length > 0 && (
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      {survivors.map((p) => (
                        <div key={p.id} className="flex items-center gap-1.5 rounded-full border border-[var(--cyan-accent)]/30 bg-[var(--cyan-accent)]/10 px-3 py-1">
                          <PlayerAvatar nickname={p.nickname} size="xs" />
                          <span className="text-xs font-bold text-[var(--cyan-accent)]">{p.nickname}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              <Button onClick={() => router.push('/')}>Về trang chủ</Button>
            </motion.div>
          )}

        </AnimatePresence>
        )}
      </main>
    </Backdrop>
  )
}
