import type { Quiz, QuizDifficulty, QuizQuestion } from '@/types/events'

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
function parseDifficulty(value: unknown): QuizDifficulty {
  return value === 'easy' || value === 'medium' || value === 'hard' ? value : 'medium'
}

export function parseQuiz(raw: unknown): Quiz {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('File bộ câu hỏi phải là đối tượng JSON')
  }
  const obj = raw as Record<string, unknown>
  const title = typeof obj.title === 'string' && obj.title.trim() ? obj.title.trim() : 'Bộ câu hỏi chưa đặt tên'

  if (!Array.isArray(obj.questions) || obj.questions.length === 0) {
    throw new Error('Bộ câu hỏi phải chứa mảng "questions" và không được để trống')
  }

  const questions: QuizQuestion[] = obj.questions.map((q, qi) => {
    if (typeof q !== 'object' || q === null) {
      throw new Error(`Câu hỏi #${qi + 1} không phải là đối tượng`)
    }
    const qo = q as Record<string, unknown>
    const text = typeof qo.text === 'string' ? qo.text.trim() : ''
    if (!text) throw new Error(`Câu hỏi #${qi + 1} thiếu trường "text"`)

    if (!Array.isArray(qo.answers) || qo.answers.length < 2) {
      throw new Error(`Câu hỏi #${qi + 1} phải có ít nhất 2 đáp án`)
    }

    const answers = qo.answers.map((a, ai) => {
      const ao = (a ?? {}) as Record<string, unknown>
      const atext = typeof ao.text === 'string' ? ao.text.trim() : ''
      if (!atext) throw new Error(`Câu hỏi #${qi + 1} đáp án #${ai + 1} thiếu trường "text"`)
      return {
        id: typeof ao.id === 'number' ? ao.id : ai + 1,
        text: atext,
      }
    })

    // Validate correctAnswerId
    const correctAnswerId = qo.correctAnswerId
    if (typeof correctAnswerId !== 'number') {
      throw new Error(`Câu hỏi #${qi + 1} thiếu "correctAnswerId" (phải là số khớp với id của một đáp án)`)
    }
    if (!answers.some((a) => a.id === correctAnswerId)) {
      throw new Error(
        `Câu hỏi #${qi + 1} "correctAnswerId" (${correctAnswerId}) không khớp với bất kỳ id đáp án nào`
      )
    }

    return {
      id: typeof qo.id === 'string' ? qo.id : `q${qi + 1}`,
      text,
      difficulty: parseDifficulty(qo.difficulty),
      timeLimitSec: 20, // internal default — not read from JSON
      correctAnswerId,
      answers,
    }
  })

  return { title, questions }
}
