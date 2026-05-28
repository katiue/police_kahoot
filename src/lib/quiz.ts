import type { Quiz, QuizQuestion } from '@/types/events'

/**
 * Validate + normalize a parsed JSON object into a Quiz.
 * Throws Error(message) on the first problem so the host sees why a file failed.
 *
 * Accepted shape (lenient):
 * {
 *   "title": "string",
 *   "questions": [
 *     {
 *       "id": "q1",                 // optional, auto-generated if missing
 *       "text": "string",
 *       "timeLimitSec": 20,         // optional, default 20
 *       "points": 1000,             // optional, default 1000
 *       "answers": [
 *         { "id": 1, "text": "...", "correct": true }
 *       ]
 *     }
 *   ]
 * }
 */
export function parseQuiz(raw: unknown): Quiz {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Quiz file must be a JSON object')
  }
  const obj = raw as Record<string, unknown>
  const title = typeof obj.title === 'string' && obj.title.trim() ? obj.title.trim() : 'Untitled Quiz'

  if (!Array.isArray(obj.questions) || obj.questions.length === 0) {
    throw new Error('Quiz must have a non-empty "questions" array')
  }

  const questions: QuizQuestion[] = obj.questions.map((q, qi) => {
    if (typeof q !== 'object' || q === null) {
      throw new Error(`Question #${qi + 1} is not an object`)
    }
    const qo = q as Record<string, unknown>
    const text = typeof qo.text === 'string' ? qo.text.trim() : ''
    if (!text) throw new Error(`Question #${qi + 1} missing "text"`)

    if (!Array.isArray(qo.answers) || qo.answers.length < 2) {
      throw new Error(`Question #${qi + 1} needs at least 2 answers`)
    }

    const answers = qo.answers.map((a, ai) => {
      const ao = (a ?? {}) as Record<string, unknown>
      const atext = typeof ao.text === 'string' ? ao.text.trim() : ''
      if (!atext) throw new Error(`Question #${qi + 1} answer #${ai + 1} missing "text"`)
      return {
        id: typeof ao.id === 'number' ? ao.id : ai + 1,
        text: atext,
        correct: ao.correct === true,
      }
    })

    if (!answers.some((a) => a.correct)) {
      throw new Error(`Question #${qi + 1} has no correct answer (set "correct": true on one)`)
    }

    const timeLimitSec =
      typeof qo.timeLimitSec === 'number' && qo.timeLimitSec > 0 ? Math.round(qo.timeLimitSec) : 20
    const points = typeof qo.points === 'number' && qo.points > 0 ? Math.round(qo.points) : 1000

    return {
      id: typeof qo.id === 'string' ? qo.id : `q${qi + 1}`,
      text,
      timeLimitSec,
      points,
      answers,
    }
  })

  return { title, questions }
}
