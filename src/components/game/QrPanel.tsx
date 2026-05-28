'use client'
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

/** Renders a QR code that deep-links players straight into the join screen. */
export function QrPanel({ joinUrl, size = 180 }: { joinUrl: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string>('')

  useEffect(() => {
    QRCode.toDataURL(joinUrl, {
      width: size,
      margin: 1,
      color: { dark: '#00d4ff', light: '#010b1e' },
    })
      .then(setDataUrl)
      .catch(() => setDataUrl(''))
  }, [joinUrl, size])

  return (
    <div className="qr-panel flex flex-col items-center gap-2 rounded-xl border border-[var(--header-border)] bg-card p-3">
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dataUrl} alt="Join QR" width={size} height={size} className="rounded-md" />
      ) : (
        <div style={{ width: size, height: size }} className="animate-pulse rounded-md bg-muted" />
      )}
      <span className="text-xs text-muted-foreground">Quét để tham gia</span>
    </div>
  )
}
