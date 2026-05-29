'use client'
import { PoliceEmblem } from './PoliceEmblem'
import { ChongLuaDaoMark } from './ChongLuaDao'

/**
 * EventBranding — persistent dual-logo bar.
 *
 * Hierarchy (matching the event flyer):
 *  LEFT  → Police Emblem (primary host, larger)
 *  RIGHT → ChongLuaDao mark (supporting partner, smaller)
 *
 * Used in: Backdrop (all pages), page headers.
 * variant="bar"   — horizontal strip for page headers
 * variant="hero"  — stacked / centered for lobby/landing
 */
export function EventBranding({
  variant = 'bar',
  className = '',
}: {
  variant?: 'bar' | 'hero'
  className?: string
}) {
  if (variant === 'hero') {
    return (
      <div className={`flex flex-col items-center gap-3 ${className}`}>
        {/* Police emblem — dominant */}
        <PoliceEmblem className="h-20 w-20 drop-shadow-[0_0_16px_rgba(200,150,12,0.45)]" />
        <div className="flex flex-col items-center gap-0.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
            Cục An Ninh Mạng
          </p>
          <p className="text-[9px] uppercase tracking-[0.15em] text-[var(--muted-foreground)] opacity-70">
            Bộ Công An
          </p>
        </div>
        {/* Divider */}
        <div className="h-px w-16 bg-gradient-to-r from-transparent via-[rgba(0,212,255,0.3)] to-transparent" />
        {/* CLD mark — secondary */}
        <div className="flex items-center gap-2">
          <ChongLuaDaoMark className="h-6 w-6 opacity-80" />
          <span className="text-[10px] font-semibold text-[#22b36c] opacity-80">
            Chống Lừa Đảo
          </span>
        </div>
      </div>
    )
  }

  // Bar variant — horizontal, compact
  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      {/* Police (primary) — left */}
      <div className="flex items-center gap-2.5">
        <PoliceEmblem
          className="h-9 w-9 shrink-0 drop-shadow-[0_0_8px_rgba(200,150,12,0.5)]"
        />
        <div className="flex flex-col leading-tight">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--foreground)]">
            Cục An Ninh Mạng
          </span>
          <span className="text-[8.5px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
            Bộ Công An
          </span>
        </div>
      </div>

      {/* Separator */}
      <div className="h-6 w-px bg-[rgba(0,212,255,0.2)]" />

      {/* CLD (secondary) — right */}
      <div className="flex items-center gap-1.5">
        <ChongLuaDaoMark className="h-5 w-5 opacity-75" />
        <span className="text-[9px] font-semibold text-[#22b36c] opacity-75">
          Chống Lừa Đảo
        </span>
      </div>
    </div>
  )
}
