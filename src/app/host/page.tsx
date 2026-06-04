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
  Clock,
  Settings,
  Shuffle,
  ShieldAlert,
  ListOrdered,
  Zap,
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
  const [maxPlayers, setMaxPlayers] = useState(100)
  const [timeLimitSec, setTimeLimitSec] = useState<number | null>(null)
  const [randomizeQuestions, setRandomizeQuestions] = useState(true)
  const [randomizeAnswers, setRandomizeAnswers] = useState(true)
  const [kahootThreshold, setKahootThreshold] = useState(10)
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
        loadEventQuestionSet()
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

  async function loadEventQuestionSet(showToast = false): Promise<Quiz | null> {
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
        title: 'Bộ câu hỏi sự kiện - Police Quiz 2026',
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
      if (showToast) {
        toast.success(
          `Đã gộp ${eventQuizzes.length} bộ câu hỏi thành ${merged.questions.length} câu theo thang độ khó`
        )
      }
      return merged
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không tải được bộ câu hỏi sự kiện')
      return null
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
        loadEventQuestionSet()
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
      const quiz = eventQuestionSet ?? await loadEventQuestionSet()
      if (!quiz) return
      setBusy(true)
      getSocket().emit('host:create', { quiz, minPlayersToEnd, maxPlayers, timeLimitSec, randomizeQuestions, randomizeAnswers, loginKey, kahootThreshold }, (res) => {
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
      socket.emit('host:create', {
        quiz,
        minPlayersToEnd,
        maxPlayers,
        timeLimitSec,
        randomizeQuestions,
        randomizeAnswers,
        loginKey,
        kahootThreshold,
      }, (res) => {
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
              Danh sách kiểm tra
            </Button>
          </Link>
        </div>

        <div>
          <h1 className="text-display text-4xl font-bold">
            Tạo <span className="text-accent neon-text-cyan">phòng</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Chế độ phòng đơn (Single-room): nếu đã có phòng đang hoạt động, host sẽ được chuyển thẳng vào phòng đó.
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
              onClick={() => loadEventQuestionSet(true)}
              disabled={!authOk || loadingQuestionSet}
              className="gap-2 self-start"
            >
              <FileJson className="size-4" />
              {loadingQuestionSet ? 'Đang tải bộ câu hỏi sự kiện...' : 'Tải bộ câu hỏi sự kiện'}
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
                {selected.file === EVENT_QUESTIONSET_ID ? 'Bộ câu hỏi đã gộp' : 'Tệp tin'}:{' '}
                <span className="font-mono text-accent">
                  {selected.file === EVENT_QUESTIONSET_ID ? `${selected.questionCount} câu từ tất cả event quiz` : selected.file}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-accent neon-text-cyan">
              <Settings className="size-5" /> Cài đặt trận đấu
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Number adjustments */}
              <div className="flex flex-col gap-5">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold flex items-center gap-1.5 text-foreground/90">
                    <Users className="size-4 text-accent" />
                    Số đặc vụ tối đa
                  </span>
                  <input
                    id="max-players"
                    type="number"
                    min={1}
                    max={200}
                    value={maxPlayers}
                    onChange={(e) =>
                      setMaxPlayers(Math.min(200, Math.max(1, parseInt(e.target.value, 10) || 1)))
                    }
                    className="w-full rounded-lg border border-border bg-input/60 px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-accent/60 transition-colors"
                  />
                  <span className="text-[10px] text-muted-foreground">
                    Giới hạn số đặc vụ được phép tham gia phòng (Tối đa 200).
                  </span>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold flex items-center gap-1.5 text-foreground/90">
                    <Clock className="size-4 text-accent" />
                    Thời gian trả lời mỗi câu
                  </span>
                  <select
                    value={timeLimitSec === null ? '' : timeLimitSec}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTimeLimitSec(val === '' ? null : parseInt(val, 10));
                    }}
                    className="h-10 w-full rounded-lg border border-border bg-input/60 px-3 text-sm font-semibold text-foreground outline-none focus:border-accent/60 transition-colors cursor-pointer"
                  >
                    <option value="">Mặc định (Từ quiz hoặc 20s)</option>
                    <option value="5">5 giây (Siêu tốc)</option>
                    <option value="10">10 giây</option>
                    <option value="15">15 giây</option>
                    <option value="20">20 giây (Khuyên dùng)</option>
                    <option value="30">30 giây</option>
                    <option value="45">45 giây</option>
                    <option value="60">60 giây</option>
                  </select>
                  <span className="text-[10px] text-muted-foreground">
                    Thời gian đếm ngược của mỗi câu hỏi (Ghi đè cấu hình mặc định).
                  </span>
                </label>
              </div>

              {/* Right Column: Kahoot threshold + randomize toggles */}
              <div className="flex flex-col gap-5">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold flex items-center gap-1.5 text-foreground/90">
                    <Zap className="size-4 text-yellow-400" />
                    Vào vòng Kahoot khi còn ≤ N đặc vụ
                  </span>
                  <div className="flex items-center gap-3">
                    <input
                      id="kahoot-threshold"
                      type="number"
                      min={0}
                      max={100}
                      value={kahootThreshold}
                      onChange={(e) =>
                        setKahootThreshold(Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)))
                      }
                      className="w-24 rounded-lg border border-yellow-400/30 bg-input/60 px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-yellow-400/60 transition-colors"
                    />
                    <span className="text-xs text-yellow-400 font-semibold font-mono">
                      {kahootThreshold === 0 ? '(Tắt — loại dần đến hết)' : `(Top ${kahootThreshold} → speed round)`}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    Khi còn ≤ N đặc vụ chưa bị loại, trận tự chuyển sang 5 câu Kahoot tốc độ rồi kết thúc. Đặt 0 để loại dần đến người cuối.
                  </span>
                </label>

                <div className="flex flex-col gap-3 mt-1">
                  <label className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={randomizeQuestions}
                      onChange={(e) => setRandomizeQuestions(e.target.checked)}
                      className="size-4 rounded border-border bg-input/60 text-accent focus:ring-0 focus:ring-offset-0 outline-none accent-accent cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-foreground/95 group-hover:text-accent transition-colors flex items-center gap-1.5">
                      <Shuffle className="size-3.5" />
                      Tráo ngẫu nhiên câu hỏi
                    </span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={randomizeAnswers}
                      onChange={(e) => setRandomizeAnswers(e.target.checked)}
                      className="size-4 rounded border-border bg-input/60 text-accent focus:ring-0 focus:ring-offset-0 outline-none accent-accent cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-foreground/95 group-hover:text-accent transition-colors flex items-center gap-1.5">
                      <ListOrdered className="size-3.5" />
                      Tráo ngẫu nhiên đáp án
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button
          size="lg"
          onClick={create}
          disabled={!authOk || busy || checkingActive || !selectedQuiz}
          className="gap-2"
        >
          <Rocket className="size-5" />
          {checkingActive ? 'Đang kiểm tra phòng đang hoạt động...' : busy ? 'Đang tạo...' : 'Tạo phòng'}
        </Button>

        <a
          href="/lobby"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 text-xs uppercase tracking-widest text-muted-foreground underline-offset-4 transition-colors hover:text-accent hover:underline"
        >
          <MonitorPlay className="size-4" />
          Mở projector tự động phát hiện
        </a>
      </main>
    </Backdrop>
  )
}
