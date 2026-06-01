'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Backdrop } from '@/components/game/Backdrop'
import { Button } from '@/components/ui/button'
import { PoliceEmblem } from '@/components/game/PoliceEmblem'
import { Users, MonitorPlay, ShieldCheck, Zap } from 'lucide-react'

export default function HomePage() {
  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => {
    setIsMounted(true)
  }, [])

  return (
    <Backdrop>
      {/* ── Header — police emblem + department name ── */}
      <header className="relative z-20 w-full bg-transparent px-4 py-4 md:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-center">
            <a
              href="https://bocongan.gov.vn/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Cục An Ninh Mạng và Phòng, Chống Tội Phạm Sử Dụng Công Nghệ Cao"
              className="inline-flex"
            >
              <PoliceEmblem
                className="h-16 w-auto object-contain md:h-20"
                style={{ filter: 'drop-shadow(0 0 14px rgba(255,213,74,0.4))' }}
              />
            </a>
            <p className="whitespace-pre-line text-center text-[0.52rem] font-medium leading-snug tracking-[0.08em] text-white md:text-[0.82rem]">
              {`CỤC AN NINH MẠNG VÀ PHÒNG, CHỐNG\nTỘI PHẠM SỬ DỤNG CÔNG NGHỆ CAO`}
            </p>
          </div>
        </div>
      </header>

      {/* ── Hero Content ── */}
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 py-12 md:py-16">

        {/* Premium Tech HUD Screen Frame */}
        <div className="tech-screen tech-screen-boot mx-auto w-full max-w-4xl px-6 py-14 text-center md:px-12 md:py-16">
          <span className="tech-hud-grid" aria-hidden />
          <span className="tech-data-stream tech-data-stream-left" aria-hidden />
          <span className="tech-data-stream tech-data-stream-right" aria-hidden />
          <span className="tech-corner tech-corner-tl" aria-hidden />
          <span className="tech-corner tech-corner-tr" aria-hidden />
          <span className="tech-corner tech-corner-bl" aria-hidden />
          <span className="tech-corner tech-corner-br" aria-hidden />

          {/* Screen inner content */}
          <div className="tech-screen-content flex flex-col items-center">

            {/* Tag Badge */}
            <div className="inline-flex items-center gap-2 bg-[rgba(0,191,255,0.08)] border border-[rgba(0,191,255,0.22)] text-[var(--primary)] px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-[0.16em] mb-6">
              <ShieldCheck className="size-4 text-[var(--primary)]" />
              An Toàn Mạng
            </div>

            {/* Giant Cyber Title */}
            <h1 className="cyber-title tech-render-title text-4xl font-extrabold tracking-wider text-balance leading-[1.1] md:text-6xl max-w-3xl mb-4">
              RUNG CHUÔNG <span className="text-[var(--primary)] text-glow-real italic">VÀNG</span>
            </h1>

            {/* Description */}
            <p className="max-w-xl text-sm md:text-base leading-relaxed text-[var(--muted-foreground)] mb-8">
              Trò chơi kiểm tra kiến thức an toàn mạng theo thể thức loại trực tiếp — hệ thống thực chiến đến khi còn người cuối cùng đứng vững.
            </p>

            {/* Feature Chips */}
            <div className="tech-chip-rack flex flex-wrap justify-center gap-3 mb-10">
              <div className="cyber-chip text-xs font-semibold uppercase tracking-wider">
                <Zap className="size-3.5" />
                Realtime
              </div>
              <div className="cyber-chip text-xs font-semibold uppercase tracking-wider">
                <Users className="size-3.5" />
                Nhiều người chơi
              </div>
              <div className="cyber-chip text-xs font-semibold uppercase tracking-wider">
                <ShieldCheck className="size-3.5" />
                Loại trực tiếp
              </div>
            </div>

            {/* Glowing Buttons Side-by-side */}
            <div className="tech-start-wrap flex flex-col sm:flex-row gap-4 justify-center w-full max-w-md">
              <Link href="/host" className="flex-1">
                <Button size="lg" className="tech-start-button w-full h-12 uppercase font-bold tracking-wider text-sm gap-2">
                  <MonitorPlay className="size-4" />
                  Tôi là Host
                </Button>
              </Link>
              <Link href="/play" className="flex-1">
                <Button size="lg" variant="accent" className="tech-start-button w-full h-12 uppercase font-bold tracking-wider text-sm gap-2 bg-[var(--accent)] text-[var(--accent-foreground)] shadow-[0_0_24px_rgba(127,219,255,0.25)] hover:bg-[var(--accent)]/90">
                  <Users className="size-4" />
                  Tôi là Người chơi
                </Button>
              </Link>
            </div>

          </div>
        </div>

      </main>
    </Backdrop>
  )
}

