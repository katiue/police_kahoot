# Kahoot Clone — Architecture & Roadmap

> Tuned to your constraints: **<10 concurrent rooms, single host, event use, speed-build (beginner/intermediate)**.
> Key consequence: **single server, in-memory game state, no Redis/horizontal scaling for MVP.** Don't over-engineer.

---

## 0. TL;DR Decisions

| Concern | MVP choice | Why | Optimize later |
|---|---|---|---|
| Realtime | Socket.IO, single Node server | Reconnect + rooms built-in, simpler than raw WS | Redis adapter only if multi-instance |
| State | In-memory Map per room | <10 rooms fits RAM easily | Move to Redis when scaling |
| DB | Postgres + Prisma (or SQLite to start) | Host accounts + history persist | Same, just bigger instance |
| Quiz source | Load from JSON file | You asked for this; skip quiz-CRUD UI | Add quiz editor UI later |
| Auth | Host login (NextAuth), player = guest nickname | Matches real Kahoot | Player accounts later |
| Host | Vercel (Next.js) + Railway/Render (Socket.IO) | Vercel can't hold WS connections | Containerize if needed |

**Critical gotcha:** Vercel serverless **cannot** host a persistent WebSocket server. The Socket.IO server must run as a long-lived process (Railway/Render/Fly/your own VPS). Next.js app can stay on Vercel and talk to it. This single fact shapes the whole deploy.

---

## 1. High-Level Architecture

```
┌─────────────┐         ┌──────────────────┐        ┌──────────────┐
│  Host UI    │  HTTP   │  Next.js App     │  SQL   │  Postgres    │
│ (Next.js)   ├────────►│  (App Router)    ├───────►│  via Prisma  │
│             │         │  - auth          │        │  users, quiz │
│  Player UI  │         │  - REST API      │        │  sessions    │
│ (Next.js)   │         └──────────────────┘        └──────────────┘
└──────┬──────┘
       │ WebSocket (Socket.IO)
       ▼
┌──────────────────────────────┐
│  Realtime Server (Node)      │
│  - room state in memory      │   ← single process, <10 rooms
│  - timers, scoring, events   │
│  - writes results to Postgres│
└──────────────────────────────┘
```

**Components & necessity:**

| Component | Role | MVP? | Notes |
|---|---|---|---|
| **Frontend (Next.js)** | Host dashboard + player game screen | ✅ Required | App Router, TS, Tailwind |
| **REST API** | Auth, load quiz JSON, fetch history/leaderboard | ✅ Required | Next.js route handlers |
| **Realtime layer (Socket.IO)** | Live game flow, sync, timers | ✅ Required | Separate Node process |
| **Database (Postgres)** | Host accounts, saved game sessions, leaderboard history | ✅ Required (you chose to persist) | SQLite ok to start |
| **Auth (NextAuth)** | Host login only | ✅ Required | Players need none |
| **Redis** | Pub/sub + shared state | ❌ Skip for MVP | Add only when >1 server instance |
| **Queue/monitoring** | Async jobs, metrics | ❌ Skip | Not needed at this scale |

---

## 2. Tech Stack

| Layer | Pick | Why / Tradeoff | Beginner-friendly? |
|---|---|---|---|
| Framework | **Next.js 15 App Router** | One repo for host + player UI + REST | ✅ |
| Language | **TypeScript** | Shared event/payload types client↔server = fewer realtime bugs | ✅ |
| Realtime | **Socket.IO** | Rooms, auto-reconnect, ack callbacks free. Raw WS = you rebuild all that | ✅ (vs raw WS / Pusher) |
| DB | **Postgres** (or **SQLite** for dev) | Relational fits quiz→question→response. SQLite = zero setup to start | ✅ |
| ORM | **Prisma** | Type-safe queries, easy migrations | ✅ |
| Auth | **NextAuth (Auth.js)** | Drop-in Google/email login for host | ✅ |
| State (client) | **Zustand** | Tiny, less boilerplate than Redux | ✅ |
| Server cache | **React Query** (TanStack) | For REST data (quiz list, history) | ✅ |
| Styling | **Tailwind + shadcn/ui** | Fast, responsive | ✅ |
| Deploy | **Vercel** (Next) + **Railway/Render** (Socket.IO) | See §0 gotcha | ✅ |
| Container | **Docker** | Only for the Socket.IO server, optional | ⚠️ skip if Railway buildpack works |

**Alternatives considered:** Pusher/Ably (managed realtime — even simpler, but paid + less control); raw WebSocket (more code, no reconnect). For your scale Socket.IO is the sweet spot.

---

## 3. Database Design

Persist: **host accounts, game history, leaderboard**. Quiz comes from JSON (optionally cached in DB). Live game state stays in memory, **not** DB.

```
User (host)
  id, email, name, image, createdAt

Quiz                       # optional: import JSON into DB, or keep file-only
  id, ownerId→User, title, sourceJson(jsonb), createdAt

Question                   # only if you normalize quiz into DB
  id, quizId→Quiz, text, timeLimitSec, points, order

Answer
  id, questionId→Question, text, isCorrect(bool), order

GameSession                # one row per played game
  id, quizId, hostId→User, pin, status(lobby|running|ended),
  startedAt, endedAt

Player                     # guest, scoped to a session
  id, sessionId→GameSession, nickname, socketId, score, joinedAt

Response                   # one row per answer submitted
  id, sessionId, playerId→Player, questionId, answerId,
  isCorrect, responseMs, pointsAwarded, createdAt
```

**Relationships:**
- User 1—N Quiz 1—N Question 1—N Answer
- GameSession 1—N Player 1—N Response
- Leaderboard = **derived**, not a table → `SELECT nickname, SUM(pointsAwarded) ... GROUP BY player ORDER BY score DESC`.

**What lives where:**

| Data | Memory (live) | Redis (later) | Postgres |
|---|---|---|---|
| Current question index, timer state | ✅ | ✅ when scaling | ❌ |
| Connected players, live scores | ✅ | ✅ | ✅ snapshot at end |
| Submitted answers (final record) | buffer | — | ✅ |
| Quiz definition | loaded from JSON | — | optional |
| Final leaderboard / history | — | — | ✅ |

Rule: **transient = memory, permanent = Postgres.** Write to DB at key moments (player join, each response, game end) so a crash loses little.

---

## 4. Realtime System Design

### Flows

**Host starts game**
1. Host logs in → loads quiz JSON → `POST /api/sessions` creates GameSession + PIN.
2. Host opens lobby screen, Socket.IO connects, `host:join { sessionId }` → joins room `room:{pin}`.
3. Players appear live as they join.
4. Host clicks Start → `host:start` → server sets state `running`, emits `game:question` (sanitized, **no correct answer**) + starts countdown.

**Player joins**
1. Player enters PIN + nickname → socket connects → `player:join { pin, nickname }`.
2. Server validates PIN/state, creates Player row, joins room, ack `{ ok, playerId }`.
3. Server broadcasts `lobby:update { players[] }` to host + everyone.

**Answer submitted**
1. Player → `player:answer { questionId, answerId }` (with server-side timestamp).
2. Server checks: question still open? player not already answered? → compute correctness + score from **server clock**, never client time.
3. Persist Response, update in-memory score, ack player `{ correct, points }`.
4. When all answered OR timer hits 0 → server emits `question:result` (correct answer + per-option counts) then `leaderboard:update`.

**Leaderboard update**
- Server keeps `Map<playerId, score>` in memory, sorts top N after each question, emits `leaderboard:update { top: [...] }`. Cheap at this scale.

### Socket.IO Events

| Event | Dir | Payload |
|---|---|---|
| `player:join` | C→S | `{ pin, nickname }` → ack `{ ok, playerId }` |
| `host:join` | C→S | `{ sessionId }` |
| `lobby:update` | S→C | `{ players[] }` |
| `host:start` / `host:next` / `host:pause` / `host:end` | C→S | `{ sessionId }` |
| `game:question` | S→C | `{ index, total, text, options[], timeLimit }` (no correct flag) |
| `game:countdown` | S→C | `{ remainingMs }` (or client ticks from `endsAt`) |
| `player:answer` | C→S | `{ questionId, answerId }` → ack `{ correct, points }` |
| `question:result` | S→C | `{ correctAnswerId, counts, yourResult }` |
| `leaderboard:update` | S→C | `{ top[] }` |
| `game:over` | S→C | `{ finalLeaderboard[] }` |
| `disconnect` / reconnect | both | rejoin via stored `playerId` |

### Sync & anti-cheat (basic)

- **Server is source of truth** for time, scoring, question progression. Client only renders.
- Send `endsAt` (absolute server time) once; client counts down locally → no per-second spam.
- Strip `isCorrect` from any payload sent before the question closes.
- Reject answers after timer or after first submit (one answer per player per question).
- Score on **server-measured** response time (`receivedAt - questionStartAt`), not client-reported.
- Reconnect: on `connection`, client sends saved `playerId`; server re-adds to room + resends current question state.

---

## 5. Development Roadmap

| Phase | Goal | Key tasks | Depends on | Difficulty | Pitfalls |
|---|---|---|---|---|---|
| **1. Setup** | Repo runs | Next.js+TS, Tailwind, Prisma, ESLint, env config, deploy skeleton | — | 🟢 Easy | Realtime server is a *separate* process — plan it now |
| **2. Auth** | Host can log in | NextAuth (Google/email), protect host routes | 1 | 🟢 Easy | Don't gate player routes |
| **3. Quiz load** | Load quiz from JSON | Define JSON schema, validate (Zod), preview UI | 1 | 🟢 Easy | Validate file — bad JSON crashes game |
| **4. Room system** | Create/join room by PIN | Session model, PIN gen, join flow, lobby UI | 2,3 | 🟡 Medium | PIN collisions — check uniqueness among *active* sessions |
| **5. Realtime gameplay** | Live Q&A loop | Socket.IO server, events, timers, state machine | 4 | 🔴 Hard | Timer drift, race conditions, double-submit |
| **6. Scoring** | Speed+accuracy points | Server-side scoring formula | 5 | 🟡 Medium | Never trust client time |
| **7. Leaderboard** | Live + final ranking | In-memory sort + emit, persist final | 6 | 🟢 Easy | Recompute, don't store running totals naively |
| **8. Persistence** | Save history | Write sessions/responses to Postgres | 5,6 | 🟢 Easy | Write incrementally, not just at end |
| **9. Reconnect** | Handle drop/rejoin | playerId resume, state resync | 5 | 🔴 Hard | Ghost players, duplicate sockets |
| **10. Deploy + test** | Live | Vercel + Railway, env, load test ~50 players | all | 🟡 Medium | WS on Vercel won't work (§0); CORS between domains |

**Scoring formula (suggested):**
`points = correct ? round(basePoints * (1 - 0.5 * responseMs / timeLimitMs)) : 0`
→ correct + fast ≈ full points; correct + slow ≈ half; wrong = 0. Tune `basePoints` (e.g. 1000).

---

## 6. Folder Structure

```
/                          # Next.js (Vercel)
├─ app/
│  ├─ (host)/
│  │  ├─ login/
│  │  ├─ dashboard/        # quiz list, load JSON
│  │  └─ host/[pin]/       # host game control screen
│  ├─ (player)/
│  │  ├─ join/             # enter PIN + nickname
│  │  └─ play/[pin]/       # player game screen
│  └─ api/
│     ├─ auth/[...nextauth]/
│     ├─ quizzes/          # load/validate JSON
│     └─ sessions/         # create session, get history/leaderboard
├─ components/
│  ├─ host/  player/  shared/   # QuestionCard, Timer, Leaderboard, PinDisplay, QRCode
├─ lib/
│  ├─ socket-client.ts     # client socket singleton + hooks
│  ├─ scoring.ts           # shared formula (import on server)
│  ├─ quiz-schema.ts       # Zod schema for JSON
│  └─ prisma.ts
├─ stores/                 # Zustand: gameStore, lobbyStore
├─ types/events.ts         # shared Socket.IO event/payload types
├─ prisma/schema.prisma
└─ quizzes/*.json          # sample quiz files

/realtime-server/          # separate Node process (Railway/Render)
├─ src/
│  ├─ index.ts             # Socket.IO bootstrap
│  ├─ rooms.ts             # in-memory Map<pin, RoomState>
│  ├─ handlers/            # join, answer, host-control
│  ├─ game-engine.ts       # state machine + timers
│  └─ db.ts                # Prisma client for writes
└─ Dockerfile              # optional
```

> Keep `types/events.ts` and `scoring.ts` shared (monorepo or copied package) so client and server agree on contracts.

---

## 7. API Design (REST — non-realtime only)

| Endpoint | Method | Payload | Response | Auth |
|---|---|---|---|---|
| `/api/auth/*` | — | NextAuth | session | — |
| `/api/quizzes` | GET | — | `[{id,title}]` | Host |
| `/api/quizzes/import` | POST | `{ json }` | `{ quizId }` (validated) | Host |
| `/api/sessions` | POST | `{ quizId }` | `{ sessionId, pin }` | Host |
| `/api/sessions/:id` | GET | — | session + status | Host |
| `/api/sessions/:id/leaderboard` | GET | — | `{ top[] }` (final) | Host |
| `/api/sessions/:id/history` | GET | — | responses, stats | Host |

**Everything live (join, start, answer, live leaderboard) goes over Socket.IO, not REST.** REST is for setup + post-game reporting only.

---

## 8. State Management

| Kind | Where | Tool | Example |
|---|---|---|---|
| Client UI state | Browser | **Zustand** | current question, my answer, timer display |
| Server-cached REST data | Browser | **React Query** | quiz list, game history |
| Realtime/live game state | Realtime server RAM | **Map** | room → players, scores, question index |
| Auth/session | Cookie | NextAuth | host identity |
| Cache (future) | — | Redis | only when >1 server |

Rule of thumb: **Socket.IO pushes live state → Zustand holds it for render. React Query never touches live game data.** Don't put realtime state in React Query (it polls; you want push).

---

## 9. Scaling Considerations (future, NOT for MVP)

You're at <10 rooms/1 host — **single process handles this comfortably.** Only if you grow:

| Need | Solution | Trigger |
|---|---|---|
| Multiple server instances | **Redis adapter** for Socket.IO (pub/sub broadcasts across nodes) | >1 instance |
| Sticky sessions | LB config so a socket stays on its node | horizontal scale |
| Shared live state | Move room Map → Redis | multi-node |
| Burst writes | **Queue** (BullMQ) for Response writes | thousands of answers/sec |
| Abuse | **Rate limiting** on join/answer | public exposure |
| Visibility | **Monitoring** (logs, Sentry, basic metrics) | production |

**Don't build any of this now.** Designing the room state behind a clean interface (`getRoom/setRoom`) is enough to swap memory→Redis later without rewrite.

---

## 10. MVP Recommendation

**Build first (core loop):**
1. Setup + host auth
2. Load quiz from JSON
3. Create room + PIN, player join with nickname
4. Realtime question → answer → result → next
5. Server-side scoring + live leaderboard
6. Game over screen + save final result to DB

**Postpone:**
- Quiz editor UI / full CRUD (you load JSON — skip the builder)
- QR code (nice-to-have; PIN entry is enough day 1 — QR is ~1hr later)
- Player accounts, detailed analytics dashboards
- Redis, queues, multi-instance scaling
- Pause/resume polish (basic end is fine first)

**Minimal arch to launch:** Next.js (Vercel) + one Socket.IO Node server (Railway) + Postgres + in-memory room state. That's it.

**Avoid over-engineering:**
- ❌ Redis / pub/sub at <10 rooms
- ❌ Microservices — one realtime process is plenty
- ❌ Normalizing quiz into 3 tables if you only load JSON — store the JSON blob
- ❌ Kubernetes / Docker orchestration — buildpack deploy is fine
- ❌ Custom WebSocket protocol — Socket.IO gives you reconnect free
- ❌ Premature optimization of leaderboard — sorting 200 numbers is instant

**Riskiest part = Phase 5 (realtime game engine).** Build that earliest with a hardcoded 2-question quiz to nail the state machine + timers before adding polish.
