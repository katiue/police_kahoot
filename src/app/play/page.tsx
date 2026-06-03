'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { Backdrop } from '@/components/game/Backdrop'
import { Button } from '@/components/ui/button'
import { getSocket } from '@/lib/socket-client'
import { cn } from '@/lib/utils'
import { PlayerAvatar, AVATAR_ICONS, AVATAR_COLORS, getAvatarIndex } from '@/components/game/PlayerAvatar'
import { LogIn, ArrowLeft } from 'lucide-react'


function JoinForm() {
    const router = useRouter()
    const search = useSearchParams()
    const [pin, setPin] = useState('')
    const [nickname, setNickname] = useState('')
    const [busy, setBusy] = useState(false)
    const nicknameRef = useRef<HTMLInputElement>(null)

    // Avatar selector state
    const [selectedIconIdx, setSelectedIconIdx] = useState<number | null>(null)
    const [selectedColorIdx, setSelectedColorIdx] = useState<number | null>(null)

    useEffect(() => {
        const p = search.get('pin')
        if (p) {
            setPin(p.replace(/[^A-Za-z0-9]/g, '').slice(0, 12).toUpperCase())
            return
        }
        // Single-room event mode: ask the server which PIN is live so the player
        // doesn't have to type one in. Silent fail if no active room.
        fetch('/api/active-room', { cache: 'no-store' })
            .then((r) => r.json())
            .then((d: { pin?: string | null }) => {
                if (d?.pin) setPin(String(d.pin).toUpperCase())
            })
            .catch(() => {
                /* no-op — fall back to manual entry */
            })
    }, [search])

    // Auto-advance to nickname when PIN is filled in (auto-resolved or 6-digit typed)
    useEffect(() => {
        const ready = pin.length >= 4
        if (ready && nicknameRef.current && document.activeElement !== nicknameRef.current) {
            nicknameRef.current.focus()
        }
    }, [pin])

    const effectiveNickname = nickname.trim() || 'Guest'

    function join() {
        const cleanPin = pin.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
        const nick = nickname.trim()
        if (cleanPin.length < 4) return toast.error('PIN phải có ít nhất 4 ký tự')
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
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-5 px-6 py-8">
            <Link
                href="/"
                className="self-start inline-flex items-center gap-1 text-xs uppercase tracking-widest text-muted-foreground hover:text-accent transition-colors"
            >
                <ArrowLeft className="size-3.5" /> Trang chủ
            </Link>
            <h1 className="text-display text-center text-3xl font-bold">
                Tham <span className="text-accent neon-text-cyan">gia</span>
            </h1>

            {/* Inline Avatar Selector */}
            <div className="flex flex-col items-center gap-3">
                <PlayerAvatar
                    nickname={effectiveNickname}
                    size="xl"
                    pulse
                    iconIndex={selectedIconIdx ?? undefined}
                    colorIndex={selectedColorIdx ?? undefined}
                />

                {/* Color swatches */}
                <div className="flex gap-1.5">
                    {AVATAR_COLORS.map((c, idx) => {
                        const isActive =
                            selectedColorIdx === idx ||
                            (selectedColorIdx === null && getAvatarIndex(effectiveNickname).colorIndex === idx)
                        return (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => setSelectedColorIdx(idx)}
                                aria-label={`Màu ${idx + 1}`}
                                className={cn(
                                    'size-5 rounded-full border transition-all',
                                    isActive ? 'border-white scale-125 ring-2 ring-accent/40' : 'border-transparent hover:scale-110'
                                )}
                                style={{ backgroundColor: c }}
                            />
                        )
                    })}
                </div>

                {/* Icon swatches */}
                <div className="flex flex-wrap justify-center gap-1.5 max-w-sm">
                    {AVATAR_ICONS.map((IconFn, idx) => {
                        const activeColor =
                            AVATAR_COLORS[
                            selectedColorIdx !== null
                                ? selectedColorIdx
                                : getAvatarIndex(effectiveNickname).colorIndex
                            ]
                        const isActive =
                            selectedIconIdx === idx ||
                            (selectedIconIdx === null && getAvatarIndex(effectiveNickname).iconIndex === idx)
                        return (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => setSelectedIconIdx(idx)}
                                aria-label={`Biểu tượng ${idx + 1}`}
                                className={cn(
                                    'flex size-8 items-center justify-center rounded-lg border transition-all',
                                    isActive
                                        ? 'border-accent bg-accent/10 scale-105'
                                        : 'border-border/30 hover:border-border/60 hover:bg-white/5'
                                )}
                            >
                                <div className="size-5">{IconFn(isActive ? activeColor : '#64748b')}</div>
                            </button>
                        )
                    })}
                </div>
            </div>

            <input
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 12))}
                autoFocus={!pin}
                placeholder="Game PIN"
                className="pin-display h-14 w-full rounded-xl border border-border bg-input/60 text-center text-2xl font-bold text-accent outline-none focus:border-accent/70 uppercase"
            />
            <input
                ref={nicknameRef}
                value={nickname}
                onChange={(e) => setNickname(e.target.value.slice(0, 20))}
                placeholder="Nickname"
                onKeyDown={(e) => e.key === 'Enter' && join()}
                className="h-12 w-full rounded-xl border border-border bg-input/60 px-4 text-center text-lg font-semibold text-foreground outline-none focus:border-accent/70"
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
