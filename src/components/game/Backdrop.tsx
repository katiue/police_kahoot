import { cn } from '@/lib/utils'

/** Full-screen cybersec backdrop: navy + circuit grid + corner glows. */
export function Backdrop({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('relative min-h-screen w-full overflow-hidden bg-background text-foreground', className)}>
      <div className="bg-glow pointer-events-none absolute inset-0" />
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-70" />
      <div className="relative z-10 flex min-h-screen flex-col">{children}</div>
    </div>
  )
}
