'use client'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Radial countdown to an absolute server time (endsAt).
 * Client only renders — never feeds back into scoring.
 * Big digit sits inside the ring; ring sweeps from full to empty.
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
  const pct = Math.max(0, Math.min(1, remaining / (timeLimitSec * 1000)))
  const urgent = secs <= 5

  const radius = 34
  const circ = 2 * Math.PI * radius
  const dashOffset = circ * (1 - pct)

  return (
    <div
      className={cn(
        'relative inline-flex size-20 items-center justify-center',
        urgent && 'timer-radial-alert rounded-full'
      )}
      role="timer"
      aria-label={`Còn ${secs} giây`}
    >
      <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90">
        <circle
          cx="40"
          cy="40"
          r={radius}
          className="timer-radial-track"
        />
        <circle
          cx="40"
          cy="40"
          r={radius}
          className={cn('timer-radial-progress', urgent ? 'stroke-[var(--strike)]' : 'stroke-[var(--accent)]')}
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
          style={{ stroke: urgent ? 'var(--strike)' : 'var(--accent)' }}
        />
      </svg>
      <span
        className={cn(
          'relative text-3xl font-bold tabular-nums',
          urgent ? 'text-[var(--strike)]' : 'text-[var(--accent)]'
        )}
        style={
          urgent
            ? { textShadow: '0 0 18px rgba(255,61,61,0.85)' }
            : { textShadow: '0 0 14px rgba(0,212,255,0.5)' }
        }
      >
        {secs}
      </span>
    </div>
  )
}
