'use client'
import { useEffect, useState } from 'react'
import { getSocket } from '@/lib/socket-client'
import { cn } from '@/lib/utils'

type Status = 'connected' | 'reconnecting' | 'disconnected'

/**
 * Small dot showing socket connection health.
 * Green = connected · Amber = reconnecting · Red = disconnected.
 * Read-only — listens to the singleton socket, no side effects.
 */
export function ConnectionDot({ className, label = true }: { className?: string; label?: boolean }) {
  const [status, setStatus] = useState<Status>('connected')

  useEffect(() => {
    const socket = getSocket()
    setStatus(socket.connected ? 'connected' : 'reconnecting')

    const onConnect = () => setStatus('connected')
    const onDisconnect = () => setStatus('reconnecting')
    const onReconnectAttempt = () => setStatus('reconnecting')
    const onReconnectFailed = () => setStatus('disconnected')

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.io.on('reconnect_attempt', onReconnectAttempt)
    socket.io.on('reconnect_failed', onReconnectFailed)

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.io.off('reconnect_attempt', onReconnectAttempt)
      socket.io.off('reconnect_failed', onReconnectFailed)
    }
  }, [])

  const color =
    status === 'connected' ? 'bg-emerald-400' : status === 'reconnecting' ? 'bg-amber-400' : 'bg-red-500'
  const text =
    status === 'connected' ? 'Đã kết nối' : status === 'reconnecting' ? 'Đang kết nối lại…' : 'Mất kết nối'

  return (
    <span
      className={cn('inline-flex items-center gap-1.5', className)}
      title={text}
      aria-live="polite"
      aria-label={text}
    >
      <span
        className={cn(
          'size-2 rounded-full',
          color,
          status !== 'disconnected' && 'animate-pulse'
        )}
      />
      {label && (
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{text}</span>
      )}
    </span>
  )
}
