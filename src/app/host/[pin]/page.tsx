'use client'
import { use, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { Backdrop } from '@/components/game/Backdrop'
import { Button, buttonVariants } from '@/components/ui/button'
import { Timer } from '@/components/game/Timer'
import { AnswerGrid } from '@/components/game/AnswerGrid'
import { LobbyHero } from '@/components/game/LobbyHero'
import { PlayerStatus } from '@/components/game/Leaderboard'
import { PlayerAvatar } from '@/components/game/PlayerAvatar'
import { ConnectionDot } from '@/components/game/ConnectionDot'
import { PlayerCount } from '@/components/game/PlayerCount'
import { ConfirmDialog } from '@/components/game/ConfirmDialog'
import { HostAuthCard, HOST_LOGIN_STORAGE_KEY } from '@/components/auth/HostAuthCard'
import { TopLeaderboard } from '@/components/game/TopLeaderboard'
import { getSocket } from '@/lib/socket-client'
import { cn, formatPin } from '@/lib/utils'
import type {
  GameStatus,
  HostSnapshot,
  HostNextPreview,
  PlayerView,
  PublicQuestion,
  QuestionResult,
  LeaderboardEntry,
} from '@/types/events'
import {
  Download,
  Eye,
  EyeOff,
  FileJson,
  Play,
  RefreshCw,
  Settings,
  ShieldOff,
  Shuffle,
  SkipForward,
  Square,
  Trophy,
  Users,
  UserX,
  Zap,
} from 'lucide-react'

// ── Kahoot announcement overlay ─────────────────────────────────
function KahootStartBanner({
  threshold,
  questionThreshold,
  survivors,
  onDismiss,
}: {
  threshold: number
  questionThreshold: number
  survivors: PlayerView[]
  onDismiss: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4500)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md"
      onClick={onDismiss}
    >
      <div
        className="relative mx-4 max-w-lg rounded-3xl border border-yellow-400/40 bg-gradient-to-br from-yellow-950/80 via-black/90 to-amber-950/60 p-8 text-center shadow-2xl"
        style={{ boxShadow: '0 0 60px rgba(250,204,21,0.25), inset 0 1px 0 rgba(250,204,21,0.15)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Animated lightning */}
        <motion.div
          animate={{ scale: [1, 1.15, 1], rotate: [-5, 5, -5, 0] }}
          transition={{ duration: 0.8, repeat: 2, ease: 'easeInOut' }}
          className="mb-4 flex justify-center"
        >
          <Zap className="size-16 text-yellow-400" style={{ filter: 'drop-shadow(0 0 24px rgba(250,204,21,0.8))' }} />
        </motion.div>

        <p className="mb-1 text-[10px] uppercase tracking-[0.3em] text-yellow-400/70">
          Chế độ tốc độ
        </p>
        <h2 className="text-3xl font-black uppercase tracking-tight text-yellow-300">
          ⚡ VÒNG KAHOOT!
        </h2>
        <p className="mt-2 text-base font-semibold text-white/80">
          Top <span className="font-black text-yellow-400">{threshold}</span> đặc vụ — 5 câu tốc độ
        </p>
        {questionThreshold > 0 && (
          <p className="mt-1 text-sm font-semibold text-yellow-300/90">
            Hoặc sau {questionThreshold} câu hỏi thường
          </p>
        )}
        <p className="mt-1 text-sm text-white/50">
          Không loại — điểm tốc độ quyết định thứ hạng
        </p>

        {survivors.length > 0 && (
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {survivors.slice(0, 10).map((p) => (
              <div key={p.id} className="flex items-center gap-1.5 rounded-full border border-yellow-400/25 bg-yellow-400/10 px-3 py-1">
                <PlayerAvatar nickname={p.nickname} size="xs" pulse />
                <span className="text-xs font-bold text-yellow-300">{p.nickname}</span>
              </div>
            ))}
            {survivors.length > 10 && (
              <span className="rounded-full border border-yellow-400/20 bg-yellow-400/8 px-3 py-1 text-xs font-bold text-yellow-400">
                +{survivors.length - 10}
              </span>
            )}
          </div>
        )}

        <p className="mt-5 text-[10px] text-white/30">Click để bỏ qua</p>
      </div>
    </motion.div>
  )
}

// ── Host-only: preview & reroll the upcoming question ───────────
function NextQuestionPreview({ pin, loginKey }: { pin: string; loginKey: string }) {
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<HostNextPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [swapping, setSwapping] = useState(false)

  const fetchPreview = useCallback(() => {
    setLoading(true)
    getSocket().emit('host:peek-next', { pin, loginKey }, (res) => {
      setLoading(false)
      if (res?.ok) setPreview(res.preview ?? null)
      else toast.error(res?.error ?? 'Không tải được câu hỏi tiếp theo')
    })
  }, [pin, loginKey])

  function reveal() {
    setOpen(true)
    fetchPreview()
  }

  function swap() {
    setSwapping(true)
    getSocket().emit('host:swap-next', { pin, loginKey }, (res) => {
      setSwapping(false)
      if (res?.ok) {
        setPreview(res.preview ?? null)
        toast.success('Đã đổi câu hỏi tiếp theo')
      } else {
        toast.error(res?.error ?? 'Không đổi được câu hỏi')
      }
    })
  }

  if (!open) {
    return (
      <div className="flex justify-center">
        <button
          type="button"
          onClick={reveal}
          className="inline-flex items-center gap-2 rounded-lg border border-[rgba(0,212,255,0.25)] bg-[rgba(0,212,255,0.06)] px-4 py-2 text-xs font-semibold uppercase tracking-widest text-[var(--accent)] transition-colors hover:bg-[rgba(0,212,255,0.12)]"
        >
          <Eye className="size-4" /> Xem trước câu tiếp theo
        </button>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      className="mx-auto w-full max-w-2xl rounded-2xl border border-[rgba(0,212,255,0.2)] bg-[rgba(2,8,23,0.6)] px-5 py-4"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
          <Eye className="size-3.5" />
          Câu hỏi tiếp theo
          {preview && (
            <span className="text-white/40">
              · {preview.isKahoot ? 'Kahoot ' : 'Câu '}
              {preview.index + 1}/{preview.total}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-white/40 transition-colors hover:text-white/70"
        >
          <EyeOff className="size-3.5" /> Ẩn
        </button>
      </div>

      {loading ? (
        <p className="py-6 text-center text-sm text-white/40">Đang tải...</p>
      ) : !preview ? (
        <p className="py-6 text-center text-sm text-white/40">Không còn câu hỏi tiếp theo.</p>
      ) : (
        <>
          <p className="mb-3 text-center text-lg font-bold text-white">{preview.text}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {preview.answers.map((a) => {
              const correct = a.id === preview.correctAnswerId
              return (
                <div
                  key={a.id}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
                    correct
                      ? 'border-emerald-500/50 bg-emerald-500/10 font-semibold text-emerald-300'
                      : 'border-white/10 bg-white/4 text-white/70'
                  )}
                >
                  {correct && <span className="size-1.5 shrink-0 rounded-full bg-emerald-400" />}
                  <span className="truncate">{a.text}</span>
                </div>
              )
            })}
          </div>
          <div className="mt-4 flex justify-center">
            <Button
              size="sm"
              variant="outline"
              onClick={swap}
              disabled={swapping}
              className="gap-2"
            >
              <Shuffle className="size-4" />
              {swapping ? 'Đang đổi...' : 'Đổi câu khác'}
            </Button>
          </div>
        </>
      )}
    </motion.div>
  )
}

// ── Main component ───────────────────────────────────────────────
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
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [joinUrl, setJoinUrl] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [authRequired, setAuthRequired] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [loginKey, setLoginKey] = useState('')
  const [minPlayersToEnd, setMinPlayersToEnd] = useState(1)
  const [kahootThreshold, setKahootThreshold] = useState(10)
  const [kahootQuestionThreshold, setKahootQuestionThreshold] = useState(20)
  const [kahootMode, setKahootMode] = useState(false)
  const [kahootBanner, setKahootBanner] = useState<{ threshold: number; questionThreshold: number; survivors: PlayerView[] } | null>(null)
  const [progress, setProgress] = useState({ answered: 0, total: 0 })
  const [confirmAction, setConfirmAction] = useState<'reset' | 'end' | 'kick' | null>(null)
  /** Player ids the host has ticked for removal in the lobby grid. */
  const [selectedKick, setSelectedKick] = useState<Set<string>>(new Set())

  useEffect(() => {
    setIsMounted(true)
    setJoinUrl(`${window.location.origin}/play`)
    const savedLoginKey = sessionStorage.getItem(HOST_LOGIN_STORAGE_KEY) ?? ''
    setLoginKey(savedLoginKey)
    const socket = getSocket()

    const applySnapshot = (state: HostSnapshot) => {
      setStatus(state.status)
      setPlayers(state.players)
      setMinPlayersToEnd(state.minPlayersToEnd)
      setKahootThreshold(state.kahootThreshold ?? 10)
      setKahootQuestionThreshold(state.kahootQuestionThreshold ?? 20)
      setKahootMode(state.kahootMode ?? false)
      setLeaderboard(state.leaderboard ?? [])
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
      if (q.kahootRound) setKahootMode(true)
    })
    socket.on('question:progress', (p) => {
      setProgress({ answered: p.answered, total: p.total })
    })
    socket.on('question:result', (r) => {
      setResult(r)
      setStatus('result')
    })
    socket.on('leaderboard:update', (p) => {
      setLeaderboard(p.entries)
    })
    socket.on('kahoot:start', (p) => {
      setKahootBanner({ threshold: p.threshold, questionThreshold: p.questionThreshold, survivors: p.survivors })
      setLeaderboard(p.leaderboard)
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
      socket.off('leaderboard:update')
      socket.off('kahoot:start')
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
        setKahootThreshold(res.state.kahootThreshold ?? 10)
        setKahootQuestionThreshold(res.state.kahootQuestionThreshold ?? 20)
        setKahootMode(res.state.kahootMode ?? false)
        setLeaderboard(res.state.leaderboard ?? [])
        setQuestion(res.state.question ?? null)
        setResult(res.state.result ?? null)
        setSurvivors(res.state.ended?.survivors ?? [])
        setEliminated(res.state.ended?.eliminated ?? [])
      }
    })
  }

  const activePlayers = players.filter((p) => !p.eliminated)
  const eliminatedPlayers = players.filter((p) => p.eliminated)
  const isLast = question ? (kahootMode ? question.kahootRound?.questionIndex === question.kahootRound?.totalQuestions : question.index >= question.total - 1) : false
  const showLeaderboardPanel = status !== 'lobby' && status !== 'ended'

  function resetLocalToLobby() {
    setStatus('lobby')
    setQuestion(null)
    setResult(null)
    setSurvivors([])
    setEliminated([])
    setProgress({ answered: 0, total: 0 })
    setLeaderboard([])
    setKahootMode(false)
    setKahootBanner(null)
  }

  function toggleKick(id: string) {
    setSelectedKick((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function startManualKahoot() {
    getSocket().emit('host:kahoot', { pin, loginKey }, (res) => {
      if (!res?.ok) {
        toast.error(res?.error ?? 'Không thể chuyển sang Kahoot')
        return
      }
      setKahootBanner(null)
    })
  }

  function confirmCurrentAction() {
    if (confirmAction === 'end') {
      getSocket().emit('host:end', { pin, loginKey })
    } else if (confirmAction === 'reset') {
      getSocket().emit('host:reset', { pin, loginKey }, (res) => {
        if (!res?.ok) return toast.error(res?.error ?? 'Reset thất bại')
        resetLocalToLobby()
      })
    } else if (confirmAction === 'kick') {
      const ids = [...selectedKick]
      getSocket().emit('host:kick', { pin, loginKey, playerIds: ids }, (res) => {
        if (!res?.ok) return toast.error(res?.error ?? 'Đuổi người chơi thất bại')
        toast.success(`Đã đuổi ${res.kicked ?? ids.length} người chơi`)
        setSelectedKick(new Set())
      })
    }
    setConfirmAction(null)
  }

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
      <ConfirmDialog
        open={confirmAction !== null}
        title={
          confirmAction === 'reset'
            ? 'Reset trận đấu?'
            : confirmAction === 'kick'
              ? `Đuổi ${selectedKick.size} người chơi?`
              : 'Kết thúc trận đấu?'
        }
        description={
          confirmAction === 'reset'
            ? 'Bạn chắc chắn? Reset sẽ xóa scores hiện tại, đưa tất cả người chơi về lobby và giữ nguyên PIN.'
            : confirmAction === 'kick'
              ? 'Người chơi được chọn sẽ bị đưa ra khỏi phòng ngay. Họ có thể tham gia lại khi phòng còn ở lobby.'
              : 'Bạn chắc chắn? Trận sẽ kết thúc ngay lập tức và màn hình kết quả sẽ được hiển thị.'
        }
        confirmLabel={confirmAction === 'reset' ? 'Reset trận' : confirmAction === 'kick' ? 'Đuổi' : 'Kết thúc'}
        destructive
        onCancel={() => setConfirmAction(null)}
        onConfirm={confirmCurrentAction}
      />

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

      {/* Kahoot start announcement overlay */}
      <AnimatePresence>
        {kahootBanner && (
          <KahootStartBanner
            threshold={kahootBanner.threshold}
            questionThreshold={kahootBanner.questionThreshold}
            survivors={kahootBanner.survivors}
            onDismiss={() => setKahootBanner(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Header ──────────────────────────────────────────────── */}
      {status !== 'lobby' && (
        <header className="relative z-10 border-b border-[rgba(0,191,255,0.15)] bg-transparent backdrop-blur-sm">
          <div className="flex items-center justify-between px-6 py-2">
            {/* Left: player counts */}
            <div className="flex items-center gap-4 text-sm">
              {kahootMode ? (
                <span className="flex items-center gap-1.5 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-0.5 text-xs font-bold text-yellow-400">
                  <Zap className="size-3" />
                  KAHOOT SPEED
                </span>
              ) : (
                <>
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
                </>
              )}
            </div>

            {/* Center: PIN */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">PIN</span>
              <span className="pin-display text-lg font-bold text-[var(--accent)] neon-text-cyan">{formatPin(pin)}</span>
            </div>

            {/* Right: controls */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setConfirmAction('end')}
                className="text-[10px] font-semibold uppercase tracking-widest text-red-400 transition-colors hover:text-red-300"
              >
                Kết thúc ngay
              </button>
              {!kahootMode && kahootThreshold > 0 && (
                <span className="text-[10px] text-yellow-400/60">
                  Kahoot ≤{kahootThreshold}
                </span>
              )}
              {!kahootMode && kahootQuestionThreshold > 0 && (
                <span className="text-[10px] text-yellow-400/60">
                  Kahoot ≥{kahootQuestionThreshold} câu
                </span>
              )}
              <ConnectionDot label={false} />
            </div>
          </div>
        </header>
      )}

      {/* ── Body ────────────────────────────────────────────────── */}
      <div className={cn(
        'flex flex-1 overflow-hidden',
        showLeaderboardPanel ? 'flex-row' : 'flex-col'
      )}>
        {/* ── Main panel ── */}
        <main className={cn(
          'flex flex-col gap-6 overflow-y-auto px-6 py-8',
          showLeaderboardPanel ? 'flex-1' : 'mx-auto w-full max-w-5xl flex-1'
        )}>
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

                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <a
                      href="/lobby"
                      target="_blank"
                      rel="noreferrer"
                      className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'gap-2')}
                    >
                      Mở màn hình chờ (projector) →
                    </a>
                    {/* Reconfigure the fixed room (quiz/settings) — keeps the same PIN. */}
                    <a
                      href="/host?new=1"
                      className={cn(buttonVariants({ variant: 'ghost', size: 'lg' }), 'gap-2')}
                    >
                      <Settings className="size-4" /> Cấu hình trận
                    </a>
                  </div>

                  <div className="w-full max-w-2xl">
                    {players.length === 0 ? (
                      <p className="text-center text-[var(--muted-foreground)]">Đang chờ người chơi tham gia...</p>
                    ) : (
                      <>
                        <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                          <span>Người chơi đã vào · chạm để chọn đuổi</span>
                          <span className="text-[var(--accent)]">{players.length}</span>
                        </div>
                        {selectedKick.size > 0 && (
                          <div className="mb-2 flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setConfirmAction('kick')}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-400 transition-colors hover:bg-red-500/20"
                            >
                              <UserX className="size-4" /> Đuổi {selectedKick.size} người
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedKick(new Set())}
                              className="text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-accent"
                            >
                              Bỏ chọn
                            </button>
                          </div>
                        )}
                        <div className="max-h-[40vh] overflow-y-auto rounded-xl border border-[rgba(0,212,255,0.08)] bg-[rgba(2,8,23,0.4)] p-2">
                          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                            {(() => {
                              const LOBBY_VISIBLE_CAP = 80
                              const heavy = players.length > 40
                              const visible = players.slice(0, LOBBY_VISIBLE_CAP)
                              const overflow = players.length - visible.length
                              const tileClass = (id: string) =>
                                cn(
                                  'relative flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border bg-[rgba(6,24,48,0.8)] px-2 py-3 transition-colors',
                                  selectedKick.has(id)
                                    ? 'border-red-500/70 ring-2 ring-red-500/60'
                                    : 'border-[rgba(0,212,255,0.15)] hover:border-accent/40'
                                )
                              const KickBadge = ({ id }: { id: string }) =>
                                selectedKick.has(id) ? (
                                  <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                                    ×
                                  </span>
                                ) : null
                              return (
                                <>
                                  <AnimatePresence initial={false}>
                                    {visible.map((p, i) =>
                                      heavy ? (
                                        <div
                                          key={p.id}
                                          onClick={() => toggleKick(p.id)}
                                          className={tileClass(p.id)}
                                        >
                                          <KickBadge id={p.id} />
                                          <PlayerAvatar nickname={p.nickname} size="sm" />
                                          <span className="w-full truncate text-center text-[10px] font-semibold">{p.nickname}</span>
                                        </div>
                                      ) : (
                                        <motion.div
                                          key={p.id}
                                          initial={{ opacity: 0, scale: 0.7 }}
                                          animate={{ opacity: 1, scale: 1 }}
                                          transition={{ type: 'spring', stiffness: 400, damping: 28, delay: Math.min(i, 20) * 0.02 }}
                                          onClick={() => toggleKick(p.id)}
                                          className={tileClass(p.id)}
                                        >
                                          <KickBadge id={p.id} />
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
                  <div className="flex items-center justify-between gap-4">
                    {question.kahootRound ? (
                      <span className="flex items-center gap-2 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1 text-xs font-bold text-yellow-400">
                        <Zap className="size-3" />
                        Kahoot {question.kahootRound.questionIndex}/{question.kahootRound.totalQuestions}
                      </span>
                    ) : (
                      <span className="q-counter rounded-full border border-[rgba(0,212,255,0.2)] bg-[rgba(0,212,255,0.06)] px-3 py-1 text-xs font-mono font-semibold text-[var(--muted-foreground)]">
                        Câu {question.index + 1}
                      </span>
                    )}
                    <Timer endsAt={question.endsAt} timeLimitSec={question.timeLimitSec} />
                  </div>

                  <h2 className="text-display text-center text-3xl font-bold sm:text-4xl">{question.text}</h2>
                  <AnswerGrid answers={question.answers} mode="play" disabled />

                  <div className="flex flex-col items-center gap-3">
                    <PlayerCount
                      answered={progress.answered}
                      total={progress.total || activePlayers.length}
                      variant="host"
                    />
                    {!kahootMode && eliminatedPlayers.length > 0 && (
                      <span className="text-[10px] uppercase tracking-widest text-red-400/70">
                        {eliminatedPlayers.length} khán giả
                      </span>
                    )}
                  </div>

                  {/* Normal mode: player grid. Kahoot: sidebar handles ranking */}
                  {!kahootMode && <PlayerStatus players={players} />}

                  {/* Preview & reroll the upcoming question (host-only) */}
                  {!isLast && <NextQuestionPreview pin={pin} loginKey={loginKey} />}
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
                  {/* ── Kahoot: Next button pinned to top ── */}
                  {kahootMode && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                      className="flex items-center justify-between gap-4"
                    >
                      <span className="flex items-center gap-2 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1 text-xs font-bold text-yellow-400">
                        <Zap className="size-3" />
                        Kahoot {question.kahootRound?.questionIndex ?? 0}/{question.kahootRound?.totalQuestions ?? 5} — Kết quả
                      </span>
                      <Button
                        size="lg"
                        onClick={() =>
                          isLast ? setConfirmAction('end') : getSocket().emit('host:next', { pin, loginKey })
                        }
                        className="gap-2 border-yellow-400/40 bg-yellow-400/10 text-yellow-300 hover:bg-yellow-400/20"
                      >
                        {isLast ? <Square className="size-4" /> : <Zap className="size-4" />}
                        {isLast ? 'Kết thúc' : 'Câu tiếp'}
                      </Button>
                    </motion.div>
                  )}

                  <h2 className="text-display text-center text-2xl font-bold">{question.text}</h2>

                  <AnswerGrid
                    answers={question.answers}
                    mode="reveal"
                    correctId={result.correctAnswerId}
                    counts={result.counts}
                  />

                  {kahootMode ? (
                    /* Kahoot mode — compact podium + answer stat, sidebar handles full ranking */
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2, duration: 0.4 }}
                      className="flex flex-col gap-3"
                    >
                      {/* Answer stat bar */}
                      {(() => {
                        const totalAnswers = Object.values(result.counts).reduce((s, n) => s + n, 0)
                        const correctCount = result.counts[result.correctAnswerId] ?? 0
                        const wrongCount = totalAnswers - correctCount
                        return (
                          <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/4 px-4 py-3">
                            <div className="flex flex-1 items-center gap-2">
                              <span className="size-2 rounded-full bg-emerald-400 shrink-0" />
                              <span className="text-xs font-semibold text-emerald-400">{correctCount} đúng</span>
                            </div>
                            <div className="h-1.5 flex-[3] overflow-hidden rounded-full bg-white/10">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: totalAnswers > 0 ? `${(correctCount / totalAnswers) * 100}%` : '0%' }}
                                transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
                                className="h-full rounded-full bg-emerald-400"
                              />
                            </div>
                            <div className="flex flex-1 items-center justify-end gap-2">
                              <span className="text-xs font-semibold text-red-400">{wrongCount} sai</span>
                              <span className="size-2 rounded-full bg-red-400 shrink-0" />
                            </div>
                          </div>
                        )
                      })()}

                      {/* Top-3 podium */}
                      {leaderboard.length > 0 && (
                        <div className="grid grid-cols-3 gap-3">
                          {leaderboard.slice(0, 3).map((entry, i) => {
                            const medals = ['text-yellow-300', 'text-slate-300', 'text-amber-400']
                            const borders = ['border-yellow-400/30 bg-yellow-400/8', 'border-slate-300/20 bg-slate-300/5', 'border-amber-600/25 bg-amber-600/6']
                            const labels = ['🥇', '🥈', '🥉']
                            return (
                              <motion.div
                                key={entry.id}
                                initial={{ scale: 0.88, opacity: 0, y: 10 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 + i * 0.07, type: 'spring', stiffness: 380, damping: 26 }}
                                className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 ${borders[i]}`}
                              >
                                <span className="text-xl">{labels[i]}</span>
                                <PlayerAvatar nickname={entry.nickname} size="sm" pulse={i === 0} />
                                <span className={`text-[11px] font-bold truncate w-full text-center ${medals[i]}`}>{entry.nickname}</span>
                                <span className="font-mono text-[11px] text-white/60">{entry.score.toLocaleString()}</span>
                                {entry.delta > 0 && (
                                  <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">+{entry.delta.toLocaleString()}</span>
                                )}
                              </motion.div>
                            )
                          })}
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    /* Normal mode — elimination / survivor columns */
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  )}

                  {/* Preview & reroll the upcoming question (host-only) */}
                  {!isLast && <NextQuestionPreview pin={pin} loginKey={loginKey} />}

                  {/* Normal mode next button — bottom */}
                  {!kahootMode && (
                    <div className="flex flex-wrap justify-center gap-3">
                      <Button
                        size="xl"
                        variant="outline"
                        onClick={startManualKahoot}
                        disabled={status !== 'result' || activePlayers.length === 0}
                        className="gap-2 border-yellow-400/40 bg-yellow-400/10 text-yellow-300 hover:bg-yellow-400/20"
                      >
                        <Zap className="size-5" />
                        Vào Kahoot
                      </Button>
                      <Button
                        size="xl"
                        onClick={() =>
                          isLast ? setConfirmAction('end') : getSocket().emit('host:next', { pin, loginKey })
                        }
                        className="gap-2"
                      >
                        {isLast ? <Square className="size-5" /> : <SkipForward className="size-5" />}
                        {isLast ? 'Kết thúc' : 'Câu tiếp theo'}
                      </Button>
                    </div>
                  )}
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

                  {/* Final leaderboard */}
                  {leaderboard.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1, duration: 0.4 }}
                      className="w-full max-w-md"
                    >
                      <TopLeaderboard entries={leaderboard} title="Bảng xếp hạng cuối" showDelta={false} />
                    </motion.div>
                  )}

                  <div className="flex w-full max-w-3xl flex-col gap-4">
                    {survivors.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.4 }}
                        className="hud-frame-quad relative rounded-2xl px-6 py-6"
                        style={{ background: 'rgba(0,212,255,0.05)' }}
                      >
                        <span className="hud-corner-tr" aria-hidden />
                        <span className="hud-corner-bl" aria-hidden />
                        <p className="mb-4 text-lg font-bold text-[var(--accent)] flex items-center gap-2">
                          <Trophy className="size-5" />
                          {kahootMode ? 'Người chơi (xếp theo điểm)' : `Người chiến thắng (${survivors.length})`}
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
                              {p.score > 0 && (
                                <span className="text-[10px] font-mono text-yellow-400">{p.score.toLocaleString()}pt</span>
                              )}
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

                    {eliminated.length > 0 && !kahootMode && (
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
                    <a
                      href={`/api/export?pin=${pin}&format=csv`}
                      className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'gap-2')}
                    >
                      <Download className="size-5" />
                      Tải CSV
                    </a>
                    <a
                      href={`/api/export?pin=${pin}&format=json`}
                      className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'gap-2')}
                    >
                      <FileJson className="size-5" />
                      Tải JSON
                    </a>
                    <Button
                      size="lg"
                      variant="accent"
                      className="gap-2"
                      onClick={() => setConfirmAction('reset')}
                    >
                      <RefreshCw className="size-5" />
                      Trận mới (giữ PIN)
                    </Button>
                    <Button size="lg" variant="outline" onClick={() => router.push('/host?new=1')}>
                      Tạo phòng khác
                    </Button>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          )}
        </main>

        {/* ── Right: Live Top 10 Leaderboard Panel ── */}
        {showLeaderboardPanel && (
          <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-[rgba(0,212,255,0.1)] bg-[rgba(2,8,23,0.6)] px-5 py-6 backdrop-blur-sm lg:flex lg:flex-col">
            <TopLeaderboard
              entries={leaderboard}
              showDelta={status === 'result'}
              title="Top 10 — Live"
            />

            {/* Quick stats below leaderboard */}
            {players.length > 0 && (
              <div className="mt-6 flex flex-col gap-2 border-t border-white/8 pt-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
                  Tổng quan
                </p>
                <div className="flex justify-between text-xs">
                  <span className="text-white/50">Đang chơi</span>
                  <span className="font-bold text-emerald-400">{kahootMode ? players.length : activePlayers.length}</span>
                </div>
                {!kahootMode && (
                  <div className="flex justify-between text-xs">
                    <span className="text-white/50">Bị loại</span>
                    <span className="font-bold text-red-400">{eliminatedPlayers.length}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs">
                  <span className="text-white/50">Tổng</span>
                  <span className="font-bold text-white/70">{players.length}</span>
                </div>
                {leaderboard[0] && (
                  <div className="mt-2 rounded-lg border border-yellow-400/20 bg-yellow-400/6 px-3 py-2">
                    <p className="text-[10px] text-yellow-400/60">Đang dẫn đầu</p>
                    <p className="truncate text-sm font-bold text-yellow-300">{leaderboard[0].nickname}</p>
                    <p className="font-mono text-xs text-yellow-400">{leaderboard[0].score.toLocaleString()} pts</p>
                  </div>
                )}
              </div>
            )}
          </aside>
        )}
      </div>
    </Backdrop>
  )
}
