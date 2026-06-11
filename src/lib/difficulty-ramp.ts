import type { QuizDifficulty, QuizQuestion } from '@/types/events'

const DIFFICULTIES: QuizDifficulty[] = ['easy', 'medium', 'hard']
const RAMP_SLOTS: QuizDifficulty[] = ['easy', 'easy', 'easy', 'medium', 'medium', 'medium']

function shuffled<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
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

  for (let index = 0; index < questions.length; index += 1) {
    const targetDifficulty = RAMP_SLOTS[index] ?? 'hard'
    const question = take(targetDifficulty)
    if (question) deck.push(question)
  }

  return deck
}
