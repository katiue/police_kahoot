'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Backdrop } from '@/components/game/Backdrop'
import { QrPanel } from '@/components/game/QrPanel'
import { PoliceBranding } from '@/components/game/PoliceEmblem'
import { Timer } from '@/components/game/Timer'
import { AnswerGrid } from '@/components/game/AnswerGrid'
import { PlayerAvatar } from '@/components/game/PlayerAvatar'
import { PlayerCount } from '@/components/game/PlayerCount'
import { ErrorBoundary } from '@/components/game/ErrorBoundary'
import { getSocket } from '@/lib/socket-client'
import type {
    GameStatus,
    PlayerView,
    ProjectorSnapshot,
    PublicQuestion,
    QuestionResult,
    LeaderboardEntry,
} from '@/types/events'
import { Trophy, Users, ShieldOff, Zap } from 'lucide-react'

const MARQUEE_ITEMS = [
    'BỨC TƯỜNG AN NINH MẠNG',
    'SINH VIÊN THỜI ĐẠI SỐ',
    'BỨC TƯỜNG AN NINH MẠNG',
    'SINH VIÊN THỜI ĐẠI SỐ',
]

const MARQUEE_SEQUENCE = [
    ...MARQUEE_ITEMS,
    ...MARQUEE_ITEMS,
    ...MARQUEE_ITEMS,
    ...MARQUEE_ITEMS,
]

/** Cap visible lobby avatars on the projector; large rooms show "+N" chip. */
const LOBBY_AVATAR_CAP = 60

function ProjectorView() {
    const search = useSearchParams()
    const urlPin = (search.get('pin') || '').trim().toUpperCase().slice(0, 32)

    const [pin, setPin] = useState(urlPin)
    const [joinUrl, setJoinUrl] = useState('')
    const [status, setStatus] = useState<GameStatus>('lobby')
    const [players, setPlayers] = useState<PlayerView[]>([])
    const [question, setQuestion] = useState<PublicQuestion | null>(null)
    const [result, setResult] = useState<QuestionResult | null>(null)
    const [survivors, setSurvivors] = useState<PlayerView[]>([])
    const [eliminated, setEliminated] = useState<PlayerView[]>([])
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
    const [kahootMode, setKahootMode] = useState(false)
    const [progress, setProgress] = useState({ answered: 0, total: 0 })
    const [connectionLost, setConnectionLost] = useState(false)

    useEffect(() => {
        setJoinUrl(`${window.location.origin}/play`)
    }, [])

    // Subscribe as a PUBLIC projector — no auth. The server resolves the single
    // active room when no PIN is supplied, so the pre-shared passcode is never
    // exposed to this open screen. Retries until a room exists.
    useEffect(() => {
        const socket = getSocket()
        let active = true
        let retry: ReturnType<typeof setTimeout> | null = null

        const subscribe = () => {
            socket.emit('projector:join', { pin: urlPin || undefined }, (res) => {
                if (!active) return
                if (!res.ok || !res.state) {
                    retry = setTimeout(subscribe, 3000)
                    return
                }
                applySnapshot(res.state)
            })
        }

        const applySnapshot = (snap: ProjectorSnapshot) => {
            setPin(snap.pin)
            setStatus(snap.status)
            setPlayers(snap.players)
            setKahootMode(snap.kahootMode ?? false)
            setLeaderboard(snap.leaderboard ?? [])
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
            setKahootMode(!!q.kahootRound)
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
        const onLeaderboard = (p: { entries: LeaderboardEntry[] }) => {
            setLeaderboard(p.entries)
        }

        if (socket.connected) subscribe()
        socket.on('connect', onConnect)
        socket.on('disconnect', onDisconnect)
        socket.on('lobby:update', onLobby)
        socket.on('game:question', onQuestion)
        socket.on('question:progress', onProgress)
        socket.on('question:result', onResult)
        socket.on('leaderboard:update', onLeaderboard)
        socket.on('game:over', onOver)

        return () => {
            active = false
            if (retry) clearTimeout(retry)
            socket.off('connect', onConnect)
            socket.off('disconnect', onDisconnect)
            socket.off('lobby:update', onLobby)
            socket.off('game:question', onQuestion)
            socket.off('question:progress', onProgress)
            socket.off('question:result', onResult)
            socket.off('leaderboard:update', onLeaderboard)
            socket.off('game:over', onOver)
        }
        // We deliberately don't depend on `players` here — the handler reads from
        // the latest closure each event tick; depending on it would re-subscribe
        // on every player join and break the room subscription.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [urlPin])

    const activePlayers = players.filter((p) => !p.eliminated)
    const visibleLobby = players.slice(0, LOBBY_AVATAR_CAP)
    const hiddenLobby = players.length - visibleLobby.length
    const topLeaders = leaderboard.slice(0, 3)

    return (
        <Backdrop className="lobby-root fixed inset-0 min-h-0 select-none overflow-hidden">
            {/* Top bar */}
            <header className="relative z-10 border-b border-[rgba(0,191,255,0.15)] bg-transparent backdrop-blur-sm">
                <div className="relative mx-auto flex w-full max-w-7xl items-center justify-center px-8 py-4">
                    <PoliceBranding />
                    {pin && (
                        <span className="absolute right-8 top-1/2 hidden -translate-y-1/2 items-center gap-2 text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground sm:inline-flex">
                            <motion.span
                                className="size-1.5 rounded-full bg-accent"
                                animate={{ opacity: [0.3, 1, 0.3] }}
                                transition={{ duration: 1.6, repeat: Infinity }}
                            />
                            Projector online
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
            <section className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
                <AnimatePresence mode="wait">
                    {/* ── Lobby: QR + player roster ── */}
                    {status === 'lobby' && (
                        <motion.div
                            key="lobby"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
                            className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center gap-[clamp(1rem,2.2vh,1.65rem)] px-10 py-[clamp(1rem,2.5vh,2rem)] text-center"
                        >
                            <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                                Quét QR · nhập passcode đã nhận · trả lời đúng để sống sót
                            </p>
                            <h1 className="text-display whitespace-nowrap text-[clamp(4rem,5.2vw,7rem)] font-bold neon-text-white leading-[1.04]">
                                SINH VIÊN{' '}
                                <span className="text-accent neon-text-cyan font-light italic">THỜI ĐẠI SỐ</span>
                            </h1>

                            {pin ? (
                                <div className="flex flex-col items-center gap-4">
                                    {joinUrl && (
                                        <div className="flex items-center gap-6">
                                            <QrPanel joinUrl={joinUrl} size={280} />
                                            {/* <div className="text-left">
                                                <p className="text-xs uppercase tracking-widest text-muted-foreground">Vào chơi tại</p>
                                                <p className="text-display text-2xl font-bold">{joinUrl.replace(/^https?:\/\//, '')}</p>
                                                <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                                                    Nhập passcode ban tổ chức đã gửi trước để vào phòng.
                                                </p>
                                            </div> */}
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

                    {/* ── Result: reveal + audience scoreboard ── */}
                    {status === 'result' && result && question && (
                        <motion.div
                            key={`r-${result.questionIndex}`}
                            initial={{ opacity: 0, scale: 0.97 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
                            className="relative z-10 flex flex-1 flex-col gap-6 px-12 py-8"
                        >
                            <div className="flex items-center justify-between gap-4">
                                <span className="inline-flex items-center gap-2 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-4 py-1.5 text-sm font-bold text-yellow-300">
                                    {question.kahootRound || kahootMode ? (
                                        <>
                                            <Zap className="size-4" />
                                            Kahoot {question.kahootRound?.questionIndex ?? result.questionIndex + 1}/
                                            {question.kahootRound?.totalQuestions ?? 5} - Kết quả
                                        </>
                                    ) : (
                                        <>Kết quả câu {question.index + 1}</>
                                    )}
                                </span>
                                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                                    Đáp án đã được công bố
                                </span>
                            </div>

                            <h2 className="text-display text-center text-[2.6vw] font-bold leading-tight">
                                {question.text}
                            </h2>

                            <AnswerGrid
                                answers={question.answers}
                                mode="reveal"
                                correctId={result.correctAnswerId}
                                counts={result.counts}
                            />

                            {(() => {
                                const totalAnswers = Object.values(result.counts).reduce((sum, count) => sum + count, 0)
                                const correctCount = result.counts[result.correctAnswerId] ?? 0
                                const wrongCount = totalAnswers - correctCount
                                const correctPct = totalAnswers > 0 ? (correctCount / totalAnswers) * 100 : 0
                                const showKahootPodium = (question.kahootRound || kahootMode) && topLeaders.length > 0

                                return (
                                    <div className="flex flex-col gap-5">
                                        <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 px-5 py-4">
                                            <div className="flex min-w-24 items-center gap-2 text-emerald-400">
                                                <span className="size-2 rounded-full bg-emerald-400" />
                                                <span className="text-sm font-bold">{correctCount} đúng</span>
                                            </div>
                                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${correctPct}%` }}
                                                    transition={{ duration: 0.65, ease: [0.32, 0.72, 0, 1] }}
                                                    className="h-full rounded-full bg-emerald-400"
                                                />
                                            </div>
                                            <div className="flex min-w-24 items-center justify-end gap-2 text-red-400">
                                                <span className="text-sm font-bold">{wrongCount} sai</span>
                                                <span className="size-2 rounded-full bg-red-400" />
                                            </div>
                                        </div>

                                        {showKahootPodium ? (
                                            <div className="grid gap-3 md:grid-cols-3">
                                                {topLeaders.map((entry, index) => (
                                                    <motion.div
                                                        key={entry.id}
                                                        initial={{ opacity: 0, y: 14, scale: 0.94 }}
                                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                                        transition={{ delay: index * 0.08, type: 'spring', stiffness: 360, damping: 28 }}
                                                        className={[
                                                            'flex min-h-36 flex-col items-center justify-center gap-2 rounded-xl border px-4 py-4 text-center',
                                                            index === 0
                                                                ? 'border-yellow-400/35 bg-yellow-400/10'
                                                                : index === 1
                                                                    ? 'border-slate-300/25 bg-slate-300/8'
                                                                    : 'border-amber-500/25 bg-amber-500/8',
                                                        ].join(' ')}
                                                    >
                                                        <span className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
                                                            Hạng {entry.rank}
                                                        </span>
                                                        <PlayerAvatar nickname={entry.nickname} size={index === 0 ? 'lg' : 'md'} pulse={index === 0} />
                                                        <span className={index === 0 ? 'font-bold text-yellow-300' : 'font-bold text-white'}>
                                                            {entry.nickname}
                                                        </span>
                                                        <span className="font-mono text-sm text-white/70">{entry.score.toLocaleString()} pts</span>
                                                        {entry.delta > 0 && (
                                                            <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-400">
                                                                +{entry.delta.toLocaleString()}
                                                            </span>
                                                        )}
                                                    </motion.div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-center gap-12 text-sm">
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
                                        )}
                                    </div>
                                )
                            })()}
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
                <div className="relative overflow-hidden py-2.5">
                    <div className="animate-marquee flex w-max text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
                        {[0, 1].map((group) => (
                            <div
                                key={group}
                                aria-hidden={group === 1}
                                className="flex shrink-0 items-center gap-10 pr-10"
                            >
                                {MARQUEE_SEQUENCE.map((item, i) => (
                                    <span key={`${group}-${i}`} className="flex shrink-0 items-center gap-10">
                                        {item}
                                        <span className="size-1 rounded-full bg-accent" style={{ boxShadow: '0 0 6px rgba(0,212,255,0.85)' }} />
                                    </span>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </footer>
        </Backdrop>
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
