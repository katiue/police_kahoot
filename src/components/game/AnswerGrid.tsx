'use client'
import { cn } from '@/lib/utils'
import { Triangle, Diamond, Circle, Square, Check, X } from 'lucide-react'
import type { QuizAnswer } from '@/types/events'

/** Classic-Kahoot 4 tile palette (kept as design tokens, cycles for >4). */
const TILE = [
  { bg: 'var(--opt-red)', Icon: Triangle },
  { bg: 'var(--opt-blue)', Icon: Diamond },
  { bg: 'var(--opt-yellow)', Icon: Circle },
  { bg: 'var(--opt-green)', Icon: Square },
]

/**
 * Answer tiles. Single column on mobile, 2 cols ≥sm, 3+ when many answers fit.
 * - play:   clickable, highlights `selected`
 * - reveal: marks correct (green ring + check) and wrong-chosen (red ring + X)
 *           for color-blind safety alongside color cues
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
  answers: QuizAnswer[]
  mode: 'play' | 'reveal'
  selected?: number | null
  correctId?: number
  counts?: Record<number, number>
  disabled?: boolean
  onPick?: (id: number) => void
}) {
  const cols =
    answers.length <= 2
      ? 'sm:grid-cols-2'
      : answers.length <= 4
      ? 'sm:grid-cols-2'
      : 'sm:grid-cols-2 lg:grid-cols-3'

  return (
    <div className={cn('grid w-full grid-cols-1 gap-3', cols)}>
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
            aria-label={
              mode === 'reveal'
                ? isCorrect
                  ? `Đúng: ${a.text}`
                  : isWrong
                  ? `Sai: ${a.text}`
                  : a.text
                : a.text
            }
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

            {/* Color-blind safe verdict icons during reveal */}
            {isCorrect && (
              <span
                className="absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full bg-[var(--correct)] text-[var(--correct-foreground)] ring-2 ring-white/90"
                aria-hidden
              >
                <Check className="size-4" strokeWidth={3} />
              </span>
            )}
            {isWrong && (
              <span
                className="absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full bg-[var(--strike)] text-white ring-2 ring-white/90"
                aria-hidden
              >
                <X className="size-4" strokeWidth={3} />
              </span>
            )}

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
