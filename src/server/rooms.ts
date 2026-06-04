import type { Server } from 'socket.io'
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  Quiz,
  QuizQuestion,
  GameStatus,
  PlayerView,
  PublicQuestion,
  ProjectorSnapshot,
  QuestionResult,
  LeaderboardEntry,
} from '@/types/events'
import { checkNickname } from '@/lib/nickname'

type IO = Server<ClientToServerEvents, ServerToClientEvents>

/** Internal default question time limit (seconds). Not exposed in quiz JSON. */
const DEFAULT_TIME_LIMIT_SEC = 20

/** Number of questions in the Kahoot speed-round */
const KAHOOT_QUESTION_COUNT = 5

/** Max points for a perfectly-timed correct answer */
const KAHOOT_BASE_POINTS = 1000

interface Player {
  id: string
  nickname: string
  socketId: string | null
  connected: boolean
  eliminated: boolean
  joinedAt: number
  eliminatedAtQuestion: number | null
  eliminatedReason: 'wrong' | 'timeout' | null
  /** Cumulative score across the whole game */
  score: number
  /** Score snapshot before the last question (for delta calculation) */
  scoreBefore: number
}

interface Response {
  answerId: number
  correct: boolean
  /** Server-measured ms from question start to submission */
  responseMs: number
}

interface Room {
  pin: string
  /** Original quiz as parsed — kept so reset() can reshuffle without re-uploading. */
  sourceQuiz: Quiz
  /** Shuffled-for-this-match copy. */
  quiz: Quiz
  status: GameStatus
  players: Map<string, Player>
  questionIndex: number
  questionStartedAt: number
  questionEndsAt: number
  /** playerId -> response for the CURRENT question */
  responses: Map<string, Response>
  /** Cached result for projector resync (only present while status === 'result'). */
  lastResult: QuestionResult | null
  /** Cached leaderboard for resync */
  lastLeaderboard: LeaderboardEntry[] | null
  timer: NodeJS.Timeout | null
  hostSocketId: string | null
  createdAt: number
  lastExport: RoomExport | null
  /**
   * Game ends when active (non-eliminated) players count is <= this value.
   * Default 1 = last player standing wins.
   */
  minPlayersToEnd: number
  maxPlayers: number
  timeLimitSec: number | null
  randomizeQuestions: boolean
  randomizeAnswers: boolean
  /**
   * When active players drop to <= this threshold, switch to Kahoot speed-round.
   * 0 = disabled.
   */
  kahootThreshold: number
  /** Whether the Kahoot speed-round is currently active */
  kahootMode: boolean
  /** Pre-picked questions for the Kahoot round */
  kahootPool: QuizQuestion[]
  /** Current index within kahootPool (0-based) */
  kahootQuestionIndex: number
}

export interface RoomSummary {
  pin: string
  quizTitle: string
  status: GameStatus
  players: number
  totalQuestions: number
}

export interface RoomExportRow {
  nickname: string
  survivedUntilQuestion: number
  eliminatedReason: 'wrong' | 'timeout' | 'winner' | 'not_eliminated'
  joinedAt: string
  finalScore: number
  finalRank: number
}

export interface RoomExport {
  pin: string
  quizTitle: string
  status: GameStatus
  endedAt: string
  rows: RoomExportRow[]
}

function genPin(existing: Set<string>, fixed?: string): string {
  if (fixed) {
    const norm = fixed.trim().toUpperCase()
    if (norm) return norm
  }
  let pin = ''
  do {
    pin = Math.floor(100000 + Math.random() * 900000).toString()
  } while (existing.has(pin))
  return pin
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function randomizeQuiz(quiz: Quiz, randomizeQuestions = true, randomizeAnswers = true): Quiz {
  return {
    ...quiz,
    questions: (randomizeQuestions ? shuffled(quiz.questions) : quiz.questions).map((question) => ({
      ...question,
      answers: randomizeAnswers ? shuffled(question.answers) : question.answers,
    })),
  }
}

/**
 * Pick N unique questions for the Kahoot pool.
 * Excludes questions already asked in the main round whenever enough unused
 * questions remain, and only falls back to previously asked questions for tiny
 * quiz banks.
 */
function pickKahootPool(
  quiz: Quiz,
  count: number,
  excludedQuestionIds = new Set<string>()
): QuizQuestion[] {
  const unused = quiz.questions.filter((question) => !excludedQuestionIds.has(question.id))
  const pool = shuffled(unused).slice(0, count)
  if (pool.length >= count) return pool

  const selectedIds = new Set(pool.map((question) => question.id))
  const fallback = shuffled(
    quiz.questions.filter((question) => !selectedIds.has(question.id))
  )
  return [...pool, ...fallback].slice(0, Math.min(count, quiz.questions.length))
}

/**
 * Speed-scoring formula.
 * Correct + instant → ~1000pts. Correct + last moment → ~500pts. Wrong → 0.
 */
function computePoints(correct: boolean, responseMs: number, timeLimitMs: number): number {
  if (!correct) return 0
  const ratio = Math.min(1, Math.max(0, responseMs / timeLimitMs))
  return Math.round(KAHOOT_BASE_POINTS * (1 - 0.5 * ratio))
}

export class RoomManager {
  private rooms = new Map<string, Room>()
  constructor(private io: IO) { }

  // ── lifecycle ────────────────────────────────────────────────
  /**
   * Create or replace a room. When fixedPin is provided and a room with that
   * PIN already exists, the existing room is dropped first — so re-creating
   * with the same PIN swaps in the new quiz (instead of silently keeping the
   * old one). Boot-time auto-create runs only once per process, so this is
   * always safe.
   */
  createRoom(
    quiz: Quiz,
    options: {
      minPlayersToEnd?: number
      maxPlayers?: number
      timeLimitSec?: number | null
      randomizeQuestions?: boolean
      randomizeAnswers?: boolean
      kahootThreshold?: number
    } = {},
    fixedPin?: string
  ): string {
    for (const room of this.rooms.values()) this.clearTimer(room)
    this.rooms.clear()
    const pin = genPin(new Set(this.rooms.keys()), fixedPin)
    const existing = this.rooms.get(pin)
    if (existing) {
      this.clearTimer(existing)
      this.rooms.delete(pin)
    }
    const minPlayersToEnd = options.minPlayersToEnd ?? 1
    const maxPlayers =
      typeof options.maxPlayers === 'number' && options.maxPlayers >= 1
        ? Math.round(options.maxPlayers)
        : 100
    const timeLimitSec =
      typeof options.timeLimitSec === 'number' && options.timeLimitSec > 0
        ? Math.round(options.timeLimitSec)
        : null
    const randomizeQuestions = options.randomizeQuestions !== false
    const randomizeAnswers = options.randomizeAnswers !== false
    const kahootThreshold =
      typeof options.kahootThreshold === 'number' && options.kahootThreshold >= 0
        ? Math.round(options.kahootThreshold)
        : 10

    const randomizedQuiz = randomizeQuiz(quiz, randomizeQuestions, randomizeAnswers)
    const kahootPool = pickKahootPool(quiz, KAHOOT_QUESTION_COUNT)

    this.rooms.set(pin, {
      pin,
      sourceQuiz: quiz,
      quiz: randomizedQuiz,
      status: 'lobby',
      players: new Map(),
      questionIndex: -1,
      questionStartedAt: 0,
      questionEndsAt: 0,
      responses: new Map(),
      lastResult: null,
      lastLeaderboard: null,
      timer: null,
      hostSocketId: null,
      createdAt: Date.now(),
      lastExport: null,
      minPlayersToEnd: Math.max(1, Math.round(minPlayersToEnd)),
      maxPlayers,
      timeLimitSec,
      randomizeQuestions,
      randomizeAnswers,
      kahootThreshold,
      kahootMode: false,
      kahootPool,
      kahootQuestionIndex: -1,
    })
    return pin
  }

  /**
   * Reset a room back to lobby state with a fresh shuffle. Players keep their
   * slots but lose eliminated status and scores. Use for "Trận mới" between event rounds.
   */
  resetRoom(pin: string): boolean {
    const room = this.rooms.get(pin)
    if (!room) return false
    this.clearTimer(room)
    room.quiz = randomizeQuiz(room.sourceQuiz, room.randomizeQuestions, room.randomizeAnswers)
    room.kahootPool = pickKahootPool(room.sourceQuiz, KAHOOT_QUESTION_COUNT)
    room.status = 'lobby'
    room.questionIndex = -1
    room.questionStartedAt = 0
    room.questionEndsAt = 0
    room.responses = new Map()
    room.lastResult = null
    room.lastLeaderboard = null
    room.kahootMode = false
    room.kahootQuestionIndex = -1
    for (const p of room.players.values()) {
      p.eliminated = false
      p.eliminatedAtQuestion = null
      p.eliminatedReason = null
      p.score = 0
      p.scoreBefore = 0
    }
    this.broadcastLobby(room)
    return true
  }

  /** First active room PIN, used by /api/active-room when running in single-room mode. */
  firstRoomPin(): string | null {
    for (const pin of this.rooms.keys()) return pin
    return null
  }

  firstRoomSummary(): RoomSummary | null {
    for (const room of this.rooms.values()) {
      return {
        pin: room.pin,
        quizTitle: room.quiz.title,
        status: room.status,
        players: room.players.size,
        totalQuestions: room.quiz.questions.length,
      }
    }
    return null
  }

  /** Read-only snapshot for projector / spectator UIs. Includes live question or result so a reconnecting projector can resync immediately. */
  projectorSnapshot(pin: string): ProjectorSnapshot | null {
    const room = this.rooms.get(pin)
    if (!room) return null
    const snap: ProjectorSnapshot = {
      pin: room.pin,
      quizTitle: room.quiz.title,
      status: room.status,
      players: this.playerViews(room),
      questionIndex: room.questionIndex,
      totalQuestions: room.quiz.questions.length,
      minPlayersToEnd: room.minPlayersToEnd,
      maxPlayers: room.maxPlayers,
      timeLimitSec: room.timeLimitSec,
      randomizeQuestions: room.randomizeQuestions,
      randomizeAnswers: room.randomizeAnswers,
      kahootThreshold: room.kahootThreshold,
      kahootMode: room.kahootMode,
      leaderboard: room.lastLeaderboard ?? undefined,
    }
    if (room.status === 'question' && room.questionIndex >= 0) {
      snap.question = this.buildPublicQuestion(room)
    } else if (room.status === 'result' && room.lastResult) {
      snap.result = room.lastResult
    } else if (room.status === 'ended') {
      snap.ended = this.getPlayerSummary(room)
    }
    return snap
  }

  /** Host snapshot includes the same live state needed to recover after a refresh/reconnect. */
  hostSnapshot(pin: string): ProjectorSnapshot | null {
    return this.projectorSnapshot(pin)
  }

  getRoom(pin: string): Room | undefined {
    return this.rooms.get(pin)
  }

  findPlayerIdBySocket(pin: string, socketId: string): string | undefined {
    const room = this.rooms.get(pin)
    if (!room) return undefined
    for (const [id, p] of room.players) {
      if (p.socketId === socketId) return id
    }
    return undefined
  }

  setHost(pin: string, socketId: string): Room | undefined {
    const room = this.rooms.get(pin)
    if (room) room.hostSocketId = socketId
    return room
  }

  // ── players ──────────────────────────────────────────────────
  /** Join or reconnect. Returns playerId or null if room missing/closed. */
  joinPlayer(
    pin: string,
    nickname: string,
    socketId: string,
    playerId?: string
  ): { ok: boolean; playerId?: string; error?: string } {
    const room = this.rooms.get(pin)
    if (!room) return { ok: false, error: 'Không tìm thấy phòng' }
    if (room.status === 'ended') return { ok: false, error: 'Trò chơi đã kết thúc' }

    // reconnect path
    if (playerId && room.players.has(playerId)) {
      const p = room.players.get(playerId)!
      p.socketId = socketId
      p.connected = true
      p.nickname = nickname || p.nickname
      this.broadcastLobby(room)
      return { ok: true, playerId }
    }

    if (room.status !== 'lobby') {
      return { ok: false, error: 'Trò chơi đã bắt đầu' }
    }
    if (room.players.size >= room.maxPlayers) {
      return { ok: false, error: `Phòng đã đạt giới hạn tối đa ${room.maxPlayers} người chơi` }
    }
    const check = checkNickname(nickname)
    if (!check.ok) return { ok: false, error: check.reason ?? 'Biệt danh không hợp lệ' }
    const clean = check.cleaned
    const taken = [...room.players.values()].some(
      (p) => p.nickname.toLowerCase() === clean.toLowerCase()
    )
    if (taken) return { ok: false, error: 'Biệt danh đã được sử dụng' }

    const id = genId()
    room.players.set(id, {
      id,
      nickname: clean,
      socketId,
      connected: true,
      eliminated: false,
      joinedAt: Date.now(),
      eliminatedAtQuestion: null,
      eliminatedReason: null,
      score: 0,
      scoreBefore: 0,
    })
    this.broadcastLobby(room)
    return { ok: true, playerId: id }
  }

  markDisconnected(socketId: string): void {
    for (const room of this.rooms.values()) {
      if (room.hostSocketId === socketId) room.hostSocketId = null
      for (const p of room.players.values()) {
        if (p.socketId === socketId) {
          p.connected = false
          p.socketId = null
          this.broadcastLobby(room)
        }
      }
    }
  }

  // ── game flow ────────────────────────────────────────────────
  startGame(pin: string): void {
    const room = this.rooms.get(pin)
    if (!room || room.status !== 'lobby') return
    // If player count is already at or below the Kahoot threshold at game start,
    // skip straight into the speed-round — no elimination question should run first.
    if (this.shouldStartKahoot(room)) {
      this.startKahootMode(room)
    } else {
      this.askQuestion(room, 0)
    }
  }

  nextQuestion(pin: string): void {
    const room = this.rooms.get(pin)
    if (!room) return
    if (room.status !== 'result') return

    // ── Kahoot mode progression ──
    if (room.kahootMode) {
      const nextKahootIdx = room.kahootQuestionIndex + 1
      if (nextKahootIdx >= room.kahootPool.length) {
        this.endGame(room)
      } else {
        this.askKahootQuestion(room, nextKahootIdx)
      }
      return
    }

    // ── Normal elimination mode ──
    // If kahoot threshold has been reached, start the Kahoot round
    if (this.shouldStartKahoot(room)) {
      this.startKahootMode(room)
      return
    }

    // Check if game should end due to min players threshold
    if (this.shouldEndGame(room)) {
      this.endGame(room)
      return
    }

    const next = room.questionIndex + 1
    if (next >= room.quiz.questions.length) {
      this.endGame(room)
    } else {
      this.askQuestion(room, next)
    }
  }

  endGame(roomOrPin: Room | string): void {
    const room = typeof roomOrPin === 'string' ? this.rooms.get(roomOrPin) : roomOrPin
    if (!room) return
    this.clearTimer(room)
    room.status = 'ended'
    room.lastExport = this.buildExport(room)
    const { survivors, eliminated } = this.getPlayerSummary(room)
    // Final leaderboard emit
    this.emitLeaderboard(room)
    this.io.to(room.pin).emit('game:over', { survivors, eliminated })
  }

  exportRoom(pin: string): RoomExport | null {
    const room = this.rooms.get(pin)
    if (!room) return null
    if (room.lastExport) return room.lastExport
    if (room.status !== 'ended') return null
    room.lastExport = this.buildExport(room)
    return room.lastExport
  }

  submitAnswer(
    pin: string,
    playerId: string,
    questionIndex: number,
    answerId: number
  ): { ok: boolean; error?: string } {
    const room = this.rooms.get(pin)
    if (!room) return { ok: false, error: 'Không tìm thấy phòng' }
    if (room.status !== 'question') return { ok: false, error: 'Không có câu hỏi nào đang hoạt động' }

    // In normal mode, use questionIndex; in kahoot mode, use kahootQuestionIndex
    const expectedIndex = room.kahootMode ? room.kahootQuestionIndex : room.questionIndex
    if (questionIndex !== expectedIndex) return { ok: false, error: 'Câu hỏi đã cũ' }

    const player = room.players.get(playerId)
    if (!player) return { ok: false, error: 'Người chơi không xác định' }
    // Eliminated players cannot answer in any mode
    if (player.eliminated) return { ok: false, error: 'Bạn đã bị loại' }
    if (room.responses.has(playerId)) return { ok: false, error: 'Đã trả lời câu hỏi này rồi' }

    const now = Date.now()
    if (now > room.questionEndsAt) return { ok: false, error: 'Hết giờ' }

    const q = room.kahootMode
      ? room.kahootPool[room.kahootQuestionIndex]
      : room.quiz.questions[questionIndex]
    const chosen = q.answers.find((a) => a.id === answerId)
    if (!chosen) return { ok: false, error: 'Câu trả lời không hợp lệ' }

    const correct = chosen.id === q.correctAnswerId
    const responseMs = now - room.questionStartedAt
    room.responses.set(playerId, { answerId, correct, responseMs })

    // Live answered/total counter for projector + host control panel.
    const eligiblePlayers = [...room.players.values()].filter(
      (p) => !p.eliminated && p.connected
    )
    const eligibleIds = new Set(eligiblePlayers.map((p) => p.id))
    const connectedResponseCount = [...room.responses.keys()].filter((id) =>
      eligibleIds.has(id)
    ).length
    this.io.to(room.pin).emit('question:progress', {
      questionIndex: expectedIndex,
      answered: connectedResponseCount,
      total: eligiblePlayers.length,
    })

    // close early if every eligible connected player has answered
    if (connectedResponseCount >= eligiblePlayers.length && eligiblePlayers.length > 0) {
      this.closeQuestion(room)
    }
    return { ok: true }
  }

  // ── internals ────────────────────────────────────────────────

  private buildPublicQuestion(room: Room): PublicQuestion {
    const isKahoot = room.kahootMode
    const q = isKahoot
      ? room.kahootPool[room.kahootQuestionIndex]
      : room.quiz.questions[room.questionIndex]

    return {
      index: isKahoot ? room.kahootQuestionIndex : room.questionIndex,
      total: isKahoot ? room.kahootPool.length : room.quiz.questions.length,
      text: q.text,
      answers: q.answers.map((a) => ({ id: a.id, text: a.text })),
      timeLimitSec: room.timeLimitSec ?? q.timeLimitSec ?? DEFAULT_TIME_LIMIT_SEC,
      endsAt: room.questionEndsAt,
      ...(isKahoot
        ? {
            kahootRound: {
              questionIndex: room.kahootQuestionIndex + 1,
              totalQuestions: room.kahootPool.length,
            },
          }
        : {}),
    }
  }

  private askQuestion(room: Room, index: number): void {
    this.clearTimer(room)
    room.questionIndex = index
    room.status = 'question'
    room.responses = new Map()
    room.lastResult = null

    const q = room.quiz.questions[index]
    const timeLimitSec = room.timeLimitSec ?? q.timeLimitSec ?? DEFAULT_TIME_LIMIT_SEC
    const now = Date.now()
    room.questionStartedAt = now
    room.questionEndsAt = now + timeLimitSec * 1000

    // Snapshot scores before this question for delta calculation
    for (const p of room.players.values()) p.scoreBefore = p.score

    const payload = this.buildPublicQuestion(room)
    this.io.to(room.pin).emit('game:question', payload)

    room.timer = setTimeout(() => this.closeQuestion(room), timeLimitSec * 1000 + 200)
  }

  private askKahootQuestion(room: Room, index: number): void {
    this.clearTimer(room)
    room.kahootQuestionIndex = index
    room.status = 'question'
    room.responses = new Map()
    room.lastResult = null

    const q = room.kahootPool[index]
    const timeLimitSec = room.timeLimitSec ?? q.timeLimitSec ?? DEFAULT_TIME_LIMIT_SEC
    const now = Date.now()
    room.questionStartedAt = now
    room.questionEndsAt = now + timeLimitSec * 1000

    // Snapshot scores before this question for delta calculation
    for (const p of room.players.values()) p.scoreBefore = p.score

    const payload = this.buildPublicQuestion(room)
    this.io.to(room.pin).emit('game:question', payload)

    room.timer = setTimeout(() => this.closeQuestion(room), timeLimitSec * 1000 + 200)
  }

  private closeQuestion(room: Room): void {
    if (room.status !== 'question') return
    this.clearTimer(room)
    room.status = 'result'

    const isKahoot = room.kahootMode
    const q = isKahoot
      ? room.kahootPool[room.kahootQuestionIndex]
      : room.quiz.questions[room.questionIndex]

    const timeLimitMs = (room.timeLimitSec ?? q.timeLimitSec ?? DEFAULT_TIME_LIMIT_SEC) * 1000

    const counts: Record<number, number> = {}
    for (const a of q.answers) counts[a.id] = 0
    for (const r of room.responses.values()) counts[r.answerId] = (counts[r.answerId] ?? 0) + 1

    // ── Score all players who answered (Kahoot speed-round only) ──
    if (isKahoot) {
      for (const [pid, resp] of room.responses) {
        const player = room.players.get(pid)
        if (!player) continue
        const pts = computePoints(resp.correct, resp.responseMs, timeLimitMs)
        player.score += pts
      }
    }

    const eliminatedThisRound: string[] = []

    if (!isKahoot) {
      // Get the currently active players before this question's elimination
      const activePlayers = [...room.players.values()].filter((p) => !p.eliminated)

      // Count potential survivors: active players who answered correctly
      const survivorsCount = activePlayers.filter((p) => {
        const r = room.responses.get(p.id)
        return r?.correct === true
      }).length

      // If all currently active players would be eliminated (leaving 0 survivors),
      // we do not count that elimination and keep everyone alive.
      if (survivorsCount === 0 && activePlayers.length > 0) {
        // Edge case: skip elimination entirely this round to avoid 0 survivors
      } else {
        // Normal elimination logic
        for (const p of activePlayers) {
          const r = room.responses.get(p.id)
          const correct = r?.correct === true
          if (!correct) {
            p.eliminated = true
            p.eliminatedAtQuestion = room.questionIndex
            p.eliminatedReason = r ? 'wrong' : 'timeout'
            eliminatedThisRound.push(p.id)
            if (p.socketId) {
              const reason = r ? 'wrong' : 'timeout'
              this.io.to(p.socketId).emit('player:eliminated', { reason })
            }
          }
        }
      }
    }

    const questionIdx = isKahoot ? room.kahootQuestionIndex : room.questionIndex
    const base: QuestionResult = {
      questionIndex: questionIdx,
      correctAnswerId: q.correctAnswerId,
      counts,
      eliminatedIds: eliminatedThisRound,
    }
    room.lastResult = base

    // host gets base result
    if (room.hostSocketId) {
      this.io.to(room.hostSocketId).emit('question:result', base)
    }
    // each player gets a personalized copy with points earned
    for (const p of room.players.values()) {
      if (!p.socketId) continue
      const r = room.responses.get(p.id)
      const wasEliminated = eliminatedThisRound.includes(p.id)
      const pointsEarned = p.score - p.scoreBefore
      this.io.to(p.socketId).emit('question:result', {
        ...base,
        you: {
          answered: !!r,
          correct: r?.correct === true,
          eliminated: wasEliminated,
          pointsEarned,
        },
      })
    }

    // Broadcast updated player list (with new eliminated flags + scores)
    this.broadcastLobby(room)

    // Emit live leaderboard
    this.emitLeaderboard(room)

    if (isKahoot) {
      // Kahoot mode: auto-end after all questions (or host clicks next)
      const isLastKahoot = room.kahootQuestionIndex >= room.kahootPool.length - 1
      if (isLastKahoot) {
        this.clearTimer(room)
        room.timer = setTimeout(() => {
          room.timer = null
          if (room.status === 'result') this.endGame(room)
        }, 4000)
      }
      return
    }

    // Normal mode: check if Kahoot threshold is now met
    if (this.shouldStartKahoot(room)) {
      // Don't auto-start — host needs to see result first, then click "Next"
      // But emit the kahoot:start announcement now so screens can prepare
      this.announceKahootUpcoming(room)
    } else if (this.shouldEndGame(room)) {
      this.clearTimer(room)
      room.timer = setTimeout(() => {
        room.timer = null
        if (room.status === 'result') this.endGame(room)
      }, 3000)
    }
  }

  /** Returns true if the active player count means game should end in normal mode.
   * When a Kahoot threshold is set, the game never auto-ends in elimination mode —
   * shouldStartKahoot() is the only exit path. */
  private shouldEndGame(room: Room): boolean {
    if (room.kahootMode) return false
    // If Kahoot is enabled, never auto-end during elimination — let Kahoot handle it
    if (room.kahootThreshold > 0) return false
    const active = [...room.players.values()].filter((p) => !p.eliminated).length
    return active <= room.minPlayersToEnd
  }

  /**
   * Returns true when the Kahoot speed-round should trigger next.
   * Fires when active players <= kahootThreshold, regardless of minPlayersToEnd.
   */
  private shouldStartKahoot(room: Room): boolean {
    if (room.kahootMode) return false
    if (room.kahootThreshold <= 0) return false
    const active = [...room.players.values()].filter((p) => !p.eliminated).length
    return active <= room.kahootThreshold
  }

  /**
   * Emit the kahoot:start announcement while still on the result screen.
   * The actual mode switch happens when the host presses "Next".
   */
  private announceKahootUpcoming(room: Room): void {
    const survivors = [...room.players.values()]
      .filter((p) => !p.eliminated)
      .map((p) => this.toPlayerView(p))
    const leaderboard = this.buildLeaderboard(room)
    this.io.to(room.pin).emit('kahoot:start', {
      threshold: room.kahootThreshold,
      survivors,
      leaderboard,
    })
  }

  /** Start Kahoot speed-round mode. Called when host clicks "Next" after threshold is reached. */
  private startKahootMode(room: Room): void {
    room.kahootMode = true
    room.kahootQuestionIndex = -1
    const askedQuestionIds = new Set(
      room.quiz.questions
        .slice(0, Math.max(room.questionIndex + 1, 0))
        .map((question) => question.id)
    )
    room.kahootPool = pickKahootPool(room.sourceQuiz, KAHOOT_QUESTION_COUNT, askedQuestionIds)
    this.askKahootQuestion(room, 0)
  }

  private clearTimer(room: Room): void {
    if (room.timer) {
      clearTimeout(room.timer)
      room.timer = null
    }
  }

  /** Build a sorted top-10 leaderboard from current scores. */
  private buildLeaderboard(room: Room): LeaderboardEntry[] {
    const sorted = [...room.players.values()]
      .sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt)
      .slice(0, 10)

    return sorted.map((p, i) => ({
      rank: i + 1,
      id: p.id,
      nickname: p.nickname,
      score: p.score,
      delta: p.score - p.scoreBefore,
    }))
  }

  /** Emit the top-10 leaderboard to everyone in the room. */
  private emitLeaderboard(room: Room): void {
    const entries = this.buildLeaderboard(room)
    room.lastLeaderboard = entries
    this.io.to(room.pin).emit('leaderboard:update', { entries })
  }

  getPlayerSummary(room: Room): { survivors: PlayerView[]; eliminated: PlayerView[] } {
    const survivors: PlayerView[] = []
    const eliminated: PlayerView[] = []
    // In kahoot mode, everyone who played is a "survivor" — rank by score
    if (room.kahootMode) {
      const ranked = [...room.players.values()].sort((a, b) => b.score - a.score)
      for (const p of ranked) survivors.push(this.toPlayerView(p))
      return { survivors, eliminated }
    }
    for (const p of room.players.values()) {
      const view = this.toPlayerView(p)
      if (p.eliminated) eliminated.push(view)
      else survivors.push(view)
    }
    return { survivors, eliminated }
  }

  private toPlayerView(p: Player): PlayerView {
    return {
      id: p.id,
      nickname: p.nickname,
      connected: p.connected,
      eliminated: p.eliminated,
      score: p.score,
    }
  }

  private buildExport(room: Room): RoomExport {
    const survivedFallback = Math.max(room.questionIndex + 1, 0)
    const sorted = [...room.players.values()].sort((a, b) => b.score - a.score)
    return {
      pin: room.pin,
      quizTitle: room.quiz.title,
      status: room.status,
      endedAt: new Date().toISOString(),
      rows: sorted.map((p, i) => ({
        nickname: p.nickname,
        survivedUntilQuestion:
          p.eliminatedAtQuestion === null ? survivedFallback : p.eliminatedAtQuestion + 1,
        eliminatedReason: p.eliminated
          ? p.eliminatedReason ?? 'not_eliminated'
          : room.status === 'ended'
            ? 'winner'
            : 'not_eliminated',
        joinedAt: new Date(p.joinedAt).toISOString(),
        finalScore: p.score,
        finalRank: i + 1,
      })),
    }
  }

  playerViews(room: Room): PlayerView[] {
    return [...room.players.values()].map((p) => this.toPlayerView(p))
  }

  private broadcastLobby(room: Room): void {
    this.io.to(room.pin).emit('lobby:update', {
      players: this.playerViews(room),
      status: room.status,
    })
  }

  // periodic cleanup of stale rooms (older than 6h)
  sweep(): void {
    const cutoff = Date.now() - 6 * 60 * 60 * 1000
    for (const [pin, room] of this.rooms) {
      if (room.createdAt < cutoff) {
        this.clearTimer(room)
        this.rooms.delete(pin)
      }
    }
  }
}
