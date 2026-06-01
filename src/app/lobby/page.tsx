'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { QrPanel } from '@/components/game/QrPanel'
import { PoliceEmblem } from '@/components/game/PoliceEmblem'
import { Timer } from '@/components/game/Timer'
import { AnswerGrid } from '@/components/game/AnswerGrid'
import { PlayerAvatar } from '@/components/game/PlayerAvatar'
import { PlayerCount } from '@/components/game/PlayerCount'
import { ErrorBoundary } from '@/components/game/ErrorBoundary'
import { getSocket } from '@/lib/socket-client'
import { formatPin } from '@/lib/utils'
import type {
  GameStatus,
  PlayerView,
  ProjectorSnapshot,
  PublicQuestion,
  QuestionResult,
} from '@/types/events'
import { Trophy, Users, ShieldOff } from 'lucide-react'

const MARQUEE_ITEMS = [
  'CỤC AN NINH MẠNG',
  'ANTI-SCAM',
  'DIGITAL TRUST',
  'RUNG CHUÔNG VÀNG',
  'EVENT EDITION',
  'ONLINE SAFETY',
  'CYBER AWARENESS',
]

/** Cap visible lobby avatars on the projector; large rooms show "+N" chip. */
const LOBBY_AVATAR_CAP = 60

function ProjectorView() {
  const search = useSearchParams()
  const urlPin = (search.get('pin') || '').trim().toUpperCase().slice(0, 12)

  const [pin, setPin] = useState(urlPin)
  const [joinUrl, setJoinUrl] = useState('')
  const [status, setStatus] = useState<GameStatus>('lobby')
  const [players, setPlayers] = useState<PlayerView[]>([])
  const [question, setQuestion] = useState<PublicQuestion | null>(null)
  const [result, setResult] = useState<QuestionResult | null>(null)
  const [survivors, setSurvivors] = useState<PlayerView[]>([])
  const [eliminated, setEliminated] = useState<PlayerView[]>([])
  const [progress, setProgress] = useState({ answered: 0, total: 0 })
  const [connectionLost, setConnectionLost] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const subscribedPin = useRef<string>('')

  // Resolve PIN: URL param first, else /api/active-room
  useEffect(() => {
    setIsMounted(true)
    if (urlPin) {
      setPin(urlPin)
      return
    }
    fetch('/api/active-room', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { pin?: string | null }) => {
        if (d?.pin) setPin(String(d.pin).toUpperCase())
      })
      .catch(() => {
        /* no-op — projector keeps showing standby until a PIN resolves */
      })
  }, [urlPin])

  // Build the player join URL when we have a PIN
  useEffect(() => {
    if (pin) setJoinUrl(`${window.location.origin}/play?pin=${pin}`)
  }, [pin])

  // Subscribe to the room as a projector and follow events
  useEffect(() => {
    if (!pin) return
    const socket = getSocket()

    const subscribe = () => {
      subscribedPin.current = pin
      socket.emit('projector:join', { pin }, (res) => {
        if (!res.ok || !res.state) return
        applySnapshot(res.state)
      })
    }

    const applySnapshot = (snap: ProjectorSnapshot) => {
      setStatus(snap.status)
      setPlayers(snap.players)
      setProgress({ answered: 0, total: snap.players.filter((p) => !p.eliminated).length })
      if (snap.question) setQuestion(snap.question)
      if (snap.result) setResult(snap.result)
      if (snap.ended) {
        setSurvivors(snap.ended.survivors)
        setEliminated(snap.ended.eliminated)
      }
    }

    const onConnect = () => {
      setConnectionLost(false)
      subscribe()
    }
    const onDisconnect = () => setConnectionLost(true)
    const onLobby = (p: { players: PlayerView[]; status: GameStatus }) => {
      setPlayers(p.players)
      setStatus(p.status)
    }
    const onQuestion = (q: PublicQuestion) => {
      setQuestion(q)
      setResult(null)
      setProgress({ answered: 0, total: players.filter((p) => !p.eliminated).length })
      setStatus('question')
    }
    const onProgress = (p: { questionIndex: number; answered: number; total: number }) => {
      setProgress({ answered: p.answered, total: p.total })
    }
    const onResult = (r: QuestionResult) => {
      setResult(r)
      setStatus('result')
    }
    const onOver = (o: { survivors: PlayerView[]; eliminated: PlayerView[] }) => {
      setSurvivors(o.survivors)
      setEliminated(o.eliminated)
      setStatus('ended')
    }

    if (socket.connected) subscribe()
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('lobby:update', onLobby)
    socket.on('game:question', onQuestion)
    socket.on('question:progress', onProgress)
    socket.on('question:result', onResult)
    socket.on('game:over', onOver)

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('lobby:update', onLobby)
      socket.off('game:question', onQuestion)
      socket.off('question:progress', onProgress)
      socket.off('question:result', onResult)
      socket.off('game:over', onOver)
    }
    // We deliberately don't depend on `players` here — the handler reads from
    // the latest closure each event tick; depending on it would re-subscribe
    // on every player join and break the room subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin])

  const activePlayers = players.filter((p) => !p.eliminated)
  const visibleLobby = players.slice(0, LOBBY_AVATAR_CAP)
  const hiddenLobby = players.length - visibleLobby.length

  return (
    <div className="lobby-root fixed inset-0 flex select-none flex-col overflow-hidden bg-background text-foreground">
      <div className="bg-glow pointer-events-none absolute inset-0 z-0" />
      <div className="grid-bg pointer-events-none absolute inset-0 z-0 opacity-80" />

      {/* Top bar */}
      <header className="relative z-10 border-b border-[rgba(0,191,255,0.15)] bg-transparent backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-8 py-3">
          <div className="flex flex-col items-center gap-1.5 text-center">
            <a
              href="https://bocongan.gov.vn/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Cục An Ninh Mạng và Phòng, Chống Tội Phạm Sử Dụng Công Nghệ Cao"
              className="inline-flex"
            >
              <PoliceEmblem className="h-9 w-9 shrink-0" />
            </a>
            <p className="whitespace-pre-line text-center text-[0.48rem] font-medium leading-snug tracking-[0.08em] text-white">
              {`CỤC AN NINH MẠNG VÀ PHÒNG, CHỐNG\nTỘI PHẠM SỬ DỤNG CÔNG NGHỆ CAO`}
            </p>
          </div>
          {pin && (
            <span className="hidden items-center gap-2 text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground sm:inline-flex">
              <motion.span
                className="size-1.5 rounded-full bg-accent"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.6, repeat: Infinity }}
              />
              Projector · PIN {formatPin(pin)}
            </span>
          )}
        </div>
      </header>

      {/* Connection lost overlay */}
      <AnimatePresence>
        {connectionLost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-x-0 top-14 z-30 flex justify-center"
          >
            <div className="rounded-full border border-amber-400/40 bg-amber-500/10 px-5 py-1.5 text-xs font-semibold uppercase tracking-widest text-amber-300">
              ⚠ Đang kết nối lại…
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Body — full game state */}
      <section className="relative z-10 flex flex-1 flex-col overflow-hidden">
        {isMounted &&
          status === 'lobby' &&
          Array.from({ length: 18 }).map((_, i) => (
            <motion.div
              key={i}
              className={`pointer-events-none absolute rounded-full ${i % 4 === 0 ? 'bg-accent' : 'bg-primary'}`}
              style={{
                width: i % 3 === 0 ? 3 : 2,
                height: i % 3 === 0 ? 3 : 2,
                left: `${(i * 53 + 7) % 100}%`,
                top: `${(i * 37 + 11) % 100}%`,
                opacity: 0,
              }}
              animate={{ y: [0, -50, 0], opacity: [0, 0.6, 0] }}
              transition={{ duration: 3 + (i % 4), repeat: Infinity, delay: i * 0.25, ease: 'easeInOut' }}
            />
          ))}

        <AnimatePresence mode="wait">
          {/* ── Lobby: PIN + QR + player roster ── */}
          {status === 'lobby' && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
              className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center"
            >
              <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                Quét QR · nhập PIN · trả lời đúng để sống sót
              </p>
              <h1 className="text-display text-[6vw] font-bold neon-text-white leading-none">
                RUNG CHUÔNG{' '}
                <span className="text-accent neon-text-cyan font-light italic">VÀNG</span>
              </h1>

              {pin ? (
                <div className="flex flex-col items-center gap-4">
                  <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Game PIN</span>
                  <span className="pin-display font-bold text-accent neon-text-cyan text-[14vw] sm:text-[12vw] lg:text-[10rem] leading-none">
                    {formatPin(pin)}
                  </span>
                  {joinUrl && (
                    <div className="flex items-center gap-6">
                      <QrPanel joinUrl={joinUrl} size={180} />
                      <div className="text-left">
                        <p className="text-xs uppercase tracking-widest text-muted-foreground">Vào chơi tại</p>
                        <p className="text-display text-2xl font-bold">{joinUrl.replace(/^https?:\/\//, '')}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Đang chờ phòng…</p>
              )}

              <div className="flex items-center gap-3 text-sm">
                <Users className="size-4 text-emerald-400" />
                <span className="text-emerald-400 font-bold">{players.length}</span>
                <span className="text-muted-foreground uppercase tracking-widest text-[10px]">đã vào</span>
              </div>

              {players.length > 0 && (
                <div className="grid w-full max-w-5xl grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-10">
                  {visibleLobby.map((p) => (
                    <div
                      key={p.id}
                      className="flex flex-col items-center gap-1 rounded-lg border border-[rgba(0,212,255,0.12)] bg-[rgba(6,24,48,0.6)] px-1.5 py-2"
                    >
                      <PlayerAvatar nickname={p.nickname} size="xs" pulse={players.length <= 40} />
                      <span className="w-full truncate text-center text-[9px] font-semibold">{p.nickname}</span>
                    </div>
                  ))}
                  {hiddenLobby > 0 && (
                    <div className="flex items-center justify-center rounded-lg border border-accent/30 bg-accent/10 px-1 text-xs font-bold text-accent">
                      +{hiddenLobby}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Question: huge text + tiles + live counter ── */}
          {status === 'question' && question && (
            <motion.div
              key={`q-${question.index}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
              className="relative z-10 flex flex-1 flex-col gap-6 px-12 py-8"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="rounded-full border border-[rgba(0,212,255,0.2)] bg-[rgba(0,212,255,0.06)] px-4 py-1.5 text-sm font-mono font-semibold text-muted-foreground">
                  Câu {question.index + 1}
                </span>
                <Timer endsAt={question.endsAt} timeLimitSec={question.timeLimitSec} />
              </div>

              <h2 className="text-display text-center text-[3.5vw] font-bold leading-tight">
                {question.text}
              </h2>

              <AnswerGrid answers={question.answers} mode="play" disabled />

              <div className="flex items-center justify-center pt-2">
                <PlayerCount answered={progress.answered} total={progress.total} variant="projector" />
              </div>
            </motion.div>
          )}

          {/* ── Result: reveal + survivors ── */}
          {status === 'result' && result && question && (
            <motion.div
              key={`r-${result.questionIndex}`}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
              className="relative z-10 flex flex-1 flex-col gap-6 px-12 py-8"
            >
              <h2 className="text-display text-center text-[2.6vw] font-bold leading-tight">
                {question.text}
              </h2>
              <AnswerGrid
                answers={question.answers}
                mode="reveal"
                correctId={result.correctAnswerId}
                counts={result.counts}
              />
              <div className="flex items-center justify-center gap-12 pt-2 text-sm">
                <span className="flex items-center gap-2 text-emerald-400 font-bold">
                  <span className="size-2 rounded-full bg-emerald-400" />
                  {activePlayers.length} còn lại
                </span>
                {result.eliminatedIds.length > 0 && (
                  <span className="flex items-center gap-2 text-red-400">
                    <ShieldOff className="size-4" />
                    {result.eliminatedIds.length} bị loại
                  </span>
                )}
              </div>
            </motion.div>
          )}

          {/* ── Ended: winners ── */}
          {status === 'ended' && (
            <motion.div
              key="ended"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
              className="relative z-10 flex flex-1 flex-col items-center justify-center gap-8 px-12"
            >
              <Trophy
                className="size-24 text-[var(--accent)]"
                style={{ filter: 'drop-shadow(0 0 32px rgba(0,212,255,0.9))' }}
              />
              <h2 className="text-display text-[5vw] font-bold neon-text-white">Kết quả cuối</h2>
              {survivors.length > 0 ? (
                <div className="flex flex-wrap items-center justify-center gap-4">
                  {survivors.map((p) => (
                    <div
                      key={p.id}
                      className="flex flex-col items-center gap-2 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3"
                    >
                      <PlayerAvatar nickname={p.nickname} size="lg" pulse />
                      <span className="font-bold text-accent">{p.nickname}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-lg text-orange-400">Không có người chiến thắng</p>
              )}
              {eliminated.length > 0 && (
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  {eliminated.length} đặc vụ bị loại
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* footer marquee */}
      <footer className="relative z-10 border-t border-[rgba(0,191,255,0.15)] bg-transparent backdrop-blur-sm">
        <div className="relative overflow-hidden py-3">
          <div className="animate-marquee flex w-max gap-8 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
              <span key={i} className="flex shrink-0 items-center gap-8">
                {item}
                <span className="size-1 rounded-full bg-accent" style={{ boxShadow: '0 0 6px rgba(0,212,255,0.85)' }} />
              </span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}

export default function LobbyPage() {
  return (
    <ErrorBoundary autoReloadMs={10000}>
      <Suspense fallback={null}>
        <ProjectorView />
      </Suspense>
    </ErrorBoundary>
  )
}
