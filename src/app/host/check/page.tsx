'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Backdrop } from '@/components/game/Backdrop'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HostAuthCard, HOST_LOGIN_STORAGE_KEY } from '@/components/auth/HostAuthCard'
import { getSocket } from '@/lib/socket-client'
import { cn, formatPin } from '@/lib/utils'
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  KeyRound,
  MonitorPlay,
  Radio,
  Smartphone,
  XCircle,
} from 'lucide-react'

interface ActiveRoom {
  pin: string
  quizTitle: string
  status: string
  players: number
  totalQuestions: number
}

interface QuizOption {
  file: string
  title: string
  questionCount: number
  error?: string
}

function CheckRow({
  ok,
  label,
  value,
}: {
  ok: boolean
  label: string
  value: string
}) {
  const Icon = ok ? CheckCircle2 : XCircle
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/40 py-3 last:border-b-0">
      <div className="flex items-center gap-2">
        <Icon className={ok ? 'size-4 text-emerald-400' : 'size-4 text-red-400'} />
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <span className="text-right text-xs text-muted-foreground">{value}</span>
    </div>
  )
}

export default function HostCheckPage() {
  const [loginKey, setLoginKey] = useState('')
  const [authOk, setAuthOk] = useState(false)
  const [authBusy, setAuthBusy] = useState(true)
  const [authError, setAuthError] = useState('')
  const [socketOk, setSocketOk] = useState(false)
  const [room, setRoom] = useState<ActiveRoom | null>(null)
  const [quizzes, setQuizzes] = useState<QuizOption[]>([])
  const [origin, setOrigin] = useState('')

  const projectorUrl = useMemo(
    () => (origin && room ? `${origin}/lobby` : ''),
    [origin, room]
  )
  const playerUrl = useMemo(
    () => (origin && room ? `${origin}/play` : ''),
    [origin, room]
  )

  useEffect(() => {
    setOrigin(window.location.origin)
    const saved = sessionStorage.getItem(HOST_LOGIN_STORAGE_KEY) ?? ''
    setLoginKey(saved)
    const socket = getSocket()
    setSocketOk(socket.connected)
    const onConnect = () => setSocketOk(true)
    const onDisconnect = () => setSocketOk(false)
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.emit('host:auth', { loginKey: saved }, (res) => {
      setAuthBusy(false)
      if (res.ok) {
        setAuthOk(true)
        refresh()
      } else {
        setAuthOk(false)
        if (saved) sessionStorage.removeItem(HOST_LOGIN_STORAGE_KEY)
      }
    })
    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function refresh() {
    fetch('/api/active-room', {
      cache: 'no-store',
      headers: { 'x-login-key': sessionStorage.getItem(HOST_LOGIN_STORAGE_KEY) ?? loginKey },
    })
      .then((r) => r.json())
      .then((d: { room?: ActiveRoom | null }) => setRoom(d.room ?? null))
      .catch(() => setRoom(null))

    fetch('/api/quizzes', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { quizzes?: QuizOption[] }) => setQuizzes(d.quizzes ?? []))
      .catch(() => setQuizzes([]))
  }

  function authenticate() {
    setAuthBusy(true)
    setAuthError('')
    getSocket().emit('host:auth', { loginKey }, (res) => {
      setAuthBusy(false)
      if (res.ok) {
        sessionStorage.setItem(HOST_LOGIN_STORAGE_KEY, loginKey)
        setAuthOk(true)
        refresh()
      } else {
        sessionStorage.removeItem(HOST_LOGIN_STORAGE_KEY)
        setAuthOk(false)
        setAuthError('LOGIN_KEY không đúng')
      }
    })
  }

  const validQuizzes = quizzes.filter((q) => !q.error)

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

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-6 py-12">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/host"
            className="inline-flex items-center gap-1 text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:text-accent"
          >
            <ArrowLeft className="size-3.5" /> Host
          </Link>
          <Button variant="outline" size="sm" onClick={refresh}>
            Làm mới
          </Button>
        </div>

        <div>
          <h1 className="text-display text-4xl font-bold">
            Checklist <span className="text-accent neon-text-cyan">trước sự kiện</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Chạy trang này trước event 15 phút để kiểm tra room, socket, link projector và player.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="size-5 text-accent" />
              Trạng thái vận hành
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CheckRow ok={socketOk} label="Cổng kết nối (Socket)" value={socketOk ? 'đã kết nối' : 'mất kết nối'} />
            <CheckRow ok={!!room} label="Phòng" value={room ? `PIN ${formatPin(room.pin)}` : 'chưa có phòng'} />
            <CheckRow
              ok={!!room?.quizTitle}
              label="Bộ câu hỏi đã tải"
              value={room ? `${room.quizTitle} · ${room.totalQuestions} câu` : `${validQuizzes.length} quiz sẵn sàng`}
            />
            <CheckRow ok={!!projectorUrl} label="Đường dẫn Projector" value={projectorUrl || 'tạo phòng trước'} />
            <CheckRow ok={!!playerUrl} label="Đường dẫn Người chơi" value={playerUrl || 'tạo phòng trước'} />
            <CheckRow ok={authOk} label="MÃ ĐĂNG NHẬP" value={authOk ? 'đã xác thực' : 'chưa xác thực'} />
            <CheckRow
              ok={!!projectorUrl && !!playerUrl}
              label="Kiểm tra màn hình MC"
              value={projectorUrl ? 'mở projector + quét mã QR' : 'chờ phòng'}
            />
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-3">
          <a
            href={projectorUrl || '/lobby'}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'gap-2')}
          >
            <MonitorPlay className="size-5" />
            Projector
          </a>
          <a
            href={playerUrl || '/play'}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'gap-2')}
          >
            <Smartphone className="size-5" />
            Player
          </a>
          <Link href={room ? `/host/${room.pin}` : '/host'}>
            <Button size="lg" className="w-full gap-2">
              <Radio className="size-5" />
              Host room
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-5 text-accent" />
              Tóm tắt sự kiện
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {room ? (
              <p>
                Phòng <span className="font-mono text-accent">{formatPin(room.pin)}</span> đang ở trạng thái{' '}
                <span className="text-foreground">{room.status}</span>, có {room.players} người chơi đã tham gia.
              </p>
            ) : (
              <p>Chưa có phòng đang hoạt động. Quay lại /host để chọn quiz và tạo phòng trước khi mở cửa cho người chơi.</p>
            )}
          </CardContent>
        </Card>
      </main>
    </Backdrop>
  )
}
