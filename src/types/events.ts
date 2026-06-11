// ─────────────────────────────────────────────────────────────
// Shared Socket.IO contracts + domain types (client ↔ server)
// Single source of truth so both sides agree on payloads.
// ─────────────────────────────────────────────────────────────

export type GameStatus = 'lobby' | 'question' | 'result' | 'kahoot' | 'ended'
export type QuizDifficulty = 'easy' | 'medium' | 'hard'
export type QuestionOrderMode = 'fixed' | 'full_random' | 'difficulty_ramp'

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
  difficulty: QuizDifficulty
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
  /** Present only during Kahoot speed-round questions. */
  kahootRound?: {
    /** 1-based index within the 5 kahoot questions */
    questionIndex: number
    totalQuestions: number
  }
}

export interface PlayerView {
  id: string
  nickname: string
  connected: boolean
  eliminated: boolean
  /** Cumulative score across the whole game */
  score: number
}

/** Entry in the live leaderboard broadcast */
export interface LeaderboardEntry {
  rank: number
  id: string
  nickname: string
  score: number
  /** Score change from the last question (positive = gained points) */
  delta: number
}

export interface QuestionResult {
  questionIndex: number
  correctAnswerId: number
  /** answerId -> count of players who picked it */
  counts: Record<number, number>
  /** Ids of players eliminated this round (empty during kahoot mode) */
  eliminatedIds: string[]
  /** Per-recipient personal result (filled before emit to each socket). */
  you?: { answered: boolean; correct: boolean; eliminated: boolean; pointsEarned?: number }
}

// ── Client → Server events ──────────────────────────────────────
export interface ClientToServerEvents {
  'host:auth': (
    payload: { loginKey?: string },
    ack: (res: { ok: boolean; error?: string }) => void
  ) => void
  'host:create': (
    payload: {
      quiz: Quiz
      minPlayersToEnd?: number
      maxPlayers?: number
      timeLimitSec?: number | null
      randomizeQuestions?: boolean
      randomizeAnswers?: boolean
      questionOrderMode?: QuestionOrderMode
      loginKey?: string
      /** Players ≤ this number triggers the Kahoot speed-round. 0 = disabled. */
      kahootThreshold?: number
      kahootQuestionThreshold?: number
    },
    ack: (res: { ok: boolean; pin?: string; error?: string }) => void
  ) => void
  'host:join': (
    payload: { pin: string; loginKey?: string },
    ack: (res: { ok: boolean; state?: HostSnapshot; error?: string }) => void
  ) => void
  'host:start': (payload: { pin: string; loginKey?: string }) => void
  'host:next': (payload: { pin: string; loginKey?: string }) => void
  'host:kahoot': (
    payload: { pin: string; loginKey?: string },
    ack?: (res: { ok: boolean; error?: string }) => void
  ) => void
  'host:end': (payload: { pin: string; loginKey?: string }) => void
  'host:reset': (
    payload: { pin: string; loginKey?: string },
    ack?: (res: { ok: boolean; error?: string }) => void
  ) => void
  /** Remove one or more players from the room. */
  'host:kick': (
    payload: { pin: string; loginKey?: string; playerIds: string[] },
    ack?: (res: { ok: boolean; kicked?: number; error?: string }) => void
  ) => void

  'player:join': (
    payload: { pin: string; nickname: string; playerId?: string },
    ack: (res: { ok: boolean; playerId?: string; error?: string }) => void
  ) => void
  'player:answer': (
    payload: { pin: string; questionIndex: number; answerId: number },
    ack: (res: { ok: boolean; error?: string }) => void
  ) => void

  /** Read-only audience view of a room. Public — no auth. Omit pin to attach to
   *  the single active room (server resolves it) without exposing the passcode. */
  'projector:join': (
    payload: { pin?: string; loginKey?: string },
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
  /** Fired to a player the host removed from the room. */
  'player:kicked': (payload: { reason?: string }) => void
  /** Tells still-connected clients to re-send player:join (room was rebuilt by a reconfigure). */
  'room:rejoin': () => void
  'error:msg': (payload: { message: string }) => void
  /** Fired when active players drop to/below kahootThreshold — signals mode switch */
  'kahoot:start': (payload: {
    threshold: number
    questionThreshold: number
    survivors: PlayerView[]
    leaderboard: LeaderboardEntry[]
  }) => void
  /** Live top-10 after each question result */
  'leaderboard:update': (payload: { entries: LeaderboardEntry[] }) => void
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
  maxPlayers?: number
  timeLimitSec?: number | null
  randomizeQuestions?: boolean
  randomizeAnswers?: boolean
  questionOrderMode?: QuestionOrderMode
  kahootThreshold?: number
  kahootQuestionThreshold?: number
  kahootMode?: boolean
  leaderboard?: LeaderboardEntry[]
  /** Present when status === 'question'. */
  question?: PublicQuestion
  /** Present when status === 'result'. */
  result?: QuestionResult
  /** Present when status === 'ended'. */
  ended?: { survivors: PlayerView[]; eliminated: PlayerView[] }
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
  maxPlayers?: number
  timeLimitSec?: number | null
  randomizeQuestions?: boolean
  randomizeAnswers?: boolean
  questionOrderMode?: QuestionOrderMode
  kahootThreshold?: number
  kahootQuestionThreshold?: number
  kahootMode?: boolean
  leaderboard?: LeaderboardEntry[]
  /** Present when status === 'question'. */
  question?: PublicQuestion
  /** Present when status === 'result'. */
  result?: QuestionResult
  /** Present when status === 'ended'. */
  ended?: { survivors: PlayerView[]; eliminated: PlayerView[] }
}
