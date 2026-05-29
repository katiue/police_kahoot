'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { QrPanel } from '@/components/game/QrPanel'
import { ShieldCheck } from 'lucide-react'

const MARQUEE_ITEMS = [
  'CHỐNG LỪA ĐẢO',
  'ANTI-SCAM',
  'DIGITAL TRUST',
  'POLICE KAHOOT',
  'EVENT EDITION',
  'ONLINE SAFETY',
  'CYBER AWARENESS',
]

function FadeIn({
  children,
  className,
  delay = 0,
  y = 0,
  scale = 1,
  transition,
  isMounted,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  y?: number
  scale?: number
  transition?: any
  isMounted: boolean
}) {
  if (!isMounted) {
    return (
      <div className={className} style={{ opacity: 1, transform: 'none' }}>
        {children}
      </div>
    )
  }
  return (
    <motion.div
      initial={{ opacity: 0, y, scale }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={transition || { delay, duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function LobbyView() {
  const search = useSearchParams()
  const pin = (search.get('pin') || '').replace(/\D/g, '').slice(0, 6)
  const [joinUrl, setJoinUrl] = useState('')
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    if (pin) setJoinUrl(`${window.location.origin}/play?pin=${pin}`)
  }, [pin])

  return (
    <div className="lobby-root fixed inset-0 flex select-none flex-col overflow-hidden bg-background text-foreground">
      {/* radial corner glows + circuit grid */}
      <div className="bg-glow pointer-events-none absolute inset-0 z-0" />
      <div className="grid-bg pointer-events-none absolute inset-0 z-0 opacity-80" />

      {/* top bar */}
      <header className="relative z-10 border-b border-[rgba(0,191,255,0.15)] bg-transparent backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-8 py-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="size-7 text-accent" />
            <div className="flex flex-col leading-tight">
              <span className="text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground">
                Chống Lừa Đảo
              </span>
              <span className="text-sm font-semibold tracking-tight">Police Kahoot · v1</span>
            </div>
          </div>
          <span className="hidden items-center gap-2 text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground sm:inline-flex">
            <motion.span
              className="size-1.5 rounded-full bg-accent"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            />
            Player Display
          </span>
        </div>
      </header>

      {/* hero */}
      <section className="relative z-10 flex flex-1 flex-col overflow-hidden">
        {/* floating particles */}
        {isMounted && Array.from({ length: 22 }).map((_, i) => (
          <motion.div
            key={i}
            className={`pointer-events-none absolute rounded-full ${i % 4 === 0 ? 'bg-accent' : 'bg-primary'}`}
            style={{
              width: i % 3 === 0 ? 3 : 2,
              height: i % 3 === 0 ? 3 : 2,
              left: `${(i * 53 + 7) % 100}%`,
              top: `${(i * 37 + 11) % 100}%`,
              opacity: 0,
            }}
            animate={{ y: [0, -50, 0], opacity: [0, 0.7, 0] }}
            transition={{ duration: 3 + (i % 4), repeat: Infinity, delay: i * 0.25, ease: 'easeInOut' }}
          />
        ))}

        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-8 text-center">
          <FadeIn
            isMounted={isMounted}
            scale={0.85}
            transition={{ type: 'spring', stiffness: 220, delay: 0.1 }}
            className="flex flex-col items-center"
          >
            <div className="mb-8 flex items-baseline gap-3">
              <span className="font-mono text-xs tabular-nums text-muted-foreground">00</span>
              <span className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                EST. 2026 · Quiz Battle
              </span>
              <span className="font-mono text-xs text-muted-foreground">·</span>
            </div>

            <h1 className="text-display text-[15vw] font-bold neon-text-white sm:text-[12vw] lg:text-[10rem]">
              POLICE
              <br />
              <span className="text-accent neon-text-cyan font-light italic">Kahoot</span>
            </h1>

            <p className="mt-8 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
              Realtime quiz battle — phòng chống lừa đảo trực tuyến.
              <br className="hidden md:block" />
              <span className="font-semibold text-foreground">Quét QR · nhập PIN · trả lời nhanh ăn điểm cao.</span>
            </p>
          </FadeIn>

          {/* PIN block (only with ?pin) */}
          {pin && (
            <FadeIn
              isMounted={isMounted}
              y={20}
              delay={0.5}
              className="mt-10 flex flex-col items-center gap-1"
            >
              <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Game PIN</span>
              <span className="pin-display text-7xl font-bold text-accent neon-text-cyan">{pin}</span>
            </FadeIn>
          )}

          {/* standby badge */}
          <FadeIn
            isMounted={isMounted}
            y={20}
            delay={0.6}
            className="mt-10 flex flex-col items-center gap-4"
          >
            <div className="animate-pulse-glow inline-flex items-center gap-2.5 rounded-sm border border-accent/40 bg-accent/5 px-5 py-2">
              <motion.span
                className="size-1.5 rounded-full bg-accent"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-accent">Standing By</span>
            </div>
            <p className="text-sm tracking-wide text-muted-foreground">Chờ host bắt đầu trận đấu…</p>
          </FadeIn>
        </div>

        {/* QR bottom-right */}
        {joinUrl && (
          <FadeIn
            isMounted={isMounted}
            y={20}
            delay={1}
            className="absolute bottom-20 right-6 z-20 w-fit"
          >
            <QrPanel joinUrl={joinUrl} size={130} />
          </FadeIn>
        )}
      </section>

      {/* footer marquee */}
      <footer className="relative z-10 border-t border-[rgba(0,191,255,0.15)] bg-transparent backdrop-blur-sm">
        <div className="relative overflow-hidden py-3">
          <div className="animate-marquee flex w-max gap-8 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
              <span key={i} className="flex shrink-0 items-center gap-8">
                {item}
                <span className="size-1 rounded-full bg-accent" style={{ boxShadow: '0 0 6px rgba(0,212,255,0.85)' }} />
              </span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}

export default function LobbyPage() {
  return (
    <Suspense fallback={null}>
      <LobbyView />
    </Suspense>
  )
}
