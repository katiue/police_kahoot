'use client'
import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { Backdrop } from '@/components/game/Backdrop'
import { Button } from '@/components/ui/button'
import { Timer } from '@/components/game/Timer'
import { AnswerGrid } from '@/components/game/AnswerGrid'
import { LobbyHero } from '@/components/game/LobbyHero'
import { PlayerStatus } from '@/components/game/Leaderboard'
import { PlayerAvatar } from '@/components/game/PlayerAvatar'
import { ConnectionDot } from '@/components/game/ConnectionDot'
import { PlayerCount } from '@/components/game/PlayerCount'
import { HostAuthCard, HOST_LOGIN_STORAGE_KEY } from '@/components/auth/HostAuthCard'
import { getSocket } from '@/lib/socket-client'
import { formatPin } from '@/lib/utils'
import type {
  GameStatus,
  HostSnapshot,
  PlayerView,
  PublicQuestion,
  QuestionResult,
} from '@/types/events'
import { Play, SkipForward, Square, Users, ShieldOff, Trophy, RefreshCw } from 'lucide-react'

export default function HostRoomPage({ params }: { params: Promise<{ pin: string }> }) {
  const { pin } = use(params)
  const router = useRouter()
  const [isMounted, setIsMounted] = useState(false)

  const [status, setStatus] = useState<GameStatus>('lobby')
  const [players, setPlayers] = useState<PlayerView[]>([])
  const [question, setQuestion] = useState<PublicQuestion | null>(null)
  const [result, setResult] = useState<QuestionResult | null>(null)
  const [survivors, setSurvivors] = useState<PlayerView[]>([])
  const [eliminated, setEliminated] = useState<PlayerView[]>([])
  const [joinUrl, setJoinUrl] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [authRequired, setAuthRequired] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [loginKey, setLoginKey] = useState('')
  const [minPlayersToEnd, setMinPlayersToEnd] = useState(1)
  const [progress, setProgress] = useState({ answered: 0, total: 0 })

  useEffect(() => {
    setIsMounted(true)
    setJoinUrl(`${window.location.origin}/play?pin=${pin}`)
    const savedLoginKey = sessionStorage.getItem(HOST_LOGIN_STORAGE_KEY) ?? ''
    setLoginKey(savedLoginKey)
    const socket = getSocket()

    const applySnapshot = (state: HostSnapshot) => {
      setStatus(state.status)
      setPlayers(state.players)
      setMinPlayersToEnd(state.minPlayersToEnd)
      setQuestion(state.question ?? null)
      setResult(state.result ?? null)
      if (state.ended) {
        setSurvivors(state.ended.survivors)
        setEliminated(state.ended.eliminated)
      } else {
        setSurvivors([])
        setEliminated([])
      }
      setProgress({ answered: 0, total: state.players.filter((p) => !p.eliminated).length })
    }

    const join = (key = sessionStorage.getItem(HOST_LOGIN_STORAGE_KEY) ?? '') =>
      socket.emit('host:join', { pin, loginKey: key }, (res) => {
        if (!res.ok) {
          if (res.error === 'Invalid login key') {
            sessionStorage.removeItem(HOST_LOGIN_STORAGE_KEY)
            setAuthRequired(true)
            setAuthError('')
            return
          }
          setNotFound(true)
          return
        }
        if (res.state) {
          setAuthRequired(false)
          applySnapshot(res.state)
        }
      })

    join(savedLoginKey)
    socket.on('connect', join)

    const onError = (p: { message: string }) => {
      toast.error(p.message)
      // Auth-expiry signal — reopen the login card so the host can recover.
      if (/LOGIN_KEY/i.test(p.message)) {
        sessionStorage.removeItem(HOST_LOGIN_STORAGE_KEY)
        setAuthRequired(true)
      }
    }
    socket.on('error:msg', onError)

    socket.on('lobby:update', (p) => {
      setPlayers(p.players)
      setStatus((s) => (s === 'lobby' ? p.status : s))
    })
    socket.on('game:question', (q) => {
      setQuestion(q)
      setResult(null)
      setProgress({ answered: 0, total: 0 })
      setStatus('question')
    })
    socket.on('question:progress', (p) => {
      setProgress({ answered: p.answered, total: p.total })
    })
    socket.on('question:result', (r) => {
      setResult(r)
      setStatus('result')
    })
    socket.on('game:over', (o) => {
      setSurvivors(o.survivors)
      setEliminated(o.eliminated)
      setStatus('ended')
    })

    return () => {
      socket.off('connect', join)
      socket.off('lobby:update')
      socket.off('game:question')
      socket.off('question:progress')
      socket.off('question:result')
      socket.off('game:over')
      socket.off('error:msg', onError)
    }
  }, [pin])

  function submitHostLogin() {
    setAuthBusy(true)
    setAuthError('')
    getSocket().emit('host:join', { pin, loginKey }, (res) => {
      setAuthBusy(false)
      if (!res.ok) {
        if (res.error === 'Invalid login key') {
          sessionStorage.removeItem(HOST_LOGIN_STORAGE_KEY)
          setAuthRequired(true)
          setAuthError('LOGIN_KEY không đúng')
          return
        }
        setNotFound(true)
        return
      }
      if (res.state) {
        sessionStorage.setItem(HOST_LOGIN_STORAGE_KEY, loginKey)
        setAuthRequired(false)
        setAuthError('')
        setStatus(res.state.status)
        setPlayers(res.state.players)
        setMinPlayersToEnd(res.state.minPlayersToEnd)
        setQuestion(res.state.question ?? null)
        setResult(res.state.result ?? null)
        setSurvivors(res.state.ended?.survivors ?? [])
        setEliminated(res.state.ended?.eliminated ?? [])
      }
    })
  }

  // Derive active/eliminated from current player list
  const activePlayers = players.filter((p) => !p.eliminated)
  const eliminatedPlayers = players.filter((p) => p.eliminated)
  const isLast = question ? question.index >= question.total - 1 : false

  if (notFound) {
    return (
      <Backdrop>
        <main className="flex flex-1 flex-col items-center justify-center gap-4">
          <p className="text-xl">
            Phòng <span className="pin-display text-[var(--accent)]">{formatPin(pin)}</span> không tồn tại.
          </p>
          <Button onClick={() => router.push('/host')}>Tạo phòng mới</Button>
        </main>
      </Backdrop>
    )
  }

  return (
    <Backdrop>
      {authRequired && (
        <HostAuthCard
          loginKey={loginKey}
          busy={authBusy}
          error={authError}
          onChange={(value) => {
            setLoginKey(value)
            setAuthError('')
          }}
          onSubmit={submitHostLogin}
        />
      )}
      {/* ── Header ─────────────────────────────────────── */}
      {status !== 'lobby' && (
        <header className="relative z-10 border-b border-[rgba(0,191,255,0.15)] bg-transparent backdrop-blur-sm">
          {/* Stats row */}
          <div className="flex items-center justify-between px-6 py-2">
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <Users className="size-3.5" />
                {activePlayers.length} còn lại
              </span>
              {eliminatedPlayers.length > 0 && (
                <span className="flex items-center gap-1.5 text-red-400 text-xs">
                  <ShieldOff className="size-3.5" />
                  {eliminatedPlayers.length} bị loại
                </span>
              )}
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">PIN</span>
              <span className="pin-display text-lg font-bold text-[var(--accent)] neon-text-cyan">{formatPin(pin)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`text-[10px] ${
                  minPlayersToEnd > activePlayers.length
                    ? 'text-amber-400'
                    : 'text-[var(--muted-foreground)]'
                }`}
                title={
                  minPlayersToEnd > activePlayers.length
                    ? `Ngưỡng (${minPlayersToEnd}) > người chơi hiện tại (${activePlayers.length})`
                    : undefined
                }
              >
                Kết thúc khi ≤{minPlayersToEnd}
              </span>
              <ConnectionDot label={false} />
            </div>
          </div>
        </header>
      )}

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
        {!isMounted ? (
          <div className="flex flex-1 flex-col items-center justify-center">
            <LobbyHero pin={pin} joinUrl={joinUrl} connecting />
          </div>
        ) : (
          <AnimatePresence mode="wait">

          {/* ── Lobby ──────────────────────────────────── */}
          {status === 'lobby' && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
              className="flex flex-1 flex-col items-center justify-center gap-6"
            >
              <LobbyHero pin={pin} joinUrl={joinUrl} showQr />

              <a
                href={`/lobby?pin=${pin}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs uppercase tracking-widest text-[var(--muted-foreground)] underline-offset-4 hover:text-[var(--accent)] hover:underline transition-colors"
              >
                Mở màn hình chờ (projector) →
              </a>

              {/* Player grid — capped + scrollable for big rooms */}
              <div className="w-full max-w-2xl">
                {players.length === 0 ? (
                  <p className="text-center text-[var(--muted-foreground)]">Đang chờ người chơi tham gia...</p>
                ) : (
                  <>
                    <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                      <span>Người chơi đã vào</span>
                      <span className="text-[var(--accent)]">{players.length}</span>
                    </div>
                    <div className="max-h-[40vh] overflow-y-auto rounded-xl border border-[rgba(0,212,255,0.08)] bg-[rgba(2,8,23,0.4)] p-2">
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                        {/*
                          Perf cap: large rooms drop the pulse animation +
                          entry spring (200+ avatars killed CPU). Visible
                          roster also caps to LOBBY_VISIBLE_CAP — overflow
                          shows a "+N" chip.
                        */}
                        {(() => {
                          const LOBBY_VISIBLE_CAP = 80
                          const heavy = players.length > 40
                          const visible = players.slice(0, LOBBY_VISIBLE_CAP)
                          const overflow = players.length - visible.length
                          return (
                            <>
                              <AnimatePresence initial={false}>
                                {visible.map((p, i) =>
                                  heavy ? (
                                    <div
                                      key={p.id}
                                      className="flex flex-col items-center gap-1.5 rounded-xl border border-[rgba(0,212,255,0.15)] bg-[rgba(6,24,48,0.8)] px-2 py-3"
                                    >
                                      <PlayerAvatar nickname={p.nickname} size="sm" />
                                      <span className="w-full truncate text-center text-[10px] font-semibold">{p.nickname}</span>
                                    </div>
                                  ) : (
                                    <motion.div
                                      key={p.id}
                                      initial={{ opacity: 0, scale: 0.7 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      transition={{ type: 'spring', stiffness: 400, damping: 28, delay: Math.min(i, 20) * 0.02 }}
                                      className="flex flex-col items-center gap-1.5 rounded-xl border border-[rgba(0,212,255,0.15)] bg-[rgba(6,24,48,0.8)] px-2 py-3"
                                    >
                                      <PlayerAvatar nickname={p.nickname} size="sm" pulse />
                                      <span className="w-full truncate text-center text-[10px] font-semibold">{p.nickname}</span>
                                    </motion.div>
                                  )
                                )}
                              </AnimatePresence>
                              {overflow > 0 && (
                                <div className="flex items-center justify-center rounded-xl border border-accent/30 bg-accent/10 px-2 py-3 text-xs font-bold text-accent">
                                  +{overflow}
                                </div>
                              )}
                            </>
                          )
                        })()}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <Button
                size="xl"
                onClick={() => getSocket().emit('host:start', { pin, loginKey })}
                className="gap-2"
              >
                <Play className="size-6" /> Bắt đầu
              </Button>
            </motion.div>
          )}

          {/* ── Question ───────────────────────────────── */}
          {status === 'question' && question && (
            <motion.div
              key={`q-${question.index}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
              className="flex flex-1 flex-col gap-6"
            >
              {/* Question header — no progress dots (open-ended game) */}
              <div className="flex items-center justify-between gap-4">
                <span className="q-counter rounded-full border border-[rgba(0,212,255,0.2)] bg-[rgba(0,212,255,0.06)] px-3 py-1 text-xs font-mono font-semibold text-[var(--muted-foreground)]">
                  Câu {question.index + 1}
                </span>
                <Timer endsAt={question.endsAt} timeLimitSec={question.timeLimitSec} />
              </div>

              <h2 className="text-display text-center text-3xl font-bold sm:text-4xl">{question.text}</h2>
              <AnswerGrid answers={question.answers} mode="play" disabled />

              {/* Live answered / total */}
              <div className="flex flex-col items-center gap-3">
                <PlayerCount
                  answered={progress.answered}
                  total={progress.total || activePlayers.length}
                  variant="host"
                />
                {eliminatedPlayers.length > 0 && (
                  <span className="text-[10px] uppercase tracking-widest text-red-400/70">
                    {eliminatedPlayers.length} khán giả
                  </span>
                )}
              </div>

              {/* Compact player grid */}
              <PlayerStatus players={players} />
            </motion.div>
          )}

          {/* ── Result ─────────────────────────────────── */}
          {status === 'result' && result && question && (
            <motion.div
              key={`result-${result.questionIndex}`}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
              className="flex flex-1 flex-col gap-6"
            >
              <h2 className="text-display text-center text-2xl font-bold">{question.text}</h2>

              <AnswerGrid
                answers={question.answers}
                mode="reveal"
                correctId={result.correctAnswerId}
                counts={result.counts}
              />

              {/* Two-column: eliminated | survivors */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Eliminated this round */}
                {result.eliminatedIds.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15, duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                    className="rounded-xl border border-red-500/30 bg-red-500/8 px-5 py-4"
                  >
                    <p className="mb-3 text-sm font-bold text-red-400 flex items-center gap-1.5">
                      <ShieldOff className="size-4" />
                      Bị loại vòng này ({result.eliminatedIds.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {result.eliminatedIds.map((id) => {
                        const p = players.find((pl) => pl.id === id)
                        return p ? (
                          <motion.div
                            key={id}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                            className="flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1"
                          >
                            <PlayerAvatar nickname={p.nickname} size="xs" eliminated />
                            <span className="text-sm text-red-300">{p.nickname}</span>
                          </motion.div>
                        ) : null
                      })}
                    </div>
                  </motion.div>
                )}

                {/* Active survivors */}
                <motion.div
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2, duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                  className="rounded-xl border border-emerald-500/30 bg-emerald-500/8 px-5 py-4"
                >
                  <p className="mb-3 text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                    Còn lại ({activePlayers.length})
                  </p>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                    {activePlayers.map((p, i) => (
                      <motion.div
                        key={p.id}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: i * 0.03, type: 'spring', stiffness: 380, damping: 28 }}
                        className="flex flex-col items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-1.5 py-2"
                      >
                        <PlayerAvatar nickname={p.nickname} size="xs" pulse />
                        <span className="w-full truncate text-center text-[10px] font-semibold text-emerald-300">
                          {p.nickname}
                        </span>
                      </motion.div>
                    ))}
                    {activePlayers.length === 0 && (
                      <span className="col-span-full text-sm text-[var(--muted-foreground)]">
                        Tất cả đã bị loại!
                      </span>
                    )}
                  </div>
                </motion.div>
              </div>

              <div className="flex justify-center">
                <Button
                  size="xl"
                  onClick={() => getSocket().emit('host:next', { pin, loginKey })}
                  className="gap-2"
                >
                  {isLast ? <Square className="size-5" /> : <SkipForward className="size-5" />}
                  {isLast ? 'Kết thúc' : 'Câu tiếp theo'}
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── Ended ──────────────────────────────────── */}
          {status === 'ended' && (
            <motion.div
              key="ended"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
              className="flex flex-1 flex-col items-center justify-center gap-8"
            >
              <Trophy
                className="size-16 text-[var(--cyan-accent)]"
                style={{ filter: 'drop-shadow(0 0 24px rgba(0,212,255,0.9))' }}
              />
              <h2 className="text-display text-4xl font-bold neon-text-white">Kết quả cuối</h2>

              <div className="flex w-full max-w-3xl flex-col gap-4">
                {/* Winners */}
                {survivors.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                    className="hud-frame-quad relative rounded-2xl px-6 py-6"
                    style={{ background: 'rgba(0,212,255,0.05)' }}
                  >
                    <span className="hud-corner-tr" aria-hidden />
                    <span className="hud-corner-bl" aria-hidden />
                    <p className="mb-4 text-lg font-bold text-[var(--accent)] flex items-center gap-2">
                      <Trophy className="size-5" />
                      Người chiến thắng ({survivors.length})
                    </p>
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                      {survivors.map((p, i) => (
                        <motion.div
                          key={p.id}
                          initial={{ scale: 0.7, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: 0.15 + i * 0.06, type: 'spring', stiffness: 350, damping: 24 }}
                          className="flex flex-col items-center gap-2 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/8 px-2 py-3"
                        >
                          <PlayerAvatar nickname={p.nickname} size="md" pulse />
                          <span className="w-full truncate text-center text-xs font-bold text-[var(--accent)]">
                            {p.nickname}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {survivors.length === 0 && (
                  <div className="rounded-xl border border-orange-500/40 bg-orange-500/8 px-6 py-5 text-center">
                    <p className="text-lg font-bold text-orange-400">Không có người chiến thắng</p>
                    <p className="text-sm text-[var(--muted-foreground)]">Tất cả đã bị loại!</p>
                  </div>
                )}

                {/* Eliminated list (compact) */}
                {eliminated.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.35 }}
                    className="rounded-xl border border-red-500/15 bg-red-500/5 px-6 py-5"
                  >
                    <p className="mb-3 text-sm font-bold text-red-400">
                      Đã bị loại ({eliminated.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {eliminated.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/8 px-2.5 py-1"
                        >
                          <PlayerAvatar nickname={p.nickname} size="xs" eliminated />
                          <span className="text-xs font-medium text-red-300/70">{p.nickname}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button
                  size="lg"
                  variant="accent"
                  className="gap-2"
                  onClick={() => {
                    getSocket().emit('host:reset', { pin, loginKey }, (res) => {
                      if (!res?.ok) return
                      setStatus('lobby')
                      setQuestion(null)
                      setResult(null)
                      setSurvivors([])
                      setEliminated([])
                      setProgress({ answered: 0, total: 0 })
                    })
                  }}
                >
                  <RefreshCw className="size-5" />
                  Trận mới (giữ PIN)
                </Button>
                <Button size="lg" variant="outline" onClick={() => router.push('/host')}>
                  Tạo phòng khác
                </Button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
        )}
      </main>
    </Backdrop>
  )
}
