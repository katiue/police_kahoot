import type { QuizDifficulty, QuizQuestion } from '@/types/events'

const DIFFICULTIES: QuizDifficulty[] = ['easy', 'medium', 'hard']

function shuffled<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function slotsFromWeights(
  total: number,
  weights: Array<{ difficulty: QuizDifficulty; weight: number }>
): QuizDifficulty[] {
  const base = weights.map((entry, index) => {
    const exact = total * entry.weight
    return {
      ...entry,
      index,
      count: Math.floor(exact),
      remainder: exact - Math.floor(exact),
    }
  })
  let assigned = base.reduce((sum, entry) => sum + entry.count, 0)
  const byRemainder = [...base].sort(
    (a, b) => b.remainder - a.remainder || a.index - b.index
  )

  for (const entry of byRemainder) {
    if (assigned >= total) break
    entry.count += 1
    assigned += 1
  }

  return shuffled(base.flatMap((entry) => Array(entry.count).fill(entry.difficulty)))
}

export function buildDifficultyRampDeck(questions: QuizQuestion[]): QuizQuestion[] {
  const pools = DIFFICULTIES.reduce(
    (acc, difficulty) => {
      acc[difficulty] = shuffled(questions.filter((question) => question.difficulty === difficulty))
      return acc
    },
    {} as Record<QuizDifficulty, QuizQuestion[]>
  )

  const deck: QuizQuestion[] = []
  const remainingCount = () => DIFFICULTIES.reduce((sum, difficulty) => sum + pools[difficulty].length, 0)
  const fallbackByDifficulty: Record<QuizDifficulty, QuizDifficulty[]> = {
    easy: ['easy', 'medium', 'hard'],
    medium: ['medium', 'easy', 'hard'],
    hard: ['hard', 'medium', 'easy'],
  }
  const take = (difficulty: QuizDifficulty) => {
    for (const candidate of fallbackByDifficulty[difficulty]) {
      const question = pools[candidate].pop()
      if (question) return question
    }
    return null
  }
  const appendPhase = (
    size: number,
    weights: Array<{ difficulty: QuizDifficulty; weight: number }>
  ) => {
    const phaseSize = Math.min(size, remainingCount())
    for (const difficulty of slotsFromWeights(phaseSize, weights)) {
      const question = take(difficulty)
      if (question) deck.push(question)
    }
  }

  appendPhase(5, [{ difficulty: 'easy', weight: 1 }])
  appendPhase(10, [
    { difficulty: 'easy', weight: 0.4 },
    { difficulty: 'medium', weight: 0.6 },
  ])
  appendPhase(10, [
    { difficulty: 'easy', weight: 0.2 },
    { difficulty: 'medium', weight: 0.5 },
    { difficulty: 'hard', weight: 0.3 },
  ])
  appendPhase(remainingCount(), [
    { difficulty: 'hard', weight: 0.7 },
    { difficulty: 'medium', weight: 0.3 },
  ])

  return deck
}
