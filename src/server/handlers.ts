import type { Server, Socket } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents, HostSnapshot } from '@/types/events'
import { RoomManager } from './rooms'
import { parseQuiz } from '@/lib/quiz'

type IO = Server<ClientToServerEvents, ServerToClientEvents>
type Sock = Socket<ClientToServerEvents, ServerToClientEvents>

export function registerSocketHandlers(io: IO): RoomManager {
  const manager = new RoomManager(io)

  // sweep stale rooms hourly
  setInterval(() => manager.sweep(), 60 * 60 * 1000)

  io.on('connection', (socket: Sock) => {
    // ── Host: create room ──
    socket.on('host:create', ({ quiz, minPlayersToEnd }, ack) => {
      try {
        const parsed = parseQuiz(quiz)
        const pin = manager.createRoom(parsed, minPlayersToEnd ?? 1)
        ack({ ok: true, pin })
      } catch (e) {
        ack({ ok: false, error: e instanceof Error ? e.message : 'Invalid quiz' })
      }
    })

    // ── Host: join room channel ──
    socket.on('host:join', ({ pin }, ack) => {
      const room = manager.setHost(pin, socket.id)
      if (!room) return ack({ ok: false, error: 'Room not found' })
      socket.join(pin)
      const snapshot: HostSnapshot = {
        pin: room.pin,
        quizTitle: room.quiz.title,
        status: room.status,
        players: manager.playerViews(room),
        questionIndex: room.questionIndex,
        totalQuestions: room.quiz.questions.length,
        minPlayersToEnd: room.minPlayersToEnd,
      }
      ack({ ok: true, state: snapshot })
    })

    socket.on('host:start', ({ pin }) => manager.startGame(pin))
    socket.on('host:next', ({ pin }) => manager.nextQuestion(pin))
    socket.on('host:end', ({ pin }) => manager.endGame(pin))

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
            timeLimitSec: q.timeLimitSec,
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
