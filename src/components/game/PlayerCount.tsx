'use client'
import { cn } from '@/lib/utils'

/**
 * Big "answered / total" counter. Two presets:
 *   variant="projector"  → giant, dominates audience screen during a question
 *   variant="host"       → compact, fits a control-panel header row
 */
export function PlayerCount({
  answered,
  total,
  variant = 'host',
  className,
}: {
  answered: number
  total: number
  variant?: 'projector' | 'host'
  className?: string
}) {
  const pct = total > 0 ? Math.min(100, Math.round((answered / total) * 100)) : 0
  if (variant === 'projector') {
    return (
      <div className={cn('flex flex-col items-center gap-2', className)}>
        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground">
          Đã trả lời
        </span>
        <div className="flex items-baseline gap-3 font-mono tabular-nums leading-none">
          <span className="text-[8vw] font-bold text-[var(--accent)] neon-text-cyan">{answered}</span>
          <span className="text-[3vw] text-muted-foreground">/ {total}</span>
        </div>
        <div className="h-1.5 w-64 overflow-hidden rounded-full bg-[rgba(0,212,255,0.1)]">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-200 ease-out"
            style={{ width: `${pct}%`, boxShadow: '0 0 10px rgba(0,212,255,0.6)' }}
          />
        </div>
      </div>
    )
  }
  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Đã trả lời
      </span>
      <span className="font-mono text-lg font-bold tabular-nums text-[var(--accent)]">
        {answered}
      </span>
      <span className="font-mono text-xs text-muted-foreground">/ {total}</span>
    </div>
  )
}
