import { describe, it, expect } from 'vitest'
import { parseQuiz } from '@/lib/quiz'

const validQuestion = {
  text: 'What?',
  correctAnswerId: 1,
  answers: [
    { id: 1, text: 'a' },
    { id: 2, text: 'b' },
  ],
}

describe('parseQuiz — top-level shape', () => {
  it('rejects non-object input', () => {
    expect(() => parseQuiz(null)).toThrow(/đối tượng JSON/)
    expect(() => parseQuiz('str')).toThrow(/đối tượng JSON/)
    expect(() => parseQuiz(42)).toThrow(/đối tượng JSON/)
    expect(() => parseQuiz(undefined)).toThrow(/đối tượng JSON/)
  })

  it('rejects missing/empty questions array', () => {
    expect(() => parseQuiz({ title: 't' })).toThrow(/questions/)
    expect(() => parseQuiz({ questions: [] })).toThrow(/questions/)
    expect(() => parseQuiz({ questions: 'nope' })).toThrow(/questions/)
  })

  it('defaults a missing/blank title', () => {
    expect(parseQuiz({ questions: [validQuestion] }).title).toBe('Bộ câu hỏi chưa đặt tên')
    expect(parseQuiz({ title: '   ', questions: [validQuestion] }).title).toBe('Bộ câu hỏi chưa đặt tên')
  })

  it('trims a provided title', () => {
    expect(parseQuiz({ title: '  Hello  ', questions: [validQuestion] }).title).toBe('Hello')
  })
})

describe('parseQuiz — question validation', () => {
  it('rejects a non-object question', () => {
    expect(() => parseQuiz({ questions: [null] })).toThrow(/#1 không phải/)
    expect(() => parseQuiz({ questions: ['x'] })).toThrow(/#1 không phải/)
  })

  it('rejects a question with missing/blank text', () => {
    expect(() => parseQuiz({ questions: [{ ...validQuestion, text: '' }] })).toThrow(/#1 thiếu trường "text"/)
    expect(() => parseQuiz({ questions: [{ ...validQuestion, text: '   ' }] })).toThrow(/#1 thiếu trường "text"/)
    expect(() => parseQuiz({ questions: [{ correctAnswerId: 1, answers: validQuestion.answers }] })).toThrow(/#1 thiếu trường "text"/)
  })

  it('requires at least 2 answers', () => {
    expect(() => parseQuiz({ questions: [{ text: 'q', correctAnswerId: 1, answers: [{ id: 1, text: 'a' }] }] })).toThrow(/ít nhất 2 đáp án/)
    expect(() => parseQuiz({ questions: [{ text: 'q', correctAnswerId: 1, answers: [] }] })).toThrow(/ít nhất 2 đáp án/)
    expect(() => parseQuiz({ questions: [{ text: 'q', correctAnswerId: 1 }] })).toThrow(/ít nhất 2 đáp án/)
  })

  it('rejects an answer with blank text', () => {
    expect(() => parseQuiz({ questions: [{ text: 'q', correctAnswerId: 1, answers: [{ id: 1, text: 'a' }, { id: 2, text: '  ' }] }] })).toThrow(/đáp án #2 thiếu/)
  })

  it('reports the correct (1-based) index in errors for later questions', () => {
    expect(() => parseQuiz({ questions: [validQuestion, { ...validQuestion, text: '' }] })).toThrow(/#2 thiếu trường "text"/)
  })
})

describe('parseQuiz — correctAnswerId', () => {
  it('requires a numeric correctAnswerId', () => {
    expect(() => parseQuiz({ questions: [{ text: 'q', answers: validQuestion.answers }] })).toThrow(/thiếu "correctAnswerId"/)
    expect(() => parseQuiz({ questions: [{ text: 'q', correctAnswerId: '1', answers: validQuestion.answers }] })).toThrow(/thiếu "correctAnswerId"/)
  })

  it('requires correctAnswerId to match an answer id', () => {
    expect(() => parseQuiz({ questions: [{ text: 'q', correctAnswerId: 99, answers: validQuestion.answers }] })).toThrow(/không khớp/)
  })

  it('accepts correctAnswerId of 0 when an answer has id 0', () => {
    const quiz = parseQuiz({ questions: [{ text: 'q', correctAnswerId: 0, answers: [{ id: 0, text: 'a' }, { id: 1, text: 'b' }] }] })
    expect(quiz.questions[0].correctAnswerId).toBe(0)
  })
})

describe('parseQuiz — normalization defaults', () => {
  it('auto-generates question id and answer ids when absent', () => {
    const quiz = parseQuiz({ questions: [{ text: 'q', correctAnswerId: 1, answers: [{ text: 'a' }, { text: 'b' }] }] })
    expect(quiz.questions[0].id).toBe('q1')
    expect(quiz.questions[0].answers.map((a) => a.id)).toEqual([1, 2])
  })

  it('preserves explicit string question id and numeric answer ids', () => {
    const quiz = parseQuiz({ questions: [{ id: 'custom', text: 'q', correctAnswerId: 5, answers: [{ id: 5, text: 'a' }, { id: 9, text: 'b' }] }] })
    expect(quiz.questions[0].id).toBe('custom')
    expect(quiz.questions[0].answers.map((a) => a.id)).toEqual([5, 9])
  })

  it('forces timeLimitSec to the internal default of 20 (ignores JSON value)', () => {
    const quiz = parseQuiz({ questions: [{ ...validQuestion, timeLimitSec: 5 }] })
    expect(quiz.questions[0].timeLimitSec).toBe(20)
  })

  it('defaults unknown difficulty to medium, preserves valid ones', () => {
    expect(parseQuiz({ questions: [{ ...validQuestion, difficulty: 'spicy' }] }).questions[0].difficulty).toBe('medium')
    expect(parseQuiz({ questions: [{ ...validQuestion, difficulty: 'hard' }] }).questions[0].difficulty).toBe('hard')
    expect(parseQuiz({ questions: [{ ...validQuestion }] }).questions[0].difficulty).toBe('medium')
  })

  it('trims answer text', () => {
    const quiz = parseQuiz({ questions: [{ text: 'q', correctAnswerId: 1, answers: [{ id: 1, text: '  a  ' }, { id: 2, text: 'b' }] }] })
    expect(quiz.questions[0].answers[0].text).toBe('a')
  })
})
