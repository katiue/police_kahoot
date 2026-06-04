import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { loadEnvConfig } from '@next/env'
import next from 'next'
import { Server } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents } from './src/types/events'
import { registerSocketHandlers } from './src/server/handlers'
import type { RoomExport } from './src/server/rooms'
import { parseQuiz } from './src/lib/quiz'

loadEnvConfig(process.cwd())

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOST || '0.0.0.0'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()
const QUIZ_DIR = path.join(process.cwd(), 'public', 'quizzes')

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function isAuthorizedRequest(req: IncomingMessage): boolean {
  const expected = process.env.LOGIN_KEY
  if (!expected) return true
  const loginKey = req.headers['x-login-key']
  return typeof loginKey === 'string' && loginKey === expected
}

function csvEscape(value: string | number): string {
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function exportToCsv(exp: RoomExport): string {
  const header = ['nickname', 'survivedUntilQuestion', 'eliminatedReason', 'joinedAt']
  const rows = exp.rows.map((row) =>
    [
      csvEscape(row.nickname),
      csvEscape(row.survivedUntilQuestion),
      csvEscape(row.eliminatedReason),
      csvEscape(row.joinedAt),
    ].join(',')
  )
  return [header.join(','), ...rows].join('\n')
}

async function listQuizzes() {
  const files = (await readdir(QUIZ_DIR)).filter((file) => file.endsWith('.json')).sort()
  const quizzes = []
  for (const file of files) {
    try {
      const raw = await readFile(path.join(QUIZ_DIR, file), 'utf8')
      const quiz = parseQuiz(JSON.parse(raw))
      quizzes.push({ file, title: quiz.title, questionCount: quiz.questions.length })
    } catch (e) {
      quizzes.push({
        file,
        title: file,
        questionCount: 0,
        error: e instanceof Error ? e.message : 'Invalid quiz',
      })
    }
  }
  return quizzes
}

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
    const pin = manager.createRoom(quiz, { minPlayersToEnd: minWinners }, fixedPin)
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
  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
    if (url.pathname === '/api/active-room' && req.method === 'GET') {
      if (!isAuthorizedRequest(req)) {
        sendJson(res, 401, { error: 'Unauthorized' })
        return
      }
      const room = manager.firstRoomSummary()
      sendJson(res, 200, { pin: room?.pin ?? null, room })
      return
    }
    if (url.pathname === '/api/quizzes' && req.method === 'GET') {
      try {
        sendJson(res, 200, { quizzes: await listQuizzes() })
      } catch (e) {
        sendJson(res, 500, { error: e instanceof Error ? e.message : 'Failed to list quizzes' })
      }
      return
    }
    if (url.pathname === '/api/export' && req.method === 'GET') {
      const pin = (url.searchParams.get('pin') ?? '').trim().toUpperCase()
      const format = (url.searchParams.get('format') ?? 'csv').toLowerCase()
      if (!pin) {
        sendJson(res, 400, { error: 'Missing pin' })
        return
      }
      const exp = manager.exportRoom(pin)
      if (!exp) {
        sendJson(res, 404, { error: 'No ended game export found for this PIN' })
        return
      }
      if (format === 'json') {
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Content-Disposition', `attachment; filename="room-${pin}-results.json"`)
        res.end(JSON.stringify(exp, null, 2))
        return
      }
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="room-${pin}-results.csv"`)
      res.end(exportToCsv(exp))
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
