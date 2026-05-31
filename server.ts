import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import next from 'next'
import { Server } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents } from './src/types/events'
import { registerSocketHandlers } from './src/server/handlers'
import { parseQuiz } from './src/lib/quiz'

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOST || '0.0.0.0'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

/**
 * Pre-create a room at boot if EVENT_QUIZ_PATH is set.
 * Single-room event mode: one well-known PIN, host + players + projector all
 * point at it; no manual create flow needed.
 *   EVENT_QUIZ_PATH   – path to a quiz JSON (relative to cwd)
 *   EVENT_PIN         – override the room PIN (e.g. "RCV2026"); else random 6-digit
 *   EVENT_MIN_WINNERS – min players to end (default 1)
 */
async function maybeAutoCreateRoom(manager: ReturnType<typeof registerSocketHandlers>) {
  const quizPath = process.env.EVENT_QUIZ_PATH
  if (!quizPath) return null
  try {
    const raw = await readFile(path.resolve(process.cwd(), quizPath), 'utf8')
    const quiz = parseQuiz(JSON.parse(raw))
    const fixedPin = process.env.EVENT_PIN?.trim() || undefined
    const minWinners = parseInt(process.env.EVENT_MIN_WINNERS ?? '1', 10) || 1
    const pin = manager.createRoom(quiz, minWinners, fixedPin)
    // eslint-disable-next-line no-console
    console.log(`▶ event room ready  PIN=${pin}  quiz="${quiz.title}"  minWinners=${minWinners}`)
    return pin
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('▶ EVENT_QUIZ_PATH set but failed to load:', e)
    return null
  }
}

app.prepare().then(async () => {
  const httpServer = createServer((req, res) => {
    // GET /api/active-room — used by /play and /lobby to discover the event PIN
    // without the user having to type it in. Returns the first active room.
    if (req.url === '/api/active-room' && req.method === 'GET') {
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify({ pin: manager.firstRoomPin() }))
      return
    }
    handle(req, res)
  })

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    path: '/api/socket',
    cors: { origin: '*' },
  })

  const manager = registerSocketHandlers(io)
  await maybeAutoCreateRoom(manager)

  httpServer.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`▶ police-kahoot ready on http://localhost:${port}  (socket path /api/socket)`)
  })
})
