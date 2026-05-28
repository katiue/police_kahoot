import type { Server } from 'socket.io'
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  Quiz,
  GameStatus,
  PlayerView,
  LeaderboardRow,
  PublicQuestion,
  QuestionResult,
} from '@/types/events'
import { computeScore } from '@/lib/scoring'

type IO = Server<ClientToServerEvents, ServerToClientEvents>

interface Player {
  id: string
  nickname: string
  socketId: string | null
  score: number
  lastGain: number
  connected: boolean
}

interface Response {
  answerId: number
  /** server-measured response time in ms */
  responseMs: number
  correct: boolean
}

interface Room {
  pin: string
  quiz: Quiz
  status: GameStatus
  players: Map<string, Player>
  questionIndex: number
  questionStartedAt: number
  questionEndsAt: number
  /** playerId -> response for the CURRENT question */
  responses: Map<string, Response>
  timer: NodeJS.Timeout | null
  hostSocketId: string | null
  createdAt: number
}

function genPin(existing: Set<string>): string {
  let pin = ''
  do {
    pin = Math.floor(100000 + Math.random() * 900000).toString()
  } while (existing.has(pin))
  return pin
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export class RoomManager {
  private rooms = new Map<string, Room>()
  constructor(private io: IO) {}

  // ── lifecycle ────────────────────────────────────────────────
  createRoom(quiz: Quiz): string {
    const pin = genPin(new Set(this.rooms.keys()))
    this.rooms.set(pin, {
      pin,
      quiz,
      status: 'lobby',
      players: new Map(),
      questionIndex: -1,
      questionStartedAt: 0,
      questionEndsAt: 0,
      responses: new Map(),
      timer: null,
      hostSocketId: null,
      createdAt: Date.now(),
    })
    return pin
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
    const clean = nickname.trim().slice(0, 20)
    if (!clean) return { ok: false, error: 'Nickname required' }
    const taken = [...room.players.values()].some(
      (p) => p.nickname.toLowerCase() === clean.toLowerCase()
    )
    if (taken) return { ok: false, error: 'Nickname taken' }

    const id = genId()
    room.players.set(id, {
      id,
      nickname: clean,
      socketId,
      score: 0,
      lastGain: 0,
      connected: true,
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
    if (room.players.size === 0) return
    this.askQuestion(room, 0)
  }

  nextQuestion(pin: string): void {
    const room = this.rooms.get(pin)
    if (!room) return
    if (room.status !== 'result') return
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
    this.io.to(room.pin).emit('game:over', { leaderboard: this.leaderboard(room) })
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
    if (room.responses.has(playerId)) return { ok: false, error: 'Already answered' }

    const now = Date.now()
    if (now > room.questionEndsAt) return { ok: false, error: 'Time up' }

    const q = room.quiz.questions[questionIndex]
    const chosen = q.answers.find((a) => a.id === answerId)
    if (!chosen) return { ok: false, error: 'Invalid answer' }

    const responseMs = now - room.questionStartedAt
    const correct = chosen.correct
    const gained = computeScore({
      correct,
      basePoints: q.points,
      responseMs,
      timeLimitMs: q.timeLimitSec * 1000,
    })
    player.score += gained
    player.lastGain = gained
    room.responses.set(playerId, { answerId, responseMs, correct })

    // close early if every connected player has answered
    const connectedCount = [...room.players.values()].filter((p) => p.connected).length
    if (room.responses.size >= connectedCount && connectedCount > 0) {
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
    for (const p of room.players.values()) p.lastGain = 0

    const q = room.quiz.questions[index]
    const now = Date.now()
    room.questionStartedAt = now
    room.questionEndsAt = now + q.timeLimitSec * 1000

    const payload: PublicQuestion = {
      index,
      total: room.quiz.questions.length,
      text: q.text,
      answers: q.answers.map((a) => ({ id: a.id, text: a.text })),
      timeLimitSec: q.timeLimitSec,
      endsAt: room.questionEndsAt,
      points: q.points,
    }
    this.io.to(room.pin).emit('game:question', payload)

    room.timer = setTimeout(() => this.closeQuestion(room), q.timeLimitSec * 1000 + 200)
  }

  private closeQuestion(room: Room): void {
    if (room.status !== 'question') return
    this.clearTimer(room)
    room.status = 'result'

    const q = room.quiz.questions[room.questionIndex]
    const correctAnswer = q.answers.find((a) => a.correct)!
    const counts: Record<number, number> = {}
    for (const a of q.answers) counts[a.id] = 0
    for (const r of room.responses.values()) counts[r.answerId] = (counts[r.answerId] ?? 0) + 1

    const leaderboard = this.leaderboard(room)
    const base: QuestionResult = {
      questionIndex: room.questionIndex,
      correctAnswerId: correctAnswer.id,
      counts,
      leaderboard,
    }

    // host (and any non-player socket in room) gets the base result
    if (room.hostSocketId) {
      this.io.to(room.hostSocketId).emit('question:result', base)
    }
    // each player gets a personalized copy
    for (const p of room.players.values()) {
      if (!p.socketId) continue
      const r = room.responses.get(p.id)
      this.io.to(p.socketId).emit('question:result', {
        ...base,
        you: { answered: !!r, correct: !!r?.correct, gained: p.lastGain },
      })
    }
  }

  private clearTimer(room: Room): void {
    if (room.timer) {
      clearTimeout(room.timer)
      room.timer = null
    }
  }

  leaderboard(room: Room): LeaderboardRow[] {
    return [...room.players.values()]
      .sort((a, b) => b.score - a.score)
      .map((p, i) => ({
        playerId: p.id,
        nickname: p.nickname,
        score: p.score,
        lastGain: p.lastGain,
        rank: i + 1,
      }))
  }

  playerViews(room: Room): PlayerView[] {
    return [...room.players.values()].map((p) => ({
      id: p.id,
      nickname: p.nickname,
      score: p.score,
      connected: p.connected,
    }))
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
