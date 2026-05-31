'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Backdrop } from '@/components/game/Backdrop'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getSocket } from '@/lib/socket-client'
import { parseQuiz } from '@/lib/quiz'
import { Upload, FileJson, Rocket, Users, ArrowLeft, AlertTriangle } from 'lucide-react'

export default function HostCreatePage() {
  const router = useRouter()
  const [raw, setRaw] = useState('')
  const [busy, setBusy] = useState(false)
  const [minPlayersToEnd, setMinPlayersToEnd] = useState(1)

  function loadFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => setRaw(String(reader.result ?? ''))
    reader.readAsText(file)
  }

  async function useSample() {
    try {
      const res = await fetch('/quizzes/sample.json')
      if (!res.ok) {
        console.error('sample fetch failed', res.status, res.statusText)
        toast.error(`Không tải được quiz mẫu (HTTP ${res.status})`)
        return
      }
      setRaw(await res.text())
      toast.success('Đã nạp quiz mẫu')
    } catch (e) {
      console.error('sample fetch threw', e)
      toast.error('Không tải được quiz mẫu')
    }
  }

  function create() {
    let quiz
    try {
      quiz = parseQuiz(JSON.parse(raw))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'JSON không hợp lệ')
      return
    }
    setBusy(true)
    const socket = getSocket()
    socket.emit('host:create', { quiz, minPlayersToEnd }, (res) => {
      setBusy(false)
      if (res.ok && res.pin) {
        router.push(`/host/${res.pin}`)
      } else {
        toast.error(res.error ?? 'Tạo phòng thất bại')
      }
    })
  }

  return (
    <Backdrop>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-12">
        <Link
          href="/"
          className="self-start inline-flex items-center gap-1 text-xs uppercase tracking-widest text-muted-foreground hover:text-accent transition-colors"
        >
          <ArrowLeft className="size-3.5" /> Trang chủ
        </Link>
        <h1 className="text-display text-4xl font-bold">
          Tạo <span className="text-accent neon-text-cyan">phòng</span>
        </h1>

        {/* Min players to end setting */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5 text-accent" /> Cài đặt trận đấu
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">
                Kết thúc khi còn lại&nbsp;
                <span className="text-accent">{minPlayersToEnd}</span>&nbsp;người chiến thắng
              </span>
              <span className="text-xs text-muted-foreground">
                Trò chơi sẽ tự kết thúc khi số người chơi còn lại ≤ giá trị này (1 = người cuối cùng đứng vững).
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
                  Ngưỡng cao — đảm bảo phòng có ≥ {minPlayersToEnd} người tham gia, không trận sẽ kết thúc ngay khi bắt đầu.
                </span>
              )}
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileJson className="size-5 text-accent" /> Nạp Quiz (JSON)
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-3">
              <label>
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])}
                />
                <span className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-border bg-card/40 px-4 text-sm font-semibold hover:border-accent/50">
                  <Upload className="size-4" /> Chọn file
                </span>
              </label>
              <Button variant="outline" onClick={useSample}>Dùng quiz mẫu</Button>
            </div>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={'{ "title": "...", "questions": [ { "text": "...", "correctAnswerId": 1, "answers": [...] } ] }'}
              spellCheck={false}
              className="h-56 w-full resize-none rounded-lg border border-border bg-input/60 p-3 font-mono text-xs text-foreground outline-none focus:border-accent/60"
            />
            <Button size="lg" onClick={create} disabled={busy || !raw.trim()} className="gap-2">
              <Rocket className="size-5" /> {busy ? 'Đang tạo...' : 'Tạo phòng'}
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Format: mỗi câu hỏi cần ≥2 đáp án và một trường{' '}
          <code className="text-accent">&quot;correctAnswerId&quot;</code> trỏ tới id đáp án đúng.
        </p>
      </main>
    </Backdrop>
  )
}
