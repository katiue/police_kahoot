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
        <a
          href="https://bocongan.gov.vn/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Cục An Ninh Mạng và Phòng, Chống Tội Phạm Sử Dụng Công Nghệ Cao"
          className="inline-flex"
        >
          <PoliceEmblem className="h-20 w-20 drop-shadow-[0_0_16px_rgba(200,150,12,0.45)]" />
        </a>
        <p className="whitespace-pre-line text-center text-[0.55rem] font-medium leading-snug tracking-[0.08em] text-white">
          {`CỤC AN NINH MẠNG VÀ PHÒNG, CHỐNG\nTỘI PHẠM SỬ DỤNG CÔNG NGHỆ CAO`}
        </p>
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
      <div className="flex flex-col items-center gap-1 text-center">
        <a
          href="https://bocongan.gov.vn/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Cục An Ninh Mạng và Phòng, Chống Tội Phạm Sử Dụng Công Nghệ Cao"
          className="inline-flex"
        >
          <PoliceEmblem
            className="h-9 w-9 shrink-0 drop-shadow-[0_0_8px_rgba(200,150,12,0.5)]"
          />
        </a>
        <p className="whitespace-pre-line text-center text-[0.42rem] font-medium leading-snug tracking-[0.07em] text-white">
          {`CỤC AN NINH MẠNG VÀ PHÒNG, CHỐNG\nTỘI PHẠM SỬ DỤNG CÔNG NGHỆ CAO`}
        </p>
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
