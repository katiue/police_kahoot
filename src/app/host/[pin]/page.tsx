'use client'
import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Backdrop } from '@/components/game/Backdrop'
import { Button } from '@/components/ui/button'
import { Timer } from '@/components/game/Timer'
import { AnswerGrid } from '@/components/game/AnswerGrid'
import { Leaderboard } from '@/components/game/Leaderboard'
import { QrPanel } from '@/components/game/QrPanel'
import { getSocket } from '@/lib/socket-client'
import type {
  GameStatus,
  PlayerView,
  PublicQuestion,
  QuestionResult,
  LeaderboardRow,
} from '@/types/events'
import { Play, SkipForward, Square, Users } from 'lucide-react'

export default function HostRoomPage({ params }: { params: Promise<{ pin: string }> }) {
  const { pin } = use(params)
  const router = useRouter()

  const [status, setStatus] = useState<GameStatus>('lobby')
  const [players, setPlayers] = useState<PlayerView[]>([])
  const [question, setQuestion] = useState<PublicQuestion | null>(null)
  const [result, setResult] = useState<QuestionResult | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([])
  const [joinUrl, setJoinUrl] = useState('')
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    setJoinUrl(`${window.location.origin}/play?pin=${pin}`)
    const socket = getSocket()

    const join = () =>
      socket.emit('host:join', { pin }, (res) => {
        if (!res.ok) {
          setNotFound(true)
          return
        }
        if (res.state) {
          setStatus(res.state.status)
          setPlayers(res.state.players)
        }
      })

    join()
    socket.on('connect', join) // re-join on reconnect

    socket.on('lobby:update', (p) => {
      setPlayers(p.players)
      setStatus((s) => (s === 'lobby' ? p.status : s))
    })
    socket.on('game:question', (q) => {
      setQuestion(q)
      setResult(null)
      setStatus('question')
    })
    socket.on('question:result', (r) => {
      setResult(r)
      setLeaderboard(r.leaderboard)
      setStatus('result')
    })
    socket.on('game:over', (o) => {
      setLeaderboard(o.leaderboard)
      setStatus('ended')
    })

    return () => {
      socket.off('connect', join)
      socket.off('lobby:update')
      socket.off('game:question')
      socket.off('question:result')
      socket.off('game:over')
    }
  }, [pin])

  const isLast = question ? question.index >= question.total - 1 : false

  if (notFound) {
    return (
      <Backdrop>
        <main className="flex flex-1 flex-col items-center justify-center gap-4">
          <p className="text-xl">Phòng <span className="pin-display text-accent">{pin}</span> không tồn tại.</p>
          <Button onClick={() => router.push('/host')}>Tạo phòng mới</Button>
        </main>
      </Backdrop>
    )
  }

  return (
    <Backdrop>
      <header className="relative z-10 flex items-center justify-between border-b border-[var(--header-border)] bg-[var(--navy-panel)] px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="size-4" /> {players.length} người chơi
        </div>
        <div className="text-sm">
          PIN <span className="pin-display text-lg font-bold text-accent">{pin}</span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
        {status === 'lobby' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-8">
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm uppercase tracking-widest text-muted-foreground">Vào chơi tại</p>
              <p className="text-display text-2xl font-bold">{joinUrl.replace(/^https?:\/\//, '')}</p>
              <div className="mt-2 flex flex-col items-center">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">Game PIN</span>
                <span className="pin-display text-7xl font-bold text-accent neon-text-cyan">{pin}</span>
              </div>
            </div>
            {joinUrl && <QrPanel joinUrl={joinUrl} />}
            <a
              href={`/lobby?pin=${pin}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs uppercase tracking-widest text-muted-foreground underline-offset-4 hover:text-accent hover:underline"
            >
              Mở màn hình chờ (projector) →
            </a>
            <div className="flex w-full max-w-xl flex-wrap justify-center gap-2">
              {players.length === 0 && (
                <p className="text-muted-foreground">Đang chờ người chơi tham gia...</p>
              )}
              {players.map((p) => (
                <span
                  key={p.id}
                  className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-sm font-semibold"
                >
                  {p.nickname}
                </span>
              ))}
            </div>
            <Button
              size="xl"
              onClick={() => getSocket().emit('host:start', { pin })}
              disabled={players.length === 0}
              className="gap-2"
            >
              <Play className="size-6" /> Bắt đầu
            </Button>
          </div>
        )}

        {status === 'question' && question && (
          <div className="flex flex-1 flex-col gap-6">
            <div className="flex items-center justify-between">
              <span className="q-counter text-sm font-mono text-muted-foreground">
                Câu {question.index + 1} / {question.total}
              </span>
              <Timer endsAt={question.endsAt} timeLimitSec={question.timeLimitSec} />
            </div>
            <h2 className="text-display text-center text-3xl font-bold sm:text-4xl">{question.text}</h2>
            <AnswerGrid answers={question.answers} mode="play" disabled />
            <p className="text-center text-sm text-muted-foreground">Người chơi đang trả lời trên thiết bị của họ…</p>
          </div>
        )}

        {status === 'result' && result && question && (
          <div className="flex flex-1 flex-col gap-6">
            <h2 className="text-display text-center text-2xl font-bold">{question.text}</h2>
            <AnswerGrid
              answers={question.answers}
              mode="reveal"
              correctId={result.correctAnswerId}
              counts={result.counts}
            />
            <h3 className="mt-2 text-center text-lg font-bold text-accent">Bảng xếp hạng</h3>
            <Leaderboard rows={leaderboard} />
            <div className="flex justify-center">
              <Button size="xl" onClick={() => getSocket().emit('host:next', { pin })} className="gap-2">
                {isLast ? <Square className="size-5" /> : <SkipForward className="size-5" />}
                {isLast ? 'Kết thúc' : 'Câu tiếp theo'}
              </Button>
            </div>
          </div>
        )}

        {status === 'ended' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6">
            <h2 className="text-display text-4xl font-bold neon-text-white">🏆 Kết quả cuối</h2>
            <div className="w-full max-w-xl">
              <Leaderboard rows={leaderboard} max={10} />
            </div>
            <Button size="lg" onClick={() => router.push('/host')}>Tạo phòng mới</Button>
          </div>
        )}
      </main>
    </Backdrop>
  )
}
