import type { Quiz, QuizQuestion } from '@/types/events'

/**
 * Validate + normalize a parsed JSON object into a Quiz.
 * Throws Error(message) on the first problem so the host sees why a file failed.
 *
 * Accepted shape:
 * {
 *   "title": "string",
 *   "questions": [
 *     {
 *       "id": "q1",              // optional, auto-generated if missing
 *       "text": "string",
 *       "correctAnswerId": 1,    // id of the correct answer
 *       "answers": [
 *         { "id": 1, "text": "..." },
 *         { "id": 2, "text": "..." }
 *       ]
 *     }
 *   ]
 * }
 *
 * Notes:
 * - No "points" or "timeLimitSec" in JSON — server uses defaults (20s per question).
 * - No per-answer "correct" flag — use correctAnswerId instead.
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
      }
    })

    // Validate correctAnswerId
    const correctAnswerId = qo.correctAnswerId
    if (typeof correctAnswerId !== 'number') {
      throw new Error(`Question #${qi + 1} missing "correctAnswerId" (must be a number matching one answer id)`)
    }
    if (!answers.some((a) => a.id === correctAnswerId)) {
      throw new Error(
        `Question #${qi + 1} "correctAnswerId" (${correctAnswerId}) does not match any answer id`
      )
    }

    return {
      id: typeof qo.id === 'string' ? qo.id : `q${qi + 1}`,
      text,
      timeLimitSec: 60, // internal default — not read from JSON
      correctAnswerId,
      answers,
    }
  })

  return { title, questions }
}
