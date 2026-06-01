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
} from 'lucide-react'

interface QuizOption {
  file: string
  title: string
  questionCount: number
  error?: string
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
  const [loginKey, setLoginKey] = useState('')
  const [authOk, setAuthOk] = useState(false)
  const [authBusy, setAuthBusy] = useState(true)
  const [authError, setAuthError] = useState('')
  const [quizzes, setQuizzes] = useState<QuizOption[]>([])
  const [selectedQuiz, setSelectedQuiz] = useState('')

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

  function loadQuizzes() {
    fetch('/api/quizzes', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { quizzes?: QuizOption[] }) => {
        const valid = (d.quizzes ?? []).filter((q) => !q.error)
        setQuizzes(d.quizzes ?? [])
        if (!selectedQuiz && valid[0]) setSelectedQuiz(valid[0].file)
      })
      .catch(() => toast.error('Không tải được danh sách quiz'))
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
                File: <span className="font-mono text-accent">{selected.file}</span>
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

              {/* Right Column: Toggles and ends threshold */}
              <div className="flex flex-col gap-5">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold flex items-center gap-1.5 text-foreground/90">
                    <ShieldAlert className="size-4 text-accent" />
                    Kết thúc khi còn lại đặc vụ
                  </span>
                  <div className="flex items-center gap-3">
                    <input
                      id="min-players"
                      type="number"
                      min={1}
                      max={100}
                      value={minPlayersToEnd}
                      onChange={(e) =>
                        setMinPlayersToEnd(Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 1)))
                      }
                      className="w-24 rounded-lg border border-border bg-input/60 px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-accent/60 transition-colors"
                    />
                    <span className="text-xs text-accent font-semibold font-mono">
                      (Top {minPlayersToEnd} chiến thắng)
                    </span>
                  </div>
                  {minPlayersToEnd > 10 && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-400">
                      <AlertTriangle className="size-3.5" />
                      Ngưỡng cao: cần đảm bảo số đặc vụ lớn hơn ngưỡng này.
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    Trận đấu tự động dừng khi số đặc vụ chưa bị loại chạm ngưỡng này.
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
