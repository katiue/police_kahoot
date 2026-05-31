import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Keep room PINs visually consistent across host, lobby, and player routes. */
export function formatPin(pin: string): string {
  return pin
}

/** Safe haptic — no-op on devices without the Vibration API or with reduced motion. */
export function haptic(pattern: number | number[]): void {
  if (typeof window === 'undefined') return
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  try {
    navigator.vibrate(pattern)
  } catch {
    /* ignore — some browsers throw on user-gesture violations */
  }
}
