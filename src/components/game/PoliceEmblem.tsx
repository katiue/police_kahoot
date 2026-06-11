import type React from 'react'
import { cn } from '@/lib/utils'

interface PoliceEmblemProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  className?: string
}

interface PoliceBrandingProps {
  className?: string
  emblemClassName?: string
  labelClassName?: string
  emblemStyle?: React.CSSProperties
}

const POLICE_DEPARTMENT_LABEL = `CỤC AN NINH MẠNG VÀ PHÒNG, CHỐNG\nTỘI PHẠM SỬ DỤNG CÔNG NGHỆ CAO`
const POLICE_DEPARTMENT_ARIA = 'Cục An Ninh Mạng và Phòng, Chống Tội Phạm Sử Dụng Công Nghệ Cao'
const POLICE_EMBLEM_FILTER = 'drop-shadow(0 0 10px rgba(200,150,12,0.55))'

/**
 * Vietnamese Police Emblem — official logo copied from the sub-repository's origin/police branch.
 * Primary host brand — rendered from `/police_logo.png`.
 */
export function PoliceEmblem({ className, style, ...props }: PoliceEmblemProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/police_logo.png"
      alt="Cục An Ninh Mạng — Bộ Công An"
      className={className}
      style={{
        objectFit: 'contain',
        ...style,
      }}
      {...props}
    />
  )
}

export function PoliceBranding({
  className,
  emblemClassName,
  labelClassName,
  emblemStyle,
}: PoliceBrandingProps) {
  return (
    <div className={cn('flex flex-col items-center gap-2 text-center', className)}>
      <a
        href="https://bocongan.gov.vn/"
        target="_blank"
        rel="noopener noreferrer"
        aria-label={POLICE_DEPARTMENT_ARIA}
        className="inline-flex"
      >
        <PoliceEmblem
          className={cn('h-16 w-16 shrink-0', emblemClassName)}
          style={{
            filter: POLICE_EMBLEM_FILTER,
            ...emblemStyle,
          }}
        />
      </a>
      <p
        className={cn(
          'whitespace-pre-line text-center text-[0.6rem] font-medium leading-snug tracking-[0.08em] text-white',
          labelClassName
        )}
      >
        {POLICE_DEPARTMENT_LABEL}
      </p>
    </div>
  )
}

