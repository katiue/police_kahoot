// ─────────────────────────────────────────────────────────────
// Shared Socket.IO contracts + domain types (client ↔ server)
// Single source of truth so both sides agree on payloads.
// ─────────────────────────────────────────────────────────────

export type GameStatus = 'lobby' | 'question' | 'result' | 'ended'

/**
 * Quiz as loaded from JSON.
 * - correctAnswerId: the id of the correct answer (replaces per-answer `correct` flag)
 * - timeLimitSec / points are NOT in the JSON — server uses internal defaults
 */
export interface QuizAnswer {
  id: number
  text: string
}
export interface QuizQuestion {
  id: string
  text: string
  /** Internal default: 20s — not exposed in quiz JSON */
  timeLimitSec: number
  /** Which answer id is correct */
  correctAnswerId: number
  answers: QuizAnswer[]
}
export interface Quiz {
  title: string
  questions: QuizQuestion[]
}

/** Sanitized question pushed to players during play — no correct answer revealed. */
export interface PublicQuestion {
  index: number
  total: number
  text: string
  answers: QuizAnswer[]
  timeLimitSec: number
  /** Absolute server time (epoch ms) when the question closes. */
  endsAt: number
}

export interface PlayerView {
  id: string
  nickname: string
  connected: boolean
  eliminated: boolean
}

export interface QuestionResult {
  questionIndex: number
  correctAnswerId: number
  /** answerId -> count of players who picked it */
  counts: Record<number, number>
  /** Ids of players eliminated this round */
  eliminatedIds: string[]
  /** Per-recipient personal result (filled before emit to each socket). */
  you?: { answered: boolean; correct: boolean; eliminated: boolean }
}

// ── Client → Server events ──────────────────────────────────────
export interface ClientToServerEvents {
  'host:create': (
    payload: { quiz: Quiz; minPlayersToEnd?: number },
    ack: (res: { ok: boolean; pin?: string; error?: string }) => void
  ) => void
  'host:join': (
    payload: { pin: string },
    ack: (res: { ok: boolean; state?: HostSnapshot; error?: string }) => void
  ) => void
  'host:start': (payload: { pin: string }) => void
  'host:next': (payload: { pin: string }) => void
  'host:end': (payload: { pin: string }) => void
  'host:reset': (
    payload: { pin: string },
    ack?: (res: { ok: boolean; error?: string }) => void
  ) => void

  'player:join': (
    payload: { pin: string; nickname: string; playerId?: string },
    ack: (res: { ok: boolean; playerId?: string; error?: string }) => void
  ) => void
  'player:answer': (
    payload: { pin: string; questionIndex: number; answerId: number },
    ack: (res: { ok: boolean; error?: string }) => void
  ) => void

  /** Read-only audience view of a room. */
  'projector:join': (
    payload: { pin: string },
    ack: (res: { ok: boolean; state?: ProjectorSnapshot; error?: string }) => void
  ) => void
}

// ── Server → Client events ──────────────────────────────────────
export interface ServerToClientEvents {
  'lobby:update': (payload: { players: PlayerView[]; status: GameStatus }) => void
  'game:question': (payload: PublicQuestion) => void
  'question:result': (payload: QuestionResult) => void
  'game:over': (payload: { survivors: PlayerView[]; eliminated: PlayerView[] }) => void
  'question:progress': (payload: { questionIndex: number; answered: number; total: number }) => void
  'answer:ack': (payload: { questionIndex: number; received: boolean }) => void
  'player:eliminated': (payload: { reason: 'wrong' | 'timeout' }) => void
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
  minPlayersToEnd: number
}

/** State snapshot a projector receives on (re)join. Includes live question/result so the projector can resync mid-game without history replay. */
export interface ProjectorSnapshot {
  pin: string
  quizTitle: string
  status: GameStatus
  players: PlayerView[]
  questionIndex: number
  totalQuestions: number
  minPlayersToEnd: number
  /** Present when status === 'question'. */
  question?: PublicQuestion
  /** Present when status === 'result'. */
  result?: QuestionResult
  /** Present when status === 'ended'. */
  ended?: { survivors: PlayerView[]; eliminated: PlayerView[] }
}
