'use client'
import { use, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Backdrop } from '@/components/game/Backdrop'
import { Button } from '@/components/ui/button'
import { Timer } from '@/components/game/Timer'
import { AnswerGrid } from '@/components/game/AnswerGrid'
import { getSocket } from '@/lib/socket-client'
import { cn } from '@/lib/utils'
import type { GameStatus, PublicQuestion, QuestionResult, LeaderboardRow } from '@/types/events'
import { CheckCircle2, XCircle, Hourglass } from 'lucide-react'

export default function PlayRoomPage({ params }: { params: Promise<{ pin: string }> }) {
  const { pin } = use(params)
  const router = useRouter()

  const [status, setStatus] = useState<GameStatus>('lobby')
  const [nickname, setNickname] = useState('')
  const [question, setQuestion] = useState<PublicQuestion | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [result, setResult] = useState<QuestionResult | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([])
  const playerIdRef = useRef<string>('')

  useEffect(() => {
    const saved = sessionStorage.getItem(`pk:${pin}`)
    if (!saved) {
      router.replace(`/play?pin=${pin}`)
      return
    }
    const { playerId, nickname: nick } = JSON.parse(saved) as { playerId: string; nickname: string }
    playerIdRef.current = playerId
    setNickname(nick)

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
      setLeaderboard(r.leaderboard)
      setStatus('result')
    })
    socket.on('game:over', (o) => {
      setLeaderboard(o.leaderboard)
      setStatus('ended')
    })

    return () => {
      socket.off('connect', rejoin)
      socket.off('game:question')
      socket.off('question:result')
      socket.off('game:over')
    }
  }, [pin, router])

  function pick(answerId: number) {
    if (!question || selected !== null) return
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

  const myRow = leaderboard.find((r) => r.playerId === playerIdRef.current)

  return (
    <Backdrop>
      <header className="relative z-10 flex items-center justify-between border-b border-[var(--header-border)] bg-[var(--navy-panel)] px-5 py-3 backdrop-blur">
        <span className="font-semibold">{nickname}</span>
        {myRow && (
          <span className="text-sm">
            Điểm <span className="font-bold text-accent">{myRow.score}</span>
          </span>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-6 px-5 py-8">
        {status === 'lobby' && (
          <div className="flex flex-col items-center gap-4 text-center">
            <Hourglass className="size-12 animate-pulse text-accent" />
            <p className="text-xl font-semibold">Đã vào phòng!</p>
            <p className="text-muted-foreground">Chờ host bắt đầu…</p>
            <span className="pin-display text-3xl font-bold text-accent">{pin}</span>
          </div>
        )}

        {status === 'question' && question && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-mono text-muted-foreground">
                Câu {question.index + 1}/{question.total}
              </span>
              <Timer endsAt={question.endsAt} timeLimitSec={question.timeLimitSec} />
            </div>
            <h2 className="text-center text-xl font-bold">{question.text}</h2>
            {selected === null ? (
              <AnswerGrid answers={question.answers} mode="play" selected={selected} onPick={pick} />
            ) : (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <CheckCircle2 className="size-12 text-accent" />
                <p className="text-lg font-semibold">Đã chọn!</p>
                <p className="text-muted-foreground">Chờ người khác trả lời…</p>
              </div>
            )}
          </div>
        )}

        {status === 'result' && result && (
          <div className="flex flex-col items-center gap-4 text-center">
            {result.you?.correct ? (
              <>
                <CheckCircle2 className="size-16 text-correct" />
                <p className="text-2xl font-bold text-correct">Chính xác!</p>
                <p className="text-xl font-bold text-accent">+{result.you.gained}</p>
              </>
            ) : (
              <>
                <XCircle className="size-16 text-strike" />
                <p className="text-2xl font-bold text-strike">
                  {result.you?.answered ? 'Sai rồi' : 'Hết giờ'}
                </p>
              </>
            )}
            {myRow && (
              <div className={cn('mt-2 rounded-lg border px-5 py-3', 'border-accent/40 bg-accent/10')}>
                <p className="text-sm text-muted-foreground">Hạng của bạn</p>
                <p className="text-3xl font-bold text-accent">#{myRow.rank}</p>
                <p className="text-sm">{myRow.score} điểm</p>
              </div>
            )}
            <p className="text-sm text-muted-foreground">Chờ host sang câu tiếp…</p>
          </div>
        )}

        {status === 'ended' && (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-display text-3xl font-bold neon-text-white">Kết thúc!</p>
            {myRow && (
              <div className="rounded-xl border border-accent/50 bg-accent/10 px-8 py-6 glow-cyan">
                <p className="text-5xl">{['🥇', '🥈', '🥉'][myRow.rank - 1] ?? '🎯'}</p>
                <p className="mt-2 text-2xl font-bold">Hạng #{myRow.rank}</p>
                <p className="text-lg text-accent">{myRow.score} điểm</p>
              </div>
            )}
            <Button onClick={() => router.push('/')}>Về trang chủ</Button>
          </div>
        )}
      </main>
    </Backdrop>
  )
}
