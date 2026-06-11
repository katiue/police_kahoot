import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { RoomManager } from '@/server/rooms'
import { makeMockIO, makeQuiz, type MockIO } from './helpers'
import type { Quiz } from '@/types/events'

let mock: MockIO
let mgr: RoomManager

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(0)
  mock = makeMockIO()
  mgr = new RoomManager(mock.io)
})
afterEach(() => {
  vi.useRealTimers()
})

/** Create a room with kahoot disabled (pure elimination) unless overridden. */
function createElim(quiz: Quiz, opts = {}) {
  return mgr.createRoom(quiz, { kahootThreshold: 0, randomizeQuestions: false, randomizeAnswers: false, ...opts })
}

/** Join a player and return its id. */
function join(pin: string, nick: string, socketId: string): string {
  mock.addSocket(socketId)
  const res = mgr.joinPlayer(pin, nick, socketId)
  if (!res.ok || !res.playerId) throw new Error(`join failed: ${res.error}`)
  return res.playerId
}

// ─────────────────────────────────────────────────────────────
describe('createRoom — options & defaults', () => {
  it('uses a fixed PIN normalized to upper-case trimmed', () => {
    const pin = mgr.createRoom(makeQuiz(3), {}, '  abc123 ')
    expect(pin).toBe('ABC123')
  })

  it('generates a 6-digit PIN when none fixed', () => {
    const pin = mgr.createRoom(makeQuiz(3))
    expect(pin).toMatch(/^\d{6}$/)
  })

  it('clamps invalid options to defaults', () => {
    const pin = mgr.createRoom(makeQuiz(3), { maxPlayers: -5, timeLimitSec: -1, minPlayersToEnd: 0, kahootThreshold: -3 })
    const room = mgr.getRoom(pin)!
    expect(room.maxPlayers).toBe(100) // invalid -> default 100
    expect(room.timeLimitSec).toBeNull() // <=0 -> null
    expect(room.minPlayersToEnd).toBe(1) // floored to min 1
    expect(room.kahootThreshold).toBe(10) // invalid -> default 10
  })

  it('rounds fractional numeric options', () => {
    const pin = mgr.createRoom(makeQuiz(3), { maxPlayers: 12.7, timeLimitSec: 9.4, kahootThreshold: 4.6 })
    const room = mgr.getRoom(pin)!
    expect(room.maxPlayers).toBe(13)
    expect(room.timeLimitSec).toBe(9)
    expect(room.kahootThreshold).toBe(5)
  })

  it('defaults questionOrderMode from randomizeQuestions flag', () => {
    expect(mgr.getRoom(mgr.createRoom(makeQuiz(3), { randomizeQuestions: false }))!.questionOrderMode).toBe('fixed')
    expect(mgr.getRoom(mgr.createRoom(makeQuiz(3), { randomizeQuestions: true }))!.questionOrderMode).toBe('full_random')
  })

  it('only keeps one room (single-room mode) — creating replaces', () => {
    const a = mgr.createRoom(makeQuiz(3))
    const b = mgr.createRoom(makeQuiz(3))
    expect(mgr.getRoom(a)).toBeUndefined()
    expect(mgr.getRoom(b)).toBeDefined()
  })

  it('emits a lobby snapshot and a rejoin nudge on create', () => {
    mgr.createRoom(makeQuiz(3), {}, 'ROOM1')
    expect(mock.byEvent('lobby:update').length).toBeGreaterThan(0)
    expect(mock.byTarget('ROOM1').some((e) => e.event === 'room:rejoin')).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────
describe('joinPlayer', () => {
  it('rejects a missing room', () => {
    expect(mgr.joinPlayer('NOPE', 'Bob', 's1').ok).toBe(false)
  })

  it('accepts a valid join and assigns a player id', () => {
    const pin = createElim(makeQuiz(3))
    const res = mgr.joinPlayer(pin, 'Bob', 's1')
    expect(res.ok).toBe(true)
    expect(res.playerId).toBeTruthy()
  })

  it('rejects duplicate nickname case-insensitively', () => {
    const pin = createElim(makeQuiz(3))
    join(pin, 'Alice', 's1')
    expect(mgr.joinPlayer(pin, 'ALICE', 's2').error).toMatch(/đã được sử dụng/)
  })

  it('rejects an invalid nickname', () => {
    const pin = createElim(makeQuiz(3))
    expect(mgr.joinPlayer(pin, 'a', 's1').error).toMatch(/quá ngắn/)
  })

  it('enforces maxPlayers', () => {
    const pin = createElim(makeQuiz(3), { maxPlayers: 1 })
    join(pin, 'Alice', 's1')
    expect(mgr.joinPlayer(pin, 'Bob', 's2').error).toMatch(/giới hạn tối đa/)
  })

  it('blocks new joins once the game has started', () => {
    const pin = createElim(makeQuiz(3))
    join(pin, 'Alice', 's1')
    join(pin, 'Bob', 's2')
    mgr.startGame(pin)
    expect(mgr.joinPlayer(pin, 'Carol', 's3').error).toMatch(/đã bắt đầu/)
  })

  it('blocks joins on an ended game', () => {
    const pin = createElim(makeQuiz(3))
    join(pin, 'Alice', 's1')
    mgr.endGame(pin)
    expect(mgr.joinPlayer(pin, 'Bob', 's2').error).toMatch(/đã kết thúc/)
  })

  it('reconnect path: rejoining with an existing playerId restores the socket even mid-game', () => {
    const pin = createElim(makeQuiz(3))
    const id = join(pin, 'Alice', 's1')
    join(pin, 'Bob', 's2')
    mgr.startGame(pin)
    const res = mgr.joinPlayer(pin, 'Alice', 's1-new', id)
    expect(res.ok).toBe(true)
    expect(res.playerId).toBe(id)
    expect(mgr.getRoom(pin)!.players.get(id)!.socketId).toBe('s1-new')
    expect(mgr.getRoom(pin)!.players.get(id)!.connected).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────
describe('kickPlayers & disconnect', () => {
  it('removes the player, emits player:kicked, and detaches from the room', () => {
    const pin = createElim(makeQuiz(3))
    const id = join(pin, 'Alice', 's1')
    const res = mgr.kickPlayers(pin, [id])
    expect(res.kicked).toBe(1)
    expect(mgr.getRoom(pin)!.players.has(id)).toBe(false)
    expect(mock.byTarget('s1').some((e) => e.event === 'player:kicked')).toBe(true)
    expect(mock.leftRooms).toContainEqual({ socketId: 's1', room: pin })
  })

  it('ignores unknown player ids without throwing', () => {
    const pin = createElim(makeQuiz(3))
    expect(mgr.kickPlayers(pin, ['ghost']).kicked).toBe(0)
  })

  it('markDisconnected flips connected=false and clears host', () => {
    const pin = createElim(makeQuiz(3))
    const id = join(pin, 'Alice', 's1')
    mgr.setHost(pin, 'host-sock')
    mgr.markDisconnected('s1')
    expect(mgr.getRoom(pin)!.players.get(id)!.connected).toBe(false)
    mgr.markDisconnected('host-sock')
    expect(mgr.getRoom(pin)!.hostSocketId).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────
describe('submitAnswer — validation', () => {
  let pin: string
  let alice: string
  beforeEach(() => {
    pin = createElim(makeQuiz(3))
    alice = join(pin, 'Alice', 's1')
    join(pin, 'Bob', 's2')
    mgr.startGame(pin)
  })

  it('rejects when no question is active (result state)', () => {
    // close q0 by both answering, then submit again
    mgr.submitAnswer(pin, alice, 0, 1)
    const bob = mgr.findPlayerIdBySocket(pin, 's2')!
    mgr.submitAnswer(pin, bob, 0, 1) // closes question
    expect(mgr.submitAnswer(pin, alice, 0, 1).error).toMatch(/Không có câu hỏi/)
  })

  it('rejects a stale questionIndex', () => {
    expect(mgr.submitAnswer(pin, alice, 99, 1).error).toMatch(/đã cũ/)
  })

  it('rejects an unknown player', () => {
    expect(mgr.submitAnswer(pin, 'ghost', 0, 1).error).toMatch(/không xác định/)
  })

  it('rejects a double answer', () => {
    mgr.submitAnswer(pin, alice, 0, 1)
    expect(mgr.submitAnswer(pin, alice, 0, 2).error).toMatch(/Đã trả lời/)
  })

  it('rejects an invalid answerId', () => {
    expect(mgr.submitAnswer(pin, alice, 0, 999).error).toMatch(/không hợp lệ/)
  })

  it('rejects after the time window closes', () => {
    vi.setSystemTime(21_000) // past the 20s limit
    expect(mgr.submitAnswer(pin, alice, 0, 1).error).toMatch(/Hết giờ/)
  })

  it('emits question:progress with answered/total counts', () => {
    mgr.submitAnswer(pin, alice, 0, 1)
    const prog = mock.byEvent('question:progress').pop()!.payload as { answered: number; total: number }
    expect(prog.answered).toBe(1)
    expect(prog.total).toBe(2)
  })
})

// ─────────────────────────────────────────────────────────────
describe('elimination logic', () => {
  it('eliminates wrong answerers, keeps correct ones', () => {
    const pin = createElim(makeQuiz(3))
    const a = join(pin, 'Alice', 's1')
    const b = join(pin, 'Bob', 's2')
    const c = join(pin, 'Carol', 's3')
    mgr.startGame(pin)
    mgr.submitAnswer(pin, a, 0, 1) // correct
    mgr.submitAnswer(pin, b, 0, 2) // wrong
    mgr.submitAnswer(pin, c, 0, 1) // correct -> all answered -> closes
    const room = mgr.getRoom(pin)!
    expect(room.players.get(a)!.eliminated).toBe(false)
    expect(room.players.get(b)!.eliminated).toBe(true)
    expect(room.players.get(b)!.eliminatedReason).toBe('wrong')
    expect(room.players.get(c)!.eliminated).toBe(false)
  })

  it('marks timeout elimination for players who never answered', () => {
    const pin = createElim(makeQuiz(3))
    const a = join(pin, 'Alice', 's1')
    const b = join(pin, 'Bob', 's2')
    mgr.startGame(pin)
    mgr.submitAnswer(pin, a, 0, 1) // correct
    // Bob never answers; advance past time to fire auto-close timer
    vi.advanceTimersByTime(20_000 + 300)
    const room = mgr.getRoom(pin)!
    expect(room.players.get(b)!.eliminated).toBe(true)
    expect(room.players.get(b)!.eliminatedReason).toBe('timeout')
  })

  it('0-survivor guard: if everyone answers wrong, nobody is eliminated', () => {
    const pin = createElim(makeQuiz(3))
    const a = join(pin, 'Alice', 's1')
    const b = join(pin, 'Bob', 's2')
    mgr.startGame(pin)
    mgr.submitAnswer(pin, a, 0, 2) // wrong
    mgr.submitAnswer(pin, b, 0, 3) // wrong -> closes
    const room = mgr.getRoom(pin)!
    expect(room.players.get(a)!.eliminated).toBe(false)
    expect(room.players.get(b)!.eliminated).toBe(false)
    expect(room.lastResult!.eliminatedIds).toEqual([])
  })

  it('eliminated players cannot answer the next question', () => {
    const pin = createElim(makeQuiz(3))
    const a = join(pin, 'Alice', 's1')
    const b = join(pin, 'Bob', 's2')
    const c = join(pin, 'Carol', 's3')
    mgr.startGame(pin)
    mgr.submitAnswer(pin, a, 0, 1)
    mgr.submitAnswer(pin, b, 0, 2) // wrong -> eliminated
    mgr.submitAnswer(pin, c, 0, 1) // closes
    mgr.nextQuestion(pin) // ask q1
    expect(mgr.submitAnswer(pin, b, 1, 1).error).toMatch(/đã bị loại/)
  })
})

// ─────────────────────────────────────────────────────────────
describe('game-end (elimination, kahoot disabled)', () => {
  it('ends when active players reach minPlayersToEnd', () => {
    const pin = createElim(makeQuiz(5), { minPlayersToEnd: 1 })
    const a = join(pin, 'Alice', 's1')
    const b = join(pin, 'Bob', 's2')
    mgr.startGame(pin)
    mgr.submitAnswer(pin, a, 0, 1) // correct
    mgr.submitAnswer(pin, b, 0, 2) // wrong -> 1 active left
    mgr.nextQuestion(pin)
    expect(mgr.getRoom(pin)!.status).toBe('ended')
    expect(mock.byEvent('game:over').length).toBe(1)
  })

  it('ends when the question bank is exhausted', () => {
    const pin = createElim(makeQuiz(1), { minPlayersToEnd: 1 })
    const a = join(pin, 'Alice', 's1')
    const b = join(pin, 'Bob', 's2')
    const c = join(pin, 'Carol', 's3')
    mgr.startGame(pin)
    // all correct -> nobody eliminated, still 3 active > 1
    mgr.submitAnswer(pin, a, 0, 1)
    mgr.submitAnswer(pin, b, 0, 1)
    mgr.submitAnswer(pin, c, 0, 1)
    mgr.nextQuestion(pin) // no more questions
    expect(mgr.getRoom(pin)!.status).toBe('ended')
  })
})

// ─────────────────────────────────────────────────────────────
describe('kahoot speed-round', () => {
  it('starts kahoot immediately at game start when active <= threshold', () => {
    const pin = mgr.createRoom(makeQuiz(8), { kahootThreshold: 5, randomizeQuestions: false, randomizeAnswers: false })
    join(pin, 'Alice', 's1')
    join(pin, 'Bob', 's2')
    mgr.startGame(pin)
    const room = mgr.getRoom(pin)!
    expect(room.kahootMode).toBe(true)
    expect(room.status).toBe('question')
  })

  it('awards ~1000 points for an instant correct answer and 0 for wrong', () => {
    const pin = mgr.createRoom(makeQuiz(8), { kahootThreshold: 5, randomizeQuestions: false, randomizeAnswers: false })
    const a = join(pin, 'Alice', 's1')
    const b = join(pin, 'Bob', 's2')
    mgr.startGame(pin) // kahoot q index 0
    mgr.submitAnswer(pin, a, 0, 1) // correct, responseMs=0 -> 1000
    mgr.submitAnswer(pin, b, 0, 2) // wrong -> 0, closes
    const room = mgr.getRoom(pin)!
    expect(room.players.get(a)!.score).toBe(1000)
    expect(room.players.get(b)!.score).toBe(0)
  })

  it('gives ~500 points for a correct answer at the time limit', () => {
    const pin = mgr.createRoom(makeQuiz(8), { kahootThreshold: 5, randomizeQuestions: false, randomizeAnswers: false })
    const a = join(pin, 'Alice', 's1')
    join(pin, 'Bob', 's2')
    mgr.startGame(pin)
    vi.setSystemTime(20_000) // answer exactly at limit -> ratio 1 -> 500
    mgr.submitAnswer(pin, a, 0, 1)
    vi.advanceTimersByTime(20_000 + 300) // close via timer
    expect(mgr.getRoom(pin)!.players.get(a)!.score).toBe(500)
  })

  it('does not eliminate anyone during kahoot mode', () => {
    const pin = mgr.createRoom(makeQuiz(8), { kahootThreshold: 5, randomizeQuestions: false, randomizeAnswers: false })
    const a = join(pin, 'Alice', 's1')
    const b = join(pin, 'Bob', 's2')
    mgr.startGame(pin)
    mgr.submitAnswer(pin, a, 0, 1)
    mgr.submitAnswer(pin, b, 0, 2) // wrong, but no elimination in kahoot
    expect(mgr.getRoom(pin)!.players.get(b)!.eliminated).toBe(false)
    expect(mgr.getRoom(pin)!.lastResult!.eliminatedIds).toEqual([])
  })

  it('transitions from elimination to kahoot once survivors hit threshold', () => {
    const pin = mgr.createRoom(makeQuiz(8), { kahootThreshold: 2, randomizeQuestions: false, randomizeAnswers: false })
    const a = join(pin, 'Alice', 's1')
    const b = join(pin, 'Bob', 's2')
    const c = join(pin, 'Carol', 's3')
    mgr.startGame(pin) // 3 active > 2, normal q0
    expect(mgr.getRoom(pin)!.kahootMode).toBe(false)
    mgr.submitAnswer(pin, a, 0, 1)
    mgr.submitAnswer(pin, b, 0, 1)
    mgr.submitAnswer(pin, c, 0, 2) // wrong -> 2 survivors == threshold
    expect(mock.byEvent('kahoot:start').length).toBe(1) // announced
    mgr.nextQuestion(pin) // host advances -> kahoot begins
    expect(mgr.getRoom(pin)!.kahootMode).toBe(true)
  })

  it('lets the host manually start kahoot from a normal result screen', () => {
    const pin = mgr.createRoom(makeQuiz(8), { kahootThreshold: 0, randomizeQuestions: false, randomizeAnswers: false })
    const a = join(pin, 'Alice', 's1')
    const b = join(pin, 'Bob', 's2')
    mgr.startGame(pin)
    mgr.submitAnswer(pin, a, 0, 1)
    mgr.submitAnswer(pin, b, 0, 1)
    const res = mgr.startKahoot(pin)
    const room = mgr.getRoom(pin)!
    expect(res.ok).toBe(true)
    expect(room.kahootMode).toBe(true)
    expect(room.status).toBe('question')
    expect(mock.last('game:question')).toMatchObject({
      index: 0,
      kahootRound: { questionIndex: 1, totalQuestions: 5 },
    })
  })

  it('does not manually start kahoot while a question is active', () => {
    const pin = mgr.createRoom(makeQuiz(8), { kahootThreshold: 0, randomizeQuestions: false, randomizeAnswers: false })
    join(pin, 'Alice', 's1')
    join(pin, 'Bob', 's2')
    mgr.startGame(pin)
    const res = mgr.startKahoot(pin)
    expect(res.ok).toBe(false)
    expect(mgr.getRoom(pin)!.kahootMode).toBe(false)
    expect(mgr.getRoom(pin)!.status).toBe('question')
  })

  it('ends the game after the last kahoot question', () => {
    const pin = mgr.createRoom(makeQuiz(8), { kahootThreshold: 5, randomizeQuestions: false, randomizeAnswers: false })
    const a = join(pin, 'Alice', 's1')
    const b = join(pin, 'Bob', 's2')
    mgr.startGame(pin)
    const room = mgr.getRoom(pin)!
    const total = room.kahootPool.length
    for (let i = 0; i < total; i++) {
      mgr.submitAnswer(pin, a, i, 1)
      mgr.submitAnswer(pin, b, i, 1)
      if (i < total - 1) mgr.nextQuestion(pin)
    }
    // last question closed; auto-end timer (4s) fires
    vi.advanceTimersByTime(4100)
    expect(mgr.getRoom(pin)!.status).toBe('ended')
  })
})

// ─────────────────────────────────────────────────────────────
describe('leaderboard', () => {
  it('sorts by score desc, breaks ties by join order, and reports delta', () => {
    const pin = mgr.createRoom(makeQuiz(8), { kahootThreshold: 5, randomizeQuestions: false, randomizeAnswers: false })
    const a = join(pin, 'Alice', 's1')
    const b = join(pin, 'Bob', 's2')
    mgr.startGame(pin)
    vi.setSystemTime(10_000) // Alice answers at half-time
    mgr.submitAnswer(pin, a, 0, 1) // correct, ratio .5 -> 750
    mgr.submitAnswer(pin, b, 0, 2) // wrong -> 0, closes
    const lb = mock.last('leaderboard:update') as { entries: Array<{ nickname: string; score: number; delta: number; rank: number }> }
    expect(lb.entries[0].nickname).toBe('Alice')
    expect(lb.entries[0].score).toBe(750)
    expect(lb.entries[0].delta).toBe(750)
    expect(lb.entries[0].rank).toBe(1)
    expect(lb.entries[1].nickname).toBe('Bob')
  })

  it('caps the leaderboard at 10 entries', () => {
    const pin = mgr.createRoom(makeQuiz(8), { kahootThreshold: 15, randomizeQuestions: false, randomizeAnswers: false })
    for (let i = 0; i < 12; i++) join(pin, `P${i}`, `s${i}`)
    mgr.startGame(pin)
    const ids = [...mgr.getRoom(pin)!.players.keys()]
    ids.forEach((id) => mgr.submitAnswer(pin, id, 0, 1))
    const lb = mock.last('leaderboard:update') as { entries: unknown[] }
    expect(lb.entries.length).toBe(10)
  })
})

// ─────────────────────────────────────────────────────────────
describe('resetRoom', () => {
  it('clears scores/eliminations and returns to lobby', () => {
    const pin = createElim(makeQuiz(3))
    const a = join(pin, 'Alice', 's1')
    const b = join(pin, 'Bob', 's2')
    mgr.startGame(pin)
    mgr.submitAnswer(pin, a, 0, 1)
    mgr.submitAnswer(pin, b, 0, 2) // Bob eliminated
    expect(mgr.resetRoom(pin)).toBe(true)
    const room = mgr.getRoom(pin)!
    expect(room.status).toBe('lobby')
    expect(room.questionIndex).toBe(-1)
    expect(room.players.get(b)!.eliminated).toBe(false)
    expect(room.players.get(a)!.score).toBe(0)
  })

  it('returns false for an unknown room', () => {
    expect(mgr.resetRoom('NOPE')).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────
describe('endGame & export', () => {
  it('produces an export sorted by score with ranks', () => {
    const pin = mgr.createRoom(makeQuiz(8), { kahootThreshold: 5, randomizeQuestions: false, randomizeAnswers: false })
    const a = join(pin, 'Alice', 's1')
    const b = join(pin, 'Bob', 's2')
    mgr.startGame(pin)
    mgr.submitAnswer(pin, a, 0, 1) // 1000
    mgr.submitAnswer(pin, b, 0, 2) // 0, closes
    mgr.endGame(pin)
    const exp = mgr.exportRoom(pin)!
    expect(exp.status).toBe('ended')
    expect(exp.rows[0].nickname).toBe('Alice')
    expect(exp.rows[0].finalRank).toBe(1)
    expect(exp.rows[0].finalScore).toBe(1000)
  })

  it('returns null export for a non-ended room', () => {
    const pin = createElim(makeQuiz(3))
    expect(mgr.exportRoom(pin)).toBeNull()
  })

  it('emits game:over on endGame', () => {
    const pin = createElim(makeQuiz(3))
    join(pin, 'Alice', 's1')
    mgr.endGame(pin)
    expect(mock.byEvent('game:over').length).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────────
describe('snapshots & resync', () => {
  it('projectorSnapshot returns null for unknown room', () => {
    expect(mgr.projectorSnapshot('NOPE')).toBeNull()
  })

  it('includes live question while in question state', () => {
    const pin = createElim(makeQuiz(3))
    join(pin, 'Alice', 's1')
    join(pin, 'Bob', 's2')
    mgr.startGame(pin)
    const snap = mgr.projectorSnapshot(pin)!
    expect(snap.status).toBe('question')
    expect(snap.question).toBeDefined()
    expect(snap.question!.answers.every((a) => !('correct' in a))).toBe(true) // no answer key leaked
  })

  it('includes result payload while in result state', () => {
    const pin = createElim(makeQuiz(3))
    const a = join(pin, 'Alice', 's1')
    const b = join(pin, 'Bob', 's2')
    mgr.startGame(pin)
    mgr.submitAnswer(pin, a, 0, 1)
    mgr.submitAnswer(pin, b, 0, 1)
    const snap = mgr.projectorSnapshot(pin)!
    expect(snap.status).toBe('result')
    expect(snap.result).toBeDefined()
    expect(snap.result!.correctAnswerId).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────────
describe('kahoot pool selection', () => {
  it('avoids reusing main-round questions when enough unused remain', () => {
    // 8 questions, threshold triggers kahoot after some elimination
    const quiz = makeQuiz(8)
    const pin = mgr.createRoom(quiz, { kahootThreshold: 1, randomizeQuestions: false, randomizeAnswers: false })
    const a = join(pin, 'Alice', 's1')
    const b = join(pin, 'Bob', 's2')
    mgr.startGame(pin) // q0
    mgr.submitAnswer(pin, a, 0, 1)
    mgr.submitAnswer(pin, b, 0, 2) // Bob out -> 1 active == threshold
    mgr.nextQuestion(pin) // enter kahoot
    const room = mgr.getRoom(pin)!
    // q0 (id q1) was asked; kahoot pool should exclude it given 7 unused remain
    expect(room.kahootPool.some((q) => q.id === 'q1')).toBe(false)
    expect(room.kahootPool.length).toBe(5)
  })

  it('falls back to reused questions for tiny banks', () => {
    const quiz = makeQuiz(3) // fewer than KAHOOT_QUESTION_COUNT(5)
    const pin = mgr.createRoom(quiz, { kahootThreshold: 5, randomizeQuestions: false, randomizeAnswers: false })
    join(pin, 'Alice', 's1')
    join(pin, 'Bob', 's2')
    mgr.startGame(pin)
    expect(mgr.getRoom(pin)!.kahootPool.length).toBe(3) // capped at bank size
  })
})
