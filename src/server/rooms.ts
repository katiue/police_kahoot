import type { Server } from 'socket.io'
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  Quiz,
  GameStatus,
  PlayerView,
  PublicQuestion,
  ProjectorSnapshot,
  QuestionResult,
} from '@/types/events'
import { checkNickname } from '@/lib/nickname'

type IO = Server<ClientToServerEvents, ServerToClientEvents>

/** Internal default question time limit (seconds). Not exposed in quiz JSON. */
const DEFAULT_TIME_LIMIT_SEC = 20

interface Player {
  id: string
  nickname: string
  socketId: string | null
  connected: boolean
  eliminated: boolean
}

interface Response {
  answerId: number
  correct: boolean
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
  timer: NodeJS.Timeout | null
  hostSocketId: string | null
  createdAt: number
  /**
   * Game ends when active (non-eliminated) players count is <= this value.
   * Default 1 = last player standing wins.
   */
  minPlayersToEnd: number
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

function randomizeQuiz(quiz: Quiz): Quiz {
  return {
    ...quiz,
    questions: shuffled(quiz.questions).map((question) => ({
      ...question,
      answers: shuffled(question.answers),
    })),
  }
}

export class RoomManager {
  private rooms = new Map<string, Room>()
  constructor(private io: IO) {}

  // ── lifecycle ────────────────────────────────────────────────
  /**
   * Create or replace a room. When fixedPin is provided and a room with that
   * PIN already exists, the existing room is dropped first — so re-creating
   * with the same PIN swaps in the new quiz (instead of silently keeping the
   * old one). Boot-time auto-create runs only once per process, so this is
   * always safe.
   */
  createRoom(quiz: Quiz, minPlayersToEnd = 1, fixedPin?: string): string {
    const pin = genPin(new Set(this.rooms.keys()), fixedPin)
    const existing = this.rooms.get(pin)
    if (existing) {
      this.clearTimer(existing)
      this.rooms.delete(pin)
    }
    const randomizedQuiz = randomizeQuiz(quiz)
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
      timer: null,
      hostSocketId: null,
      createdAt: Date.now(),
      minPlayersToEnd: Math.max(1, Math.round(minPlayersToEnd)),
    })
    return pin
  }

  /**
   * Reset a room back to lobby state with a fresh shuffle. Players keep their
   * slots but lose eliminated status. Use for "Trận mới" between event rounds.
   */
  resetRoom(pin: string): boolean {
    const room = this.rooms.get(pin)
    if (!room) return false
    this.clearTimer(room)
    room.quiz = randomizeQuiz(room.sourceQuiz)
    room.status = 'lobby'
    room.questionIndex = -1
    room.questionStartedAt = 0
    room.questionEndsAt = 0
    room.responses = new Map()
    room.lastResult = null
    for (const p of room.players.values()) p.eliminated = false
    this.broadcastLobby(room)
    return true
  }

  /** First active room PIN, used by /api/active-room when running in single-room mode. */
  firstRoomPin(): string | null {
    for (const pin of this.rooms.keys()) return pin
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
    }
    if (room.status === 'question' && room.questionIndex >= 0) {
      const q = room.quiz.questions[room.questionIndex]
      snap.question = {
        index: room.questionIndex,
        total: room.quiz.questions.length,
        text: q.text,
        answers: q.answers.map((a) => ({ id: a.id, text: a.text })),
        timeLimitSec: q.timeLimitSec,
        endsAt: room.questionEndsAt,
      }
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
    if (!room) return { ok: false, error: 'Room not found' }
    if (room.status === 'ended') return { ok: false, error: 'Game already ended' }

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
      return { ok: false, error: 'Game already started' }
    }
    const check = checkNickname(nickname)
    if (!check.ok) return { ok: false, error: check.reason ?? 'Nickname invalid' }
    const clean = check.cleaned
    const taken = [...room.players.values()].some(
      (p) => p.nickname.toLowerCase() === clean.toLowerCase()
    )
    if (taken) return { ok: false, error: 'Nickname taken' }

    const id = genId()
    room.players.set(id, {
      id,
      nickname: clean,
      socketId,
      connected: true,
      eliminated: false,
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
    // Solo-test allowed: 0 players is valid. The auto-end check in
    // shouldEndGame() will still fire after the first question if no one survives.
    this.askQuestion(room, 0)
  }

  nextQuestion(pin: string): void {
    const room = this.rooms.get(pin)
    if (!room) return
    if (room.status !== 'result') return

    // Check if threshold already met before moving on
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
    const { survivors, eliminated } = this.getPlayerSummary(room)
    this.io.to(room.pin).emit('game:over', { survivors, eliminated })
  }

  submitAnswer(
    pin: string,
    playerId: string,
    questionIndex: number,
    answerId: number
  ): { ok: boolean; error?: string } {
    const room = this.rooms.get(pin)
    if (!room) return { ok: false, error: 'Room not found' }
    if (room.status !== 'question') return { ok: false, error: 'No active question' }
    if (questionIndex !== room.questionIndex) return { ok: false, error: 'Stale question' }

    const player = room.players.get(playerId)
    if (!player) return { ok: false, error: 'Unknown player' }
    // Eliminated players (spectators) cannot answer
    if (player.eliminated) return { ok: false, error: 'You have been eliminated' }
    if (room.responses.has(playerId)) return { ok: false, error: 'Already answered' }

    const now = Date.now()
    if (now > room.questionEndsAt) return { ok: false, error: 'Time up' }

    const q = room.quiz.questions[questionIndex]
    const chosen = q.answers.find((a) => a.id === answerId)
    if (!chosen) return { ok: false, error: 'Invalid answer' }

    const correct = chosen.id === q.correctAnswerId
    room.responses.set(playerId, { answerId, correct })

    // Live answered/total counter for projector + host control panel.
    const activeConnected = [...room.players.values()].filter(
      (p) => !p.eliminated && p.connected
    )
    const activeConnectedIds = new Set(activeConnected.map((p) => p.id))
    const connectedResponseCount = [...room.responses.keys()].filter((id) =>
      activeConnectedIds.has(id)
    ).length
    this.io.to(room.pin).emit('question:progress', {
      questionIndex: room.questionIndex,
      answered: connectedResponseCount,
      total: activeConnected.length,
    })

    // close early if every active (non-eliminated) connected player has answered
    if (connectedResponseCount >= activeConnected.length && activeConnected.length > 0) {
      this.closeQuestion(room)
    }
    return { ok: true }
  }

  // ── internals ────────────────────────────────────────────────
  private askQuestion(room: Room, index: number): void {
    this.clearTimer(room)
    room.questionIndex = index
    room.status = 'question'
    room.responses = new Map()
    room.lastResult = null

    const q = room.quiz.questions[index]
    const timeLimitSec = q.timeLimitSec ?? DEFAULT_TIME_LIMIT_SEC
    const now = Date.now()
    room.questionStartedAt = now
    room.questionEndsAt = now + timeLimitSec * 1000

    const payload: PublicQuestion = {
      index,
      total: room.quiz.questions.length,
      text: q.text,
      answers: q.answers.map((a) => ({ id: a.id, text: a.text })),
      timeLimitSec,
      endsAt: room.questionEndsAt,
    }
    this.io.to(room.pin).emit('game:question', payload)

    room.timer = setTimeout(() => this.closeQuestion(room), timeLimitSec * 1000 + 200)
  }

  private closeQuestion(room: Room): void {
    if (room.status !== 'question') return
    this.clearTimer(room)
    room.status = 'result'

    const q = room.quiz.questions[room.questionIndex]
    const counts: Record<number, number> = {}
    for (const a of q.answers) counts[a.id] = 0
    for (const r of room.responses.values()) counts[r.answerId] = (counts[r.answerId] ?? 0) + 1

    // Eliminate players who answered wrong OR didn't answer (timed out)
    const eliminatedThisRound: string[] = []
    for (const p of room.players.values()) {
      if (p.eliminated) continue // already out
      const r = room.responses.get(p.id)
      const correct = r?.correct === true
      if (!correct) {
        p.eliminated = true
        eliminatedThisRound.push(p.id)
        // Notify the eliminated player directly
        if (p.socketId) {
          const reason = r ? 'wrong' : 'timeout'
          this.io.to(p.socketId).emit('player:eliminated', { reason })
        }
      }
    }

    const base: QuestionResult = {
      questionIndex: room.questionIndex,
      correctAnswerId: q.correctAnswerId,
      counts,
      eliminatedIds: eliminatedThisRound,
    }
    room.lastResult = base

    // host gets base result
    if (room.hostSocketId) {
      this.io.to(room.hostSocketId).emit('question:result', base)
    }
    // each player gets a personalized copy
    for (const p of room.players.values()) {
      if (!p.socketId) continue
      const r = room.responses.get(p.id)
      const wasEliminated = eliminatedThisRound.includes(p.id)
      this.io.to(p.socketId).emit('question:result', {
        ...base,
        you: {
          answered: !!r,
          correct: r?.correct === true,
          eliminated: wasEliminated,
        },
      })
    }

    // Broadcast updated player list (with new eliminated flags)
    this.broadcastLobby(room)

    // Check if game should auto-end
    if (this.shouldEndGame(room)) {
      // Small delay so clients can render the result screen first
      setTimeout(() => this.endGame(room), 3000)
    }
  }

  /** Returns true if the active player count means game should end. */
  private shouldEndGame(room: Room): boolean {
    const active = [...room.players.values()].filter((p) => !p.eliminated).length
    return active <= room.minPlayersToEnd
  }

  private clearTimer(room: Room): void {
    if (room.timer) {
      clearTimeout(room.timer)
      room.timer = null
    }
  }

  getPlayerSummary(room: Room): { survivors: PlayerView[]; eliminated: PlayerView[] } {
    const survivors: PlayerView[] = []
    const eliminated: PlayerView[] = []
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
