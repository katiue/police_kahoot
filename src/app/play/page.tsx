'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Backdrop } from '@/components/game/Backdrop'
import { Button } from '@/components/ui/button'
import { getSocket } from '@/lib/socket-client'
import { cn } from '@/lib/utils'
import { PlayerAvatar, AVATAR_ICONS, AVATAR_COLORS, getAvatarIndex } from '@/components/game/PlayerAvatar'
import { LogIn, Edit2 } from 'lucide-react'


function JoinForm() {
  const router = useRouter()
  const search = useSearchParams()
  const [pin, setPin] = useState('')
  const [nickname, setNickname] = useState('')
  const [busy, setBusy] = useState(false)

  // Avatar selector state
  const [selectedIconIdx, setSelectedIconIdx] = useState<number | null>(null)
  const [selectedColorIdx, setSelectedColorIdx] = useState<number | null>(null)
  const [showSelector, setShowSelector] = useState(false)

  useEffect(() => {
    const p = search.get('pin')
    if (p) setPin(p.replace(/\D/g, '').slice(0, 6))
  }, [search])

  const effectiveNickname = nickname.trim() || 'Guest'

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
        const defaultIdx = getAvatarIndex(nick)
        const savedData = {
          playerId: res.playerId,
          nickname: nick,
          avatarIconIndex: selectedIconIdx !== null ? selectedIconIdx : defaultIdx.iconIndex,
          avatarColorIndex: selectedColorIdx !== null ? selectedColorIdx : defaultIdx.colorIndex,
        }
        sessionStorage.setItem(`pk:${cleanPin}`, JSON.stringify(savedData))
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

      {/* Dynamic Avatar Selector Section */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative group cursor-pointer" onClick={() => setShowSelector(true)}>
          <PlayerAvatar 
            nickname={effectiveNickname} 
            size="xl" 
            pulse 
            iconIndex={selectedIconIdx ?? undefined} 
            colorIndex={selectedColorIdx ?? undefined} 
          />
          <div className="absolute -bottom-1 -right-1 bg-accent hover:bg-accent/80 transition-colors p-1.5 rounded-full text-background shadow-md">
            <Edit2 className="size-3.5" />
          </div>
        </div>
        <button 
          onClick={() => setShowSelector(true)}
          className="text-xs font-bold uppercase tracking-widest text-accent hover:text-accent/80 transition-colors"
        >
          Chọn Avatar
        </button>
      </div>

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

      {/* Interactive Cyber Avatar Customizer Modal */}
      {showSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="hud-frame-quad relative w-full max-w-sm rounded-2xl p-6 flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-200">
            <span className="hud-corner-tr" aria-hidden />
            <span className="hud-corner-bl" aria-hidden />
            
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold uppercase tracking-widest text-accent">Tùy Chọn Đặc Vụ</h3>
              <button 
                onClick={() => setShowSelector(false)}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Đóng
              </button>
            </div>
            
            {/* Color Grid */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Màu Nhận Diện</span>
              <div className="grid grid-cols-8 gap-2">
                {AVATAR_COLORS.map((c, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedColorIdx(idx)}
                    className={cn(
                      "size-7 rounded-full transition-all border",
                      selectedColorIdx === idx || (selectedColorIdx === null && getAvatarIndex(effectiveNickname).colorIndex === idx)
                        ? "border-white scale-115 ring-2 ring-accent/40"
                        : "border-transparent hover:scale-105"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Icon Grid */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Phân Khu / Biểu Tượng</span>
              <div className="grid grid-cols-4 gap-3 bg-black/35 p-3 rounded-xl border border-border/20">
                {AVATAR_ICONS.map((IconFn, idx) => {
                  const activeColor = AVATAR_COLORS[selectedColorIdx !== null ? selectedColorIdx : getAvatarIndex(effectiveNickname).colorIndex]
                  const isActive = selectedIconIdx === idx || (selectedIconIdx === null && getAvatarIndex(effectiveNickname).iconIndex === idx)
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedIconIdx(idx)}
                      className={cn(
                        "aspect-square p-2.5 rounded-xl border flex items-center justify-center transition-all",
                        isActive
                          ? "border-accent bg-accent/10 scale-105"
                          : "border-border/30 hover:border-border/60 hover:bg-white/5"
                      )}
                    >
                      <div className="size-7">
                        {IconFn(isActive ? activeColor : '#64748b')}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <Button 
              size="lg" 
              variant="accent" 
              onClick={() => setShowSelector(false)} 
              className="mt-2"
            >
              Xác Nhận Đặc Vụ
            </Button>
          </div>
        </div>
      )}
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
