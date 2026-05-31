'use client'

import { FormEvent } from 'react'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const HOST_LOGIN_STORAGE_KEY = 'pk:host-login-key'

export function HostAuthCard({
  loginKey,
  busy,
  error,
  onChange,
  onSubmit,
}: {
  loginKey: string
  busy?: boolean
  error?: string
  onChange: (value: string) => void
  onSubmit: () => void
}) {
  function submit(e: FormEvent) {
    e.preventDefault()
    onSubmit()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-5 backdrop-blur-md">
      <Card className="w-full max-w-md border-border/60 bg-card/80 shadow-[0_0_60px_rgba(0,212,255,0.16)]">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex size-12 items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-accent">
            <ShieldCheck className="size-6" />
          </div>
          <CardTitle className="text-display text-2xl font-bold">Host Login</CardTitle>
          <p className="text-sm text-muted-foreground">
            Nhập LOGIN_KEY để truy cập màn hình điều khiển.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Login key
              </span>
              <input
                value={loginKey}
                onChange={(e) => onChange(e.target.value)}
                type="password"
                placeholder="LOGIN_KEY"
                autoFocus
                className="h-12 w-full rounded-xl border border-border bg-input/70 px-4 text-center text-sm font-semibold text-foreground outline-none focus:border-accent/70"
              />
            </label>
            {error && <p className="text-sm font-semibold text-red-400">{error}</p>}
            <Button type="submit" size="lg" className="w-full gap-2" disabled={busy || !loginKey}>
              <KeyRound className="size-4" />
              {busy ? 'Đang xác thực...' : 'Authenticate'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
