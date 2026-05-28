'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Backdrop } from '@/components/game/Backdrop'
import { Button } from '@/components/ui/button'
import { getSocket } from '@/lib/socket-client'
import { LogIn } from 'lucide-react'

function JoinForm() {
  const router = useRouter()
  const search = useSearchParams()
  const [pin, setPin] = useState('')
  const [nickname, setNickname] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const p = search.get('pin')
    if (p) setPin(p.replace(/\D/g, '').slice(0, 6))
  }, [search])

  function join() {
    const cleanPin = pin.replace(/\D/g, '')
    const nick = nickname.trim()
    if (cleanPin.length !== 6) return toast.error('PIN gồm 6 chữ số')
    if (!nick) return toast.error('Nhập nickname')
    setBusy(true)
    const socket = getSocket()
    socket.emit('player:join', { pin: cleanPin, nickname: nick }, (res) => {
      setBusy(false)
      if (res.ok && res.playerId) {
        sessionStorage.setItem(`pk:${cleanPin}`, JSON.stringify({ playerId: res.playerId, nickname: nick }))
        router.push(`/play/${cleanPin}`)
      } else {
        toast.error(res.error ?? 'Vào phòng thất bại')
      }
    })
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-12">
      <h1 className="text-display text-center text-4xl font-bold">
        Tham <span className="text-accent neon-text-cyan">gia</span>
      </h1>
      <input
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        placeholder="Game PIN"
        className="pin-display h-16 w-full rounded-xl border border-border bg-input/60 text-center text-3xl font-bold text-accent outline-none focus:border-accent/70"
      />
      <input
        value={nickname}
        onChange={(e) => setNickname(e.target.value.slice(0, 20))}
        placeholder="Nickname"
        onKeyDown={(e) => e.key === 'Enter' && join()}
        className="h-14 w-full rounded-xl border border-border bg-input/60 px-4 text-center text-xl font-semibold text-foreground outline-none focus:border-accent/70"
      />
      <Button size="xl" variant="accent" onClick={join} disabled={busy} className="gap-2">
        <LogIn className="size-5" /> {busy ? 'Đang vào...' : 'Vào phòng'}
      </Button>
    </main>
  )
}

export default function PlayJoinPage() {
  return (
    <Backdrop>
      <Suspense fallback={null}>
        <JoinForm />
      </Suspense>
    </Backdrop>
  )
}
