import type React from 'react'

interface PoliceEmblemProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  className?: string
}

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

