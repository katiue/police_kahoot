# Rung Chuông Vàng — Realtime Quiz

Realtime Kahoot-style elimination quiz for events ("Rung Chuông Vàng" — internal codename: Police Kahoot). Host loads a quiz (JSON), opens a room (PIN + QR), players join on their phones and answer live. Server-authoritative timing + correctness; last player(s) standing win.

Theme: **Chống Lừa Đảo** cybersecurity (dark navy + neon cyan, Space Grotesk) — design reused from CLD-minigame.

## Stack

- **Next.js 15** (App Router, TypeScript)
- **Socket.IO** realtime — runs in a **custom Node server** (`server.ts`) alongside Next on **one port** (no CORS, single deploy)
- **Tailwind v4** design system
- **framer-motion** for transitions/animations
- Lightweight client state (page-local + socket events)
- In-memory room state (no DB) — fits the target: single host, <10 rooms, event use

> Architecture deviation from `ARCHITECTURE.md`: the doc proposed a *separate* Socket.IO process (needed only because Vercel can't hold WebSockets). For a single-host event app we use **one custom server** instead — simpler, no CORS, one `npm run dev`. Deploy as one Node service (Railway/Render/Fly/VPS), not Vercel. Postgres + NextAuth are deferred (live-state MVP).

## Run

```bash
npm install
npm run dev      # http://localhost:3000  (Next + Socket.IO on /api/socket)
```

Production:

```bash
npm run build
npm start
```

Smoke-test the full realtime loop (server must be running):

```bash
node scripts/smoke.mjs
```

## Routes

| Route | Who | Purpose |
|---|---|---|
| `/` | all | Landing — contains "Tham gia trò chơi" button (directs to player join) |
| `/host` | host | Direct access only — Load quiz JSON / sample → create room |
| `/host/[pin]` | host | Lobby + game control (start, next, end) |
| `/play` | player | Enter PIN + nickname (QR deep-links here with `?pin=`) |
| `/play/[pin]` | player | Live play screen (answer, result, rank) |
| `/lobby` | projector | Standby splash for a big screen; `?pin=XXXXXX` shows PIN + join QR |

## Flow

1. Host navigates directly to `/host` to create a room.
2. Click **Dùng quiz mẫu** (or upload JSON) → **Tạo phòng** → lands on `/host/<PIN>` lobby.
3. (Optional) Open **`/lobby?pin=<PIN>`** on a projector — animated standby screen showing the PIN + join QR. Link available from the host lobby.
4. Players open `/` (click **Tham gia trò chơi** to redirect to `/play`) or scan the QR, enter PIN + nickname.
5. Host clicks **Bắt đầu**. Each question: players tap an answer; server scores by correctness + speed.
6. Host advances with **Câu tiếp theo**; final screen shows the leaderboard.

## Quiz JSON format

```json
{
  "title": "My Quiz",
  "questions": [
    {
      "id": "q1",
      "text": "Question text?",
      "correctAnswerId": 1,
      "answers": [
        { "id": 1, "text": "Correct one" },
        { "id": 2, "text": "Wrong" }
      ]
    }
  ]
}
```

- `id` auto-generated if omitted; `timeLimitSec` uses server default (20s).
- Each question needs ≥2 answers and a `correctAnswerId` matching one answer `id`.
- Sample at `public/quizzes/sample.json`.

## Elimination rules

- Wrong or no-answer = player eliminated (becomes spectator).
- Game ends when active player count ≤ `minPlayersToEnd` (host-configured, default 1).
- Server is source of truth for timing + correctness (anti-cheat).

## Architecture map

| File | Role |
|---|---|
| `server.ts` | Custom server: Next.js handler + Socket.IO |
| `src/server/rooms.ts` | `RoomManager` — in-memory rooms, game engine, timers, scoring |
| `src/server/handlers.ts` | Socket.IO event wiring |
| `src/types/events.ts` | Shared client↔server contracts |
| `src/lib/scoring.ts` | Shared scoring formula |
| `src/lib/quiz.ts` | Quiz JSON validation |
| `src/lib/socket-client.ts` | Browser socket singleton |
| `src/app/host/**` | Host: create room + control game |
| `src/app/play/**` | Player: join + play |
| `src/app/lobby/**` | Projector standby display |
| `src/components/game/**` | Timer, AnswerGrid, Leaderboard, QrPanel, Backdrop |
| `scripts/smoke.mjs` | Headless end-to-end realtime test |

## Anti-cheat

- Server is source of truth for time, scoring, question progression.
- Correct-answer flag stripped from payloads sent during a live question.
- One answer per player per question; rejected after timer/first submit.
- Timer driven by absolute `endsAt` server timestamp; client only renders.

## Deferred (future scaling — see ARCHITECTURE.md)

Redis adapter + sticky sessions (multi-instance), Postgres persistence (history/leaderboard), NextAuth host login, quiz editor UI, rate limiting, monitoring.
