'use client'
import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Auto-reload the page after N ms when an error is caught. 0 disables. */
  autoReloadMs?: number
}

interface State {
  error: Error | null
  countdown: number
}

/**
 * Catches render errors so the projector never goes blank mid-event.
 * Shows a brief notice + counts down to a window.location.reload() so the
 * audience sees recovery instead of a white screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(props: Props) {
    super(props)
    this.state = { error: null, countdown: Math.ceil((props.autoReloadMs ?? 10000) / 1000) }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: unknown): void {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught:', error, info)
  }

  componentDidUpdate(_: Props, prev: State): void {
    if (!prev.error && this.state.error) {
      const total = this.props.autoReloadMs ?? 10000
      if (total <= 0) return
      this.timer = setInterval(() => {
        this.setState((s) => {
          if (s.countdown <= 1) {
            if (this.timer) clearInterval(this.timer)
            if (typeof window !== 'undefined') window.location.reload()
            return { countdown: 0 }
          }
          return { countdown: s.countdown - 1 }
        })
      }, 1000)
    }
  }

  componentWillUnmount(): void {
    if (this.timer) clearInterval(this.timer)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-4 bg-background/95 backdrop-blur-sm p-8 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-red-400">
          Sự cố hiển thị
        </p>
        <p className="text-2xl font-bold text-foreground">Đang khôi phục…</p>
        <p className="text-sm text-muted-foreground">
          Tải lại sau {this.state.countdown}s
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2 text-xs uppercase tracking-widest text-accent hover:bg-accent/20"
        >
          Tải lại ngay
        </button>
      </div>
    )
  }
}
