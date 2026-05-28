'use client'
import { cn } from '@/lib/utils'
import { Triangle, Diamond, Circle, Square } from 'lucide-react'
import type { PublicAnswer } from '@/types/events'

const TILE = [
  { bg: 'var(--opt-red)', Icon: Triangle },
  { bg: 'var(--opt-blue)', Icon: Diamond },
  { bg: 'var(--opt-yellow)', Icon: Circle },
  { bg: 'var(--opt-green)', Icon: Square },
  { bg: '#7c3aed', Icon: Triangle },
  { bg: '#0891b2', Icon: Diamond },
  { bg: '#db2777', Icon: Circle },
  { bg: '#ca8a04', Icon: Square },
]

/**
 * 2-column answer tiles (Kahoot-style shapes + colors).
 * Modes:
 *  - play:   clickable, highlights `selected`, locks after answer
 *  - reveal: shows correct/wrong + counts (host & post-answer player)
 */
export function AnswerGrid({
  answers,
  mode,
  selected,
  correctId,
  counts,
  disabled,
  onPick,
}: {
  answers: PublicAnswer[]
  mode: 'play' | 'reveal'
  selected?: number | null
  correctId?: number
  counts?: Record<number, number>
  disabled?: boolean
  onPick?: (id: number) => void
}) {
  return (
    <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
      {answers.map((a, i) => {
        const t = TILE[i % TILE.length]
        const Icon = t.Icon
        const isCorrect = mode === 'reveal' && correctId === a.id
        const isWrong = mode === 'reveal' && selected === a.id && correctId !== a.id
        const dim = mode === 'reveal' && !isCorrect
        return (
          <button
            key={a.id}
            disabled={disabled || mode === 'reveal'}
            onClick={() => onPick?.(a.id)}
            className={cn(
              'relative flex min-h-[64px] items-center gap-3 rounded-xl px-4 py-3 text-left text-base font-semibold text-white transition-all',
              'enabled:hover:scale-[1.02] enabled:active:scale-[0.99]',
              selected === a.id && mode === 'play' && 'ring-4 ring-white/80',
              isCorrect && 'glow-green ring-4 ring-[var(--correct)]',
              isWrong && 'glow-red ring-2 ring-[var(--strike)]',
              dim && 'opacity-45'
            )}
            style={{ background: t.bg }}
          >
            <Icon className="size-6 shrink-0 fill-white/90" />
            <span className="flex-1">{a.text}</span>
            {mode === 'reveal' && counts && (
              <span className="rounded-md bg-black/30 px-2 py-1 text-sm tabular-nums">
                {counts[a.id] ?? 0}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
