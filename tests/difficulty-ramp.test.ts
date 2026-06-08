import { describe, it, expect } from 'vitest'
import { buildDifficultyRampDeck } from '@/lib/difficulty-ramp'
import { makeQuestion } from './helpers'
import type { QuizDifficulty } from '@/types/events'

function bank(easy: number, medium: number, hard: number) {
  const qs = [
    ...Array.from({ length: easy }, (_, i) => makeQuestion({ id: `e${i}`, difficulty: 'easy' })),
    ...Array.from({ length: medium }, (_, i) => makeQuestion({ id: `m${i}`, difficulty: 'medium' })),
    ...Array.from({ length: hard }, (_, i) => makeQuestion({ id: `h${i}`, difficulty: 'hard' })),
  ]
  return qs
}

const diffOf = (id: string): QuizDifficulty => (id[0] === 'e' ? 'easy' : id[0] === 'm' ? 'medium' : 'hard')

describe('buildDifficultyRampDeck — completeness', () => {
  it('returns an empty deck for empty input', () => {
    expect(buildDifficultyRampDeck([])).toEqual([])
  })

  it('is a permutation of the input (no loss, no duplication)', () => {
    const input = bank(10, 10, 10)
    const deck = buildDifficultyRampDeck(input)
    expect(deck).toHaveLength(input.length)
    expect(new Set(deck.map((q) => q.id)).size).toBe(input.length)
    expect(new Set(deck.map((q) => q.id))).toEqual(new Set(input.map((q) => q.id)))
  })

  it('handles a single question', () => {
    const deck = buildDifficultyRampDeck([makeQuestion({ id: 'e0', difficulty: 'easy' })])
    expect(deck.map((q) => q.id)).toEqual(['e0'])
  })
})

describe('buildDifficultyRampDeck — single-difficulty banks', () => {
  it('emits all when only one difficulty exists (fallback covers other phases)', () => {
    for (const d of ['easy', 'medium', 'hard'] as const) {
      const input = Array.from({ length: 25 }, (_, i) => makeQuestion({ id: `${d[0]}${i}`, difficulty: d }))
      const deck = buildDifficultyRampDeck(input)
      expect(deck).toHaveLength(25)
      expect(new Set(deck.map((q) => q.id))).toEqual(new Set(input.map((q) => q.id)))
    }
  })
})

describe('buildDifficultyRampDeck — ramp shape', () => {
  it('opens with easy questions when plenty of easy exist', () => {
    // Phase 1 is 5 slots, 100% easy weight.
    const deck = buildDifficultyRampDeck(bank(20, 20, 20))
    const firstFive = deck.slice(0, 5).map((q) => diffOf(q.id))
    expect(firstFive.every((d) => d === 'easy')).toBe(true)
  })

  it('front-loads easy and back-loads hard (ramp trend)', () => {
    // Phase 1 is 100% easy; the final phase carries no easy weight. So easy
    // density must fall and hard density must rise across the deck. Compare
    // halves (robust to within-phase shuffling) rather than fixed positions.
    const deck = buildDifficultyRampDeck(bank(20, 20, 20))
    const half = Math.floor(deck.length / 2)
    const easyFirst = deck.slice(0, half).filter((q) => diffOf(q.id) === 'easy').length
    const easyLast = deck.slice(half).filter((q) => diffOf(q.id) === 'easy').length
    const hardFirst = deck.slice(0, half).filter((q) => diffOf(q.id) === 'hard').length
    const hardLast = deck.slice(half).filter((q) => diffOf(q.id) === 'hard').length
    expect(easyFirst).toBeGreaterThan(easyLast)
    expect(hardLast).toBeGreaterThan(hardFirst)
  })

  it('never exceeds available counts per difficulty', () => {
    const deck = buildDifficultyRampDeck(bank(3, 4, 5))
    const counts = { easy: 0, medium: 0, hard: 0 } as Record<QuizDifficulty, number>
    for (const q of deck) counts[diffOf(q.id)] += 1
    expect(counts).toEqual({ easy: 3, medium: 4, hard: 5 })
  })
})
