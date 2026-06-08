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
      ack(isAuthorized(loginKey) ? { ok: true } : { ok: false, error: 'Mã đăng nhập không đúng' })
    })

    // ── Host: create room ──
    socket.on('host:create', ({ quiz, minPlayersToEnd, maxPlayers, timeLimitSec, randomizeQuestions, randomizeAnswers, questionOrderMode, loginKey, kahootThreshold }, ack) => {
      try {
        if (!isAuthorized(loginKey)) {
          ack({ ok: false, error: 'Mã đăng nhập không đúng' })
          return
        }
        const parsed = parseQuiz(quiz)
        // Single fixed-room mode: reuse the well-known PIN (EVENT_PIN, else the
        // current room's PIN) so applying settings reconfigures THE room instead
        // of minting a new code students don't have.
        const fixedPin = process.env.EVENT_PIN?.trim() || manager.firstRoomPin() || undefined
        const pin = manager.createRoom(parsed, {
          minPlayersToEnd,
          maxPlayers,
          timeLimitSec,
          randomizeQuestions,
          randomizeAnswers,
          questionOrderMode,
          kahootThreshold,
        }, fixedPin)
        ack({ ok: true, pin })
      } catch (e) {
        ack({ ok: false, error: e instanceof Error ? e.message : 'Quiz không hợp lệ' })
      }
    })

    // ── Host: join room channel ──
    socket.on('host:join', ({ pin, loginKey }, ack) => {
      if (!isAuthorized(loginKey)) return ack({ ok: false, error: 'Mã đăng nhập không đúng' })
      const room = manager.setHost(pin, socket.id)
      if (!room) return ack({ ok: false, error: 'Không tìm thấy phòng' })
      socket.join(pin)
      const snapshot = manager.hostSnapshot(pin) as HostSnapshot | null
      if (!snapshot) return ack({ ok: false, error: 'Không tìm thấy phòng' })
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
      if (!isAuthorized(loginKey)) return ack?.({ ok: false, error: 'Mã đăng nhập không đúng' })
      const ok = manager.resetRoom(pin)
      ack?.({ ok, error: ok ? undefined : 'Không tìm thấy phòng' })
    })
    socket.on('host:kick', ({ pin, loginKey, playerIds }, ack) => {
      if (!isAuthorized(loginKey)) return ack?.({ ok: false, error: 'Mã đăng nhập không đúng' })
      const res = manager.kickPlayers(pin, Array.isArray(playerIds) ? playerIds : [])
      ack?.(res)
    })

    // ── Projector: public read-only audience view (no auth) ──
    // No PIN → attach to the single active room. The passcode is never sent to
    // this open screen, so it can't leak via an unauthenticated projector.
    socket.on('projector:join', ({ pin }, ack) => {
      const resolvedPin = (pin && pin.trim().toUpperCase()) || manager.firstRoomPin()
      if (!resolvedPin) return ack({ ok: false, error: 'Chưa có phòng' })
      const snap = manager.projectorSnapshot(resolvedPin)
      if (!snap) return ack({ ok: false, error: 'Không tìm thấy phòng' })
      socket.join(resolvedPin)
      socket.join(`projector:${resolvedPin}`)
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
      if (!pid) return ack({ ok: false, error: 'Không ở trong phòng' })
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
