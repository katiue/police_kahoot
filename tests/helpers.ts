import type { Server } from 'socket.io'
import type { Quiz, QuizQuestion, QuizDifficulty } from '@/types/events'

/** One recorded emit: which room/socket it targeted, the event name, payload. */
export interface Emit {
  target: string
  event: string
  payload: unknown
}

export interface MockIO {
  io: Server
  emits: Emit[]
  /** All emits for a given event name (across all targets). */
  byEvent(event: string): Emit[]
  /** All emits routed to a given target (pin or socketId). */
  byTarget(target: string): Emit[]
  /** Last payload emitted for an event, or undefined. */
  last(event: string): unknown
  reset(): void
  /** Register a fake connected socket so `.sockets.sockets.get(id).leave()` works. */
  addSocket(id: string): void
  leftRooms: Array<{ socketId: string; room: string }>
}

/**
 * Minimal Socket.IO double. Records every `io.to(x).emit(e, p)` call and
 * supports the `io.sockets.sockets.get(id).leave(room)` path used by kick.
 */
export function makeMockIO(): MockIO {
  const emits: Emit[] = []
  const leftRooms: Array<{ socketId: string; room: string }> = []
  const sockets = new Map<string, { leave: (room: string) => void }>()

  const io = {
    to(target: string) {
      return {
        emit(event: string, payload?: unknown) {
          emits.push({ target, event, payload })
        },
      }
    },
    sockets: { sockets },
  } as unknown as Server

  return {
    io,
    emits,
    leftRooms,
    byEvent: (event) => emits.filter((e) => e.event === event),
    byTarget: (target) => emits.filter((e) => e.target === target),
    last: (event) => {
      const matched = emits.filter((e) => e.event === event)
      return matched.length ? matched[matched.length - 1].payload : undefined
    },
    reset: () => {
      emits.length = 0
      leftRooms.length = 0
    },
    addSocket: (id: string) => {
      sockets.set(id, {
        leave: (room: string) => {
          leftRooms.push({ socketId: id, room })
        },
      })
    },
  }
}

let qid = 0
/** Build a quiz question with sane defaults. */
export function makeQuestion(opts: Partial<QuizQuestion> & { difficulty?: QuizDifficulty } = {}): QuizQuestion {
  qid += 1
  const id = opts.id ?? `q${qid}`
  return {
    id,
    text: opts.text ?? `Question ${id}`,
    difficulty: opts.difficulty ?? 'medium',
    timeLimitSec: opts.timeLimitSec ?? 20,
    correctAnswerId: opts.correctAnswerId ?? 1,
    answers: opts.answers ?? [
      { id: 1, text: 'correct' },
      { id: 2, text: 'wrong-a' },
      { id: 3, text: 'wrong-b' },
      { id: 4, text: 'wrong-c' },
    ],
  }
}

/** Build a quiz with `count` medium questions (correctAnswerId=1 each). */
export function makeQuiz(count: number, title = 'Test Quiz'): Quiz {
  return {
    title,
    questions: Array.from({ length: count }, (_, i) =>
      makeQuestion({ id: `q${i + 1}`, text: `Q${i + 1}` })
    ),
  }
}
