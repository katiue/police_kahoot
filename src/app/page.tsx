import Link from 'next/link'
import { Backdrop } from '@/components/game/Backdrop'
import { Button } from '@/components/ui/button'
import { ShieldCheck, Users, MonitorPlay } from 'lucide-react'

export default function HomePage() {
  return (
    <Backdrop>
      <main className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-16">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="standby-badge inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/5 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-accent">
            <ShieldCheck className="size-4" /> Chống Lừa Đảo Edition
          </span>
          <h1 className="text-display text-6xl font-bold text-foreground neon-text-white sm:text-7xl">
            POLICE <span className="text-accent neon-text-cyan">KAHOOT</span>
          </h1>
          <p className="max-w-md text-muted-foreground">
            Realtime quiz battle. Host tạo phòng, người chơi quét QR / nhập PIN tham gia, trả lời nhanh ăn điểm cao.
          </p>
        </div>

        <div className="grid w-full max-w-3xl grid-cols-1 gap-5 sm:grid-cols-2">
          <Link href="/host" className="hud-frame-full group rounded-xl p-px">
            <div className="flex h-full flex-col items-center gap-4 rounded-xl bg-card/60 p-8 text-center transition-all group-hover:bg-card">
              <MonitorPlay className="size-12 text-primary" />
              <div>
                <h2 className="text-xl font-bold">Tôi là Host</h2>
                <p className="mt-1 text-sm text-muted-foreground">Tạo phòng, nạp quiz, điều khiển game</p>
              </div>
              <Button variant="default" size="lg" className="w-full">Tạo phòng</Button>
            </div>
          </Link>

          <Link href="/play" className="hud-frame-full group rounded-xl p-px">
            <div className="flex h-full flex-col items-center gap-4 rounded-xl bg-card/60 p-8 text-center transition-all group-hover:bg-card">
              <Users className="size-12 text-accent" />
              <div>
                <h2 className="text-xl font-bold">Tôi là Người chơi</h2>
                <p className="mt-1 text-sm text-muted-foreground">Nhập PIN + nickname để vào phòng</p>
              </div>
              <Button variant="accent" size="lg" className="w-full">Tham gia</Button>
            </div>
          </Link>
        </div>
      </main>
      <footer className="relative z-10 pb-6 text-center text-xs text-muted-foreground">
        police-kahoot · realtime quiz · Next.js + Socket.IO
      </footer>
    </Backdrop>
  )
}
