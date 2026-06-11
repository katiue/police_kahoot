'use client'
import { PoliceBranding } from './PoliceEmblem'
import { QrPanel } from './QrPanel'
import { formatPin } from '@/lib/utils'

/**
 * Branded lobby hero block — police+CLD logos, join URL, big PIN, optional QR.
 * Shared between host lobby SSR fallback and the mounted lobby pane.
 */
export function LobbyHero({
  pin,
  joinUrl,
  showQr = false,
  connecting = false,
}: {
  pin: string
  joinUrl: string
  showQr?: boolean
  connecting?: boolean
}) {
  const formattedPin = formatPin(pin)
  return (
    <div className="flex flex-col items-center gap-8">
      <PoliceBranding className="mb-2" />

      <div className="flex flex-col items-center gap-2">
        <p className="text-xs uppercase tracking-widest text-[var(--muted-foreground)]">Vào chơi tại</p>
        <p className="text-display text-2xl font-bold text-center">
          {joinUrl.replace(/^https?:\/\//, '') || 'localhost:3000/play'}
        </p>
        <div className="mt-2 flex flex-col items-center">
          <span className="text-xs uppercase tracking-widest text-[var(--muted-foreground)]">Mã PIN</span>
          <span className="pin-display text-7xl font-bold text-[var(--accent)] neon-text-cyan">{formattedPin}</span>
        </div>
      </div>

      {showQr && joinUrl && <QrPanel joinUrl={joinUrl} />}

      {connecting && (
        <p className="text-sm text-[var(--muted-foreground)]">Đang kết nối server bảo mật…</p>
      )}
    </div>
  )
}
