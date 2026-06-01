import { io } from 'socket.io-client'
import nextEnv from '@next/env'

const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())

const URL = process.env.SMOKE_URL || `http://localhost:${process.env.PORT || 3000}`
const loginKey = process.env.LOGIN_KEY || ''
const opts = { path: '/api/socket', transports: ['websocket'] }
const quiz = {
  title: 'Smoke',
  questions: [
    {
      id: 'q1',
      text: '2+2?',
      difficulty: 'easy',
      correctAnswerId: 1,
      answers: [
        { id: 1, text: '4' },
        { id: 2, text: '5' },
      ],
    },
  ],
}

const log = (...a) => console.log('[smoke]', ...a)
const fail = (m) => { console.error('[FAIL]', m); process.exit(1) }

const host = io(URL, opts)

host.on('connect', () => {
  log('host connected')
  host.emit('host:create', { quiz, loginKey }, (res) => {
    if (!res.ok) return fail('create: ' + res.error)
    const pin = res.pin
    log('room pin', pin)
    host.emit('host:join', { pin, loginKey }, (hj) => {
      if (!hj.ok) return fail('host:join: ' + hj.error)

      const player = io(URL, opts)
      player.on('connect', () => {
        player.emit('player:join', { pin, nickname: 'Tester' }, (pj) => {
          if (!pj.ok) return fail('player:join: ' + pj.error)
          log('player joined', pj.playerId)

          player.on('game:question', (q) => {
            log('got question:', q.text, '-> answering id1')
            player.emit('player:answer', { pin, questionIndex: q.index, answerId: 1 }, (a) => {
              if (!a.ok) return fail('answer: ' + a.error)
            })
          })

          player.on('question:result', (r) => {
            log('result: correctId=' + r.correctAnswerId, 'you=', JSON.stringify(r.you))
            if (r.correctAnswerId !== 1) return fail('wrong correctId')
            if (!r.you?.correct) return fail('player should be correct')
            log('PASS - full loop ok')
            process.exit(0)
          })

          setTimeout(() => host.emit('host:start', { pin, loginKey }), 300)
        })
      })
    })
  })
})

setTimeout(() => fail('timeout - no result in 12s'), 12000)
