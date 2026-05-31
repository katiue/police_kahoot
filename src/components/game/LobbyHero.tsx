'use client'
import { PoliceEmblem } from './PoliceEmblem'
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
      <div className="flex items-center gap-3.5 mb-2">
        <PoliceEmblem
          className="h-16 w-16 shrink-0"
          style={{ filter: 'drop-shadow(0 0 10px rgba(200,150,12,0.55))' }}
        />
        <div className="flex flex-col justify-center leading-tight">
          <span className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--foreground)]">CỤC AN NINH MẠNG</span>
          <span className="text-[9.5px] uppercase tracking-[0.12em] text-[var(--muted-foreground)] opacity-85">BỘ CÔNG AN</span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <p className="text-xs uppercase tracking-widest text-[var(--muted-foreground)]">Vào chơi tại</p>
        <p className="text-display text-2xl font-bold text-center">
          {joinUrl.replace(/^https?:\/\//, '') || 'localhost:3000/play'}
        </p>
        <div className="mt-2 flex flex-col items-center">
          <span className="text-xs uppercase tracking-widest text-[var(--muted-foreground)]">Game PIN</span>
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
