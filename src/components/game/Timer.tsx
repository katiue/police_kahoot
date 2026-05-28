'use client'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Counts down to an absolute server time (endsAt). Client only renders —
 * never feeds back into scoring. Recomputes from server clock each tick so
 * tab-throttling can't desync it.
 */
export function Timer({ endsAt, timeLimitSec }: { endsAt: number; timeLimitSec: number }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, endsAt - Date.now()))

  useEffect(() => {
    setRemaining(Math.max(0, endsAt - Date.now()))
    const id = setInterval(() => {
      setRemaining(Math.max(0, endsAt - Date.now()))
    }, 100)
    return () => clearInterval(id)
  }, [endsAt])

  const secs = Math.ceil(remaining / 1000)
  const pct = Math.max(0, Math.min(100, (remaining / (timeLimitSec * 1000)) * 100))
  const urgent = secs <= 5

  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          'flex size-14 items-center justify-center rounded-full border-2 text-2xl font-bold tabular-nums',
          urgent
            ? 'border-strike text-strike neon-text-cyan'
            : 'border-accent text-accent'
        )}
        style={urgent ? { textShadow: '0 0 18px rgba(255,61,61,0.85)' } : undefined}
      >
        {secs}
      </div>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[rgba(0,212,255,0.08)]">
        <div
          className={cn('h-full rounded-full transition-[width] duration-100 ease-linear', urgent ? 'bg-strike' : 'bg-accent')}
          style={{
            width: `${pct}%`,
            boxShadow: urgent
              ? '0 0 12px rgba(255,61,61,0.7)'
              : '0 0 10px rgba(0,212,255,0.6)',
          }}
        />
      </div>
    </div>
  )
}
