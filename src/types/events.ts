// ─────────────────────────────────────────────────────────────
// Shared Socket.IO contracts + domain types (client ↔ server)
// Single source of truth so both sides agree on payloads.
// ─────────────────────────────────────────────────────────────

export type GameStatus = 'lobby' | 'question' | 'result' | 'ended'

/** Quiz as loaded from JSON (correct answers known only server-side). */
export interface QuizAnswer {
  id: number
  text: string
  correct: boolean
}
export interface QuizQuestion {
  id: string
  text: string
  timeLimitSec: number
  points: number
  answers: QuizAnswer[]
}
export interface Quiz {
  title: string
  questions: QuizQuestion[]
}

/** Answer option sent to clients — NO `correct` flag (anti-cheat). */
export interface PublicAnswer {
  id: number
  text: string
}

/** Sanitized question pushed to players during play. */
export interface PublicQuestion {
  index: number
  total: number
  text: string
  answers: PublicAnswer[]
  timeLimitSec: number
  /** Absolute server time (epoch ms) when the question closes. */
  endsAt: number
  points: number
}

export interface PlayerView {
  id: string
  nickname: string
  score: number
  connected: boolean
}

export interface LeaderboardRow {
  playerId: string
  nickname: string
  score: number
  lastGain: number
  rank: number
}

export interface QuestionResult {
  questionIndex: number
  correctAnswerId: number
  /** answerId -> count of players who picked it */
  counts: Record<number, number>
  leaderboard: LeaderboardRow[]
  /** Per-recipient personal result (filled before emit to each socket). */
  you?: { answered: boolean; correct: boolean; gained: number }
}

// ── Client → Server events ──────────────────────────────────────
export interface ClientToServerEvents {
  'host:create': (
    payload: { quiz: Quiz },
    ack: (res: { ok: boolean; pin?: string; error?: string }) => void
  ) => void
  'host:join': (
    payload: { pin: string },
    ack: (res: { ok: boolean; state?: HostSnapshot; error?: string }) => void
  ) => void
  'host:start': (payload: { pin: string }) => void
  'host:next': (payload: { pin: string }) => void
  'host:end': (payload: { pin: string }) => void

  'player:join': (
    payload: { pin: string; nickname: string; playerId?: string },
    ack: (res: { ok: boolean; playerId?: string; error?: string }) => void
  ) => void
  'player:answer': (
    payload: { pin: string; questionIndex: number; answerId: number },
    ack: (res: { ok: boolean; error?: string }) => void
  ) => void
}

// ── Server → Client events ──────────────────────────────────────
export interface ServerToClientEvents {
  'lobby:update': (payload: { players: PlayerView[]; status: GameStatus }) => void
  'game:question': (payload: PublicQuestion) => void
  'question:result': (payload: QuestionResult) => void
  'leaderboard:update': (payload: { leaderboard: LeaderboardRow[] }) => void
  'game:over': (payload: { leaderboard: LeaderboardRow[] }) => void
  'answer:ack': (payload: { questionIndex: number; received: boolean }) => void
  'error:msg': (payload: { message: string }) => void
}

/** State snapshot a host receives on (re)join. */
export interface HostSnapshot {
  pin: string
  quizTitle: string
  status: GameStatus
  players: PlayerView[]
  questionIndex: number
  totalQuestions: number
}
