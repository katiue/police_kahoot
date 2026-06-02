import type { Server, Socket } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents, HostSnapshot } from '@/types/events'
import { RoomManager } from './rooms'
import { parseQuiz } from '@/lib/quiz'

type IO = Server<ClientToServerEvents, ServerToClientEvents>
type Sock = Socket<ClientToServerEvents, ServerToClientEvents>

function isAuthorized(loginKey?: string): boolean {
  const expected = process.env.LOGIN_KEY
  if (!expected) return true
  return typeof loginKey === 'string' && loginKey === expected
}

export function registerSocketHandlers(io: IO): RoomManager {
  const manager = new RoomManager(io)

  // sweep stale rooms hourly
  setInterval(() => manager.sweep(), 60 * 60 * 1000)

  io.on('connection', (socket: Sock) => {
    socket.on('host:auth', ({ loginKey }, ack) => {
      ack(isAuthorized(loginKey) ? { ok: true } : { ok: false, error: 'Invalid login key' })
    })

    // ── Host: create room ──
    socket.on('host:create', ({ quiz, minPlayersToEnd, maxPlayers, timeLimitSec, randomizeQuestions, randomizeAnswers, loginKey, kahootThreshold }, ack) => {
      try {
        if (!isAuthorized(loginKey)) {
          ack({ ok: false, error: 'Invalid login key' })
          return
        }
        const parsed = parseQuiz(quiz)
        const pin = manager.createRoom(parsed, {
          minPlayersToEnd,
          maxPlayers,
          timeLimitSec,
          randomizeQuestions,
          randomizeAnswers,
          kahootThreshold,
        })
        ack({ ok: true, pin })
      } catch (e) {
        ack({ ok: false, error: e instanceof Error ? e.message : 'Invalid quiz' })
      }
    })

    // ── Host: join room channel ──
    socket.on('host:join', ({ pin, loginKey }, ack) => {
      if (!isAuthorized(loginKey)) return ack({ ok: false, error: 'Invalid login key' })
      const room = manager.setHost(pin, socket.id)
      if (!room) return ack({ ok: false, error: 'Room not found' })
      socket.join(pin)
      const snapshot = manager.hostSnapshot(pin) as HostSnapshot | null
      if (!snapshot) return ack({ ok: false, error: 'Room not found' })
      ack({ ok: true, state: snapshot })
    })

    /**
     * Host control events have no ack callback by design (they're fire-and-
     * forget), so a silently-rejected auth would just look like a broken
     * button. Emit error:msg back to the calling socket so the client can
     * surface it (toast + reopen auth card).
     */
    const denyHost = (event: string) => {
      socket.emit('error:msg', { message: `LOGIN_KEY hết hạn (${event}) — đăng nhập lại` })
    }
    socket.on('host:start', ({ pin, loginKey }) => {
      if (!isAuthorized(loginKey)) return denyHost('start')
      manager.startGame(pin)
    })
    socket.on('host:next', ({ pin, loginKey }) => {
      if (!isAuthorized(loginKey)) return denyHost('next')
      manager.nextQuestion(pin)
    })
    socket.on('host:end', ({ pin, loginKey }) => {
      if (!isAuthorized(loginKey)) return denyHost('end')
      manager.endGame(pin)
    })
    socket.on('host:reset', ({ pin, loginKey }, ack) => {
      if (!isAuthorized(loginKey)) return ack?.({ ok: false, error: 'Invalid login key' })
      const ok = manager.resetRoom(pin)
      ack?.({ ok, error: ok ? undefined : 'Room not found' })
    })

    // ── Projector: read-only audience view ──
    socket.on('projector:join', ({ pin }, ack) => {
      const snap = manager.projectorSnapshot(pin)
      if (!snap) return ack({ ok: false, error: 'Room not found' })
      socket.join(pin)
      ack({ ok: true, state: snap })
    })

    // ── Player: join / reconnect ──
    socket.on('player:join', ({ pin, nickname, playerId }, ack) => {
      const res = manager.joinPlayer(pin, nickname, socket.id, playerId)
      if (res.ok) socket.join(pin)
      ack(res)

      // resend live question if player reconnected mid-question
      if (res.ok) {
        const room = manager.getRoom(pin)
        if (room && room.status === 'question') {
          const q = room.quiz.questions[room.questionIndex]
          socket.emit('game:question', {
            index: room.questionIndex,
            total: room.quiz.questions.length,
            text: q.text,
            answers: q.answers.map((a) => ({ id: a.id, text: a.text })),
            timeLimitSec: room.timeLimitSec ?? q.timeLimitSec,
            endsAt: room.questionEndsAt,
          })
        }
      }
    })

    // ── Player: submit answer ──
    socket.on('player:answer', ({ pin, questionIndex, answerId }, ack) => {
      const pid = manager.findPlayerIdBySocket(pin, socket.id)
      if (!pid) return ack({ ok: false, error: 'Not in room' })
      const res = manager.submitAnswer(pin, pid, questionIndex, answerId)
      ack(res)
      socket.emit('answer:ack', { questionIndex, received: res.ok })
    })

    socket.on('disconnect', () => {
      manager.markDisconnected(socket.id)
    })
  })

  return manager
}
