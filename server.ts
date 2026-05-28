import { createServer } from 'node:http'
import next from 'next'
import { Server } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents } from './src/types/events'
import { registerSocketHandlers } from './src/server/handlers'

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOST || '0.0.0.0'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res))

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    path: '/api/socket',
    cors: { origin: '*' },
  })

  registerSocketHandlers(io)

  httpServer.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`▶ police-kahoot ready on http://localhost:${port}  (socket path /api/socket)`)
  })
})
