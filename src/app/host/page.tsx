'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Backdrop } from '@/components/game/Backdrop'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HostAuthCard, HOST_LOGIN_STORAGE_KEY } from '@/components/auth/HostAuthCard'
import { getSocket } from '@/lib/socket-client'
import { parseQuiz } from '@/lib/quiz'
import type { Quiz, QuizDifficulty, QuizQuestion } from '@/types/events'
import {
  AlertTriangle,
  ArrowLeft,
  ClipboardCheck,
  FileJson,
  MonitorPlay,
  Rocket,
  Users,
} from 'lucide-react'

interface QuizOption {
  file: string
  title: string
  questionCount: number
  error?: string
}

const EVENT_QUESTIONSET_ID = '__event_questionset__'
const DIFFICULTIES: QuizDifficulty[] = ['easy', 'medium', 'hard']

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function slotsFromWeights(
  total: number,
  weights: Array<{ difficulty: QuizDifficulty; weight: number }>
): QuizDifficulty[] {
  const base = weights.map((entry, index) => {
    const exact = total * entry.weight
    return {
      ...entry,
      index,
      count: Math.floor(exact),
      remainder: exact - Math.floor(exact),
    }
  })
  let assigned = base.reduce((sum, entry) => sum + entry.count, 0)
  const byRemainder = [...base].sort(
    (a, b) => b.remainder - a.remainder || a.index - b.index
  )

  for (const entry of byRemainder) {
    if (assigned >= total) break
    entry.count += 1
    assigned += 1
  }

  return shuffle(base.flatMap((entry) => Array(entry.count).fill(entry.difficulty)))
}

function buildDifficultyRampDeck(questions: QuizQuestion[]): QuizQuestion[] {
  const pools = DIFFICULTIES.reduce(
    (acc, difficulty) => {
      acc[difficulty] = shuffle(questions.filter((question) => question.difficulty === difficulty))
      return acc
    },
    {} as Record<QuizDifficulty, QuizQuestion[]>
  )

  const deck: QuizQuestion[] = []
  const remainingCount = () => DIFFICULTIES.reduce((sum, difficulty) => sum + pools[difficulty].length, 0)
  const fallbackByDifficulty: Record<QuizDifficulty, QuizDifficulty[]> = {
    easy: ['easy', 'medium', 'hard'],
    medium: ['medium', 'easy', 'hard'],
    hard: ['hard', 'medium', 'easy'],
  }
  const take = (difficulty: QuizDifficulty) => {
    for (const candidate of fallbackByDifficulty[difficulty]) {
      const question = pools[candidate].pop()
      if (question) return question
    }
    return null
  }
  const appendPhase = (
    size: number,
    weights: Array<{ difficulty: QuizDifficulty; weight: number }>
  ) => {
    const phaseSize = Math.min(size, remainingCount())
    for (const difficulty of slotsFromWeights(phaseSize, weights)) {
      const question = take(difficulty)
      if (question) deck.push(question)
    }
  }

  appendPhase(5, [{ difficulty: 'easy', weight: 1 }])
  appendPhase(10, [
    { difficulty: 'easy', weight: 0.4 },
    { difficulty: 'medium', weight: 0.6 },
  ])
  appendPhase(10, [
    { difficulty: 'easy', weight: 0.2 },
    { difficulty: 'medium', weight: 0.5 },
    { difficulty: 'hard', weight: 0.3 },
  ])
  appendPhase(remainingCount(), [
    { difficulty: 'hard', weight: 0.7 },
    { difficulty: 'medium', weight: 0.3 },
  ])

  return deck
}

export default function HostCreatePage() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [checkingActive, setCheckingActive] = useState(false)
  const [minPlayersToEnd, setMinPlayersToEnd] = useState(1)
  const [loginKey, setLoginKey] = useState('')
  const [authOk, setAuthOk] = useState(false)
  const [authBusy, setAuthBusy] = useState(true)
  const [authError, setAuthError] = useState('')
  const [quizzes, setQuizzes] = useState<QuizOption[]>([])
  const [selectedQuiz, setSelectedQuiz] = useState('')
  const [loadingQuestionSet, setLoadingQuestionSet] = useState(false)
  const [eventQuestionSet, setEventQuestionSet] = useState<Quiz | null>(null)

  useEffect(() => {
    const saved = sessionStorage.getItem(HOST_LOGIN_STORAGE_KEY) ?? ''
    setLoginKey(saved)
    getSocket().emit('host:auth', { loginKey: saved }, (res) => {
      setAuthBusy(false)
      if (res.ok) {
        setAuthOk(true)
        sessionStorage.setItem(HOST_LOGIN_STORAGE_KEY, saved)
        checkActiveRoom()
        loadQuizzes()
      } else {
        if (saved) sessionStorage.removeItem(HOST_LOGIN_STORAGE_KEY)
        setAuthOk(false)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function checkActiveRoom() {
    const forceNew = new URLSearchParams(window.location.search).get('new') === '1'
    if (forceNew) return
    setCheckingActive(true)
    fetch('/api/active-room', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { pin?: string | null }) => {
        if (d?.pin) router.replace(`/host/${d.pin}`)
      })
      .catch(() => {
        /* no active room or server not ready */
      })
      .finally(() => setCheckingActive(false))
  }

  function loadQuizzes(showToast = false) {
    setLoadingQuestionSet(true)
    fetch('/api/quizzes', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { quizzes?: QuizOption[] }) => {
        const eventQuizzes = (d.quizzes ?? []).filter((q) => q.file !== 'sample.json')
        const valid = eventQuizzes.filter((q) => !q.error)
        setQuizzes(eventQuizzes)
        if (!valid.some((q) => q.file === selectedQuiz)) {
          setSelectedQuiz(valid[0]?.file ?? '')
        }
      })
      .then(() => {
        if (showToast) toast.success('Đã load event questionset')
      })
      .catch(() => toast.error('Không tải được event questionset'))
      .finally(() => setLoadingQuestionSet(false))
  }

  async function loadEventQuestionSet() {
    setLoadingQuestionSet(true)
    try {
      const listRes = await fetch('/api/quizzes', { cache: 'no-store' })
      if (!listRes.ok) throw new Error(`Không tải được danh sách quiz (${listRes.status})`)
      const data = (await listRes.json()) as { quizzes?: QuizOption[] }
      const eventQuizzes = (data.quizzes ?? []).filter((q) => q.file !== 'sample.json' && !q.error)
      if (eventQuizzes.length === 0) throw new Error('Không có event questionset hợp lệ')

      const parsed = await Promise.all(
        eventQuizzes.map(async (meta) => {
          const quizRes = await fetch(`/quizzes/${meta.file}`, { cache: 'no-store' })
          if (!quizRes.ok) throw new Error(`Không tải được ${meta.file}`)
          return { meta, quiz: parseQuiz(await quizRes.json()) }
        })
      )

      const questions = parsed.flatMap(({ meta, quiz }) => {
        const prefix = meta.file.replace(/\.json$/i, '')
        return quiz.questions.map((question) => ({
          ...question,
          id: `${prefix}:${question.id}`,
        }))
      })

      const merged: Quiz = {
        title: 'Event Questionset - Police Quiz 2026',
        questions: buildDifficultyRampDeck(questions),
      }
      const mergedOption: QuizOption = {
        file: EVENT_QUESTIONSET_ID,
        title: merged.title,
        questionCount: merged.questions.length,
      }

      setEventQuestionSet(merged)
      setQuizzes([mergedOption, ...eventQuizzes])
      setSelectedQuiz(EVENT_QUESTIONSET_ID)
      toast.success(
        `Đã gộp ${eventQuizzes.length} question set thành ${merged.questions.length} câu theo difficulty ramp`
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không tải được event questionset')
    } finally {
      setLoadingQuestionSet(false)
    }
  }

  function authenticate() {
    setAuthBusy(true)
    setAuthError('')
    getSocket().emit('host:auth', { loginKey }, (res) => {
      setAuthBusy(false)
      if (res.ok) {
        sessionStorage.setItem(HOST_LOGIN_STORAGE_KEY, loginKey)
        setAuthOk(true)
        checkActiveRoom()
        loadQuizzes()
      } else {
        sessionStorage.removeItem(HOST_LOGIN_STORAGE_KEY)
        setAuthOk(false)
        setAuthError('LOGIN_KEY không đúng')
      }
    })
  }

  async function create() {
    const chosen = quizzes.find((q) => q.file === selectedQuiz)
    if (selectedQuiz === EVENT_QUESTIONSET_ID) {
      if (!eventQuestionSet) return toast.error('Bấm Load event questionset trước')
      setBusy(true)
      getSocket().emit('host:create', { quiz: eventQuestionSet, minPlayersToEnd, loginKey }, (res) => {
        setBusy(false)
        if (res.ok && res.pin) {
          sessionStorage.setItem(HOST_LOGIN_STORAGE_KEY, loginKey)
          router.push(`/host/${res.pin}`)
        } else {
          if (res.error === 'Invalid login key') {
            sessionStorage.removeItem(HOST_LOGIN_STORAGE_KEY)
            setAuthOk(false)
            setAuthError('LOGIN_KEY không đúng')
            return
          }
          toast.error(res.error ?? 'Tạo phòng thất bại')
        }
      })
      return
    }
    if (!chosen) return toast.error('Chọn một quiz hợp lệ trước')
    setBusy(true)
    try {
      const quizRes = await fetch(`/quizzes/${chosen.file}`, { cache: 'no-store' })
      if (!quizRes.ok) throw new Error(`Không tải được quiz (${quizRes.status})`)
      const quiz = parseQuiz(await quizRes.json())
      const socket = getSocket()
      socket.emit('host:create', { quiz, minPlayersToEnd, loginKey }, (res) => {
        setBusy(false)
        if (res.ok && res.pin) {
          sessionStorage.setItem(HOST_LOGIN_STORAGE_KEY, loginKey)
          router.push(`/host/${res.pin}`)
        } else {
          if (res.error === 'Invalid login key') {
            sessionStorage.removeItem(HOST_LOGIN_STORAGE_KEY)
            setAuthOk(false)
            setAuthError('LOGIN_KEY không đúng')
            return
          }
          toast.error(res.error ?? 'Tạo phòng thất bại')
        }
      })
    } catch (e) {
      setBusy(false)
      toast.error(e instanceof Error ? e.message : 'Không tải được quiz')
    }
  }

  const selected = quizzes.find((q) => q.file === selectedQuiz)

  return (
    <Backdrop>
      {!authOk && (
        <HostAuthCard
          loginKey={loginKey}
          busy={authBusy}
          error={authError}
          onChange={(value) => {
            setLoginKey(value)
            setAuthError('')
          }}
          onSubmit={authenticate}
        />
      )}
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-12">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:text-accent"
          >
            <ArrowLeft className="size-3.5" /> Trang chủ
          </Link>
          <Link href="/host/check">
            <Button variant="outline" size="sm" className="gap-2">
              <ClipboardCheck className="size-4" />
              Checklist
            </Button>
          </Link>
        </div>

        <div>
          <h1 className="text-display text-4xl font-bold">
            Tạo <span className="text-accent neon-text-cyan">phòng</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Single-room mode: nếu đã có phòng active, host sẽ được chuyển thẳng vào phòng đó.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileJson className="size-5 text-accent" /> Chọn quiz sự kiện
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={loadEventQuestionSet}
              disabled={!authOk || loadingQuestionSet}
              className="gap-2 self-start"
            >
              <FileJson className="size-4" />
              {loadingQuestionSet ? 'Loading event questionset...' : 'Load event questionset'}
            </Button>
            <select
              value={selectedQuiz}
              onChange={(e) => setSelectedQuiz(e.target.value)}
              className="h-12 w-full rounded-lg border border-border bg-input/60 px-3 text-sm font-semibold text-foreground outline-none focus:border-accent/60"
              disabled={!authOk || quizzes.length === 0}
            >
              {quizzes.length === 0 ? (
                <option value="">Đang tải quiz...</option>
              ) : (
                quizzes.map((quiz) => (
                  <option key={quiz.file} value={quiz.file} disabled={!!quiz.error}>
                    {quiz.title} ({quiz.questionCount} câu)
                  </option>
                ))
              )}
            </select>
            {selected && (
              <div className="rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-xs text-muted-foreground">
                {selected.file === EVENT_QUESTIONSET_ID ? 'Merged questionset' : 'File'}:{' '}
                <span className="font-mono text-accent">
                  {selected.file === EVENT_QUESTIONSET_ID ? `${selected.questionCount} câu từ tất cả event quiz` : selected.file}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5 text-accent" /> Cài đặt trận đấu
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">
                Kết thúc khi còn lại <span className="text-accent">{minPlayersToEnd}</span> người chiến thắng
              </span>
              <input
                id="min-players"
                type="number"
                min={1}
                max={100}
                value={minPlayersToEnd}
                onChange={(e) =>
                  setMinPlayersToEnd(Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 1)))
                }
                className="w-28 rounded-lg border border-border bg-input/60 px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-accent/60"
              />
              {minPlayersToEnd > 10 && (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-400">
                  <AlertTriangle className="size-3.5" />
                  Ngưỡng cao: đảm bảo số người tham gia lớn hơn ngưỡng này.
                </span>
              )}
            </label>
          </CardContent>
        </Card>

        <Button
          size="lg"
          onClick={create}
          disabled={!authOk || busy || checkingActive || !selectedQuiz}
          className="gap-2"
        >
          <Rocket className="size-5" />
          {checkingActive ? 'Đang kiểm tra phòng active...' : busy ? 'Đang tạo...' : 'Tạo phòng'}
        </Button>

        <a
          href="/lobby"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 text-xs uppercase tracking-widest text-muted-foreground underline-offset-4 transition-colors hover:text-accent hover:underline"
        >
          <MonitorPlay className="size-4" />
          Mở projector auto-detect
        </a>
      </main>
    </Backdrop>
  )
}
