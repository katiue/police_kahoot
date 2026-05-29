import { cn } from '@/lib/utils'

/** Full-screen cybersec backdrop: clean, subtle agency-grade cyber-shell. */
export function Backdrop({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('cyber-shell no-glow flex min-h-screen w-full flex-col text-foreground', className)}>
      {children}
    </div>
  )
}

