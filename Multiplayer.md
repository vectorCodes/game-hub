# Sky Climb multiplayer: design and rollout plan

Friends race on the same tower in rooms of 1–3 players. Anyone can create a room and share
its 5-letter code or link, and friends join or leave as they like. The first player to the
summit wins. If nobody reaches it, the highest floor when time runs out wins.

**Ghosts, "beat my climb" challenge links and Live climbers stay as they are.** While you are
in a room, they just aren't loaded.

---

## 1. Goals

- **Rooms.** A room holds 1 to 3 players (solo is allowed). It has a 5-letter code such as
  `K7MPQ` and a link, `/games/sky-climb/play?room=K7MPQ`.
- **Roles.** Anyone can create a room, and the creator is the host. Anyone with the code or
  link can join until the race starts. Anyone can leave at any time.
- **Race.** Everyone climbs the same freshly seeded tower, starting at the same moment.
  - The first player to the summit wins.
  - Otherwise, at the time limit (default 5 min), the highest floor wins.
  - A tie on floor goes to whoever reached it first.
- **Rematch.** After the results, "Play again" returns the room to the lobby and draws a new
  tower.
- **Not in v1.** Player-to-player collisions (players pass through each other), spectating a
  race already in progress, and public matchmaking.

## 2. Do we need WebSockets? Webhooks?

| Mechanism | Needed? | Used for |
|---|---|---|
| **WebSocket** | **Yes** | Everything inside a room: who is there, ready/start, the countdown, live positions (10 Hz), floor progress and results |
| **HTTP** | Yes, a little | Creating a room, and peeking at one ("does K7MPQ exist, how full is it, has it started?") |
| **Webhooks** | **No** | No outside service pushes events to us. The only server-to-server call is optional and comes in phase 4: the room POSTs final standings to our API (HMAC-signed) so they can be stored |

## 3. What the existing code already gives us

- **The tower is deterministic.** `makeRng` and `generateTower(seed)` in
  `apps/web/src/games/sky-climb/tower.ts` always produce the same tower for the same seed. A
  room only has to share a seed string; tower data never has to be sent.
- **All the moving parts run on the sim clock.** Moving platforms, hazards and wind gusts are
  driven by `sim.t`, which `Sim.step` and `Sim.idle` advance in `sim.ts`; gusts use
  `t % GUST.period`. If every client resets `sim.t` at the same agreed instant, the whole
  tower moves in step for every player.
- **Remote climbers are already solved in `live.ts`.**
  - Positions are packed as `[x, y, z, facing/256, poseIdx]` in centimetres.
  - Each rider has a buffer that is drawn a little in the past and blended with `blendFrames`
    from `ghosts.ts`.
  - The `Rider` component in `scene/Ghosts.tsx` draws any climber given a `kind`.
  - The HUD height bar reads `riderMarks` from `ghosts.ts`.
- **Auth.** `apps/api/src/auth.ts` verifies Supabase JWTs with `jose` against the project's
  JWKS. The room server verifies tokens the same way, and guests are welcome.
- **Pickups are per player.** Coins and power-ups are collected in each client's own `Sim`,
  so players never compete over the same pickup.

## 4. Architecture

```
                         ┌──────────────────────────────────────────────┐
Browser ── HTTPS ───────▶│ Vercel: static web app (unchanged)           │
   │                     └──────────────────────────────────────────────┘
   │                     ┌──────────────────────────────────────────────┐
   ├──── HTTPS /api ────▶│ Render: Fastify API (runs, profile, ghosts…) │◀──┐ phase 4:
   │                     └──────────────────────────────────────────────┘   │ signed POST
   │                     ┌──────────────────────────────────────────────┐   │ of results
   └──── HTTPS + WSS ───▶│ Cloudflare Worker  (apps/realtime)           │   │
                         │   POST /rooms, GET /rooms/:code, …/ws        │   │
                         │        │ idFromName(code)                    │   │
                         │        ▼                                     │   │
                         │ ClimbRoom Durable Object (one per room) ─────┼───┘
                         │   authoritative lobby + race state           │
                         │   WebSocket Hibernation API, alarms          │
                         └──────────────────────────────────────────────┘
```

### Why Cloudflare Durable Objects

- **One instance per room.** Each room is a single-threaded instance. Enforcing the
  3-player cap, handing over the host, running the countdown and deciding the winner are
  race-free without any locking.
- **Addressing by code.** `env.CLIMB_ROOM.idFromName(code)` finds the room's instance, so
  no lookup table or database is needed.
- **Hibernation.** An idle lobby holding open sockets costs almost nothing.
- **Survives redeploys.** State lives in the Durable Object's own storage, not in a server
  process's memory.

### Why not put the WebSockets on Vercel or Render?

- **Vercel.** Its rewrites and serverless functions can't hold WebSocket connections, so the
  browser must connect straight to the Worker URL rather than through a Vercel `/api` proxy.
- **Render.** It can hold sockets, but free instances sleep. Rooms kept in memory would also
  disappear on every deploy and would tie us to a single instance.

### Worker routes (`apps/realtime/src/index.ts`)

| Route | What it does |
|---|---|
| `POST /rooms` | Generates a code from an unambiguous alphabet (no `0 O 1 I L`) and calls the DO's `init()`. It retries with a new code if the DO says that code is already in use. Returns `{ code }`. Rate-limited per IP |
| `GET /rooms/:code` | Returns `{ exists, players, status }` for the join screen |
| `GET /rooms/:code/ws` | Checks `Origin` against `ALLOWED_ORIGINS` and forwards the WebSocket upgrade to the DO |
| `OPTIONS *` | Answers CORS preflight for the web origins |

## 5. Room lifecycle (inside `ClimbRoom`)

```
lobby ──host presses Start──▶ countdown ──startAt reached──▶ racing ──▶ results
  ▲                                                                       │
  └──────────────────────────── "Play again" (new seed) ─────────────────┘
```

- **lobby**
  - Players join, leave, and toggle ready. Solo is allowed.
  - The host is the earliest player still in the room. If the host leaves, the next earliest
    takes over.
  - The host can press Start once every player is ready.
- **countdown**
  - The server picks a seed (`room-<code>-<round>-<random>`) and sets
    `startAt = now + 3500 ms`.
  - It broadcasts both values and sets an alarm for `startAt`.
- **racing**
  - The server relays positions and records each player's best floor and the time they
    reached it.
  - The race ends when every player has reached the summit or stopped, when the time-limit
    alarm fires, or when everyone has left.
- **results**
  - The server broadcasts the final standings. Players who left mid-race are marked **DNF**.
- **Rules that apply throughout**
  - A 4th connection gets `error: full`.
  - Joining during the countdown or race gets `error: started`. (Spectating could come later.)
  - **Reconnect grace.** A dropped player keeps their slot for 15 s and gets it back by
    reconnecting with the same `userId` (signed in) or `clientId` (guest).
  - **Idle cleanup.** After 30 min with nobody connected, an alarm calls
    `storage.deleteAll()`.
  - **Light anti-cheat.** Floor progress faster than `CLIMB_MIN_SECONDS_PER_FLOOR` (from
    `@shadow/shared`) is rejected. Who finished first is decided by the order the server
    received the messages, not by client clocks.
  - **Flood guard.** About 20 messages per second per socket at most. Anything beyond that is
    dropped.

## 6. Protocol (`packages/shared/src/skyClimbRoom.ts`)

The messages are Zod schemas shared by the Worker and the web app, sent as JSON. Every
message has a `type`.

**Client → server**

| type | payload | notes |
|---|---|---|
| `hello` | `{ v, token?, clientId, name, avatar }` | The first message. `token` is the Supabase access token; it goes in the message, not the URL, so it never ends up in logs. `v` is the protocol version |
| `ready` | `{ on }` | |
| `start` | – | Host only, in the lobby, when everyone is ready |
| `pos` | `{ p: [x, y, z, facing, pose] }` | The same packed format as `live.ts`, sent at 10 Hz |
| `progress` | `{ floor }` | Sent when a new highest floor is reached |
| `finish` | – | Summit, or the player stops |
| `rematch` | – | From results, back to the lobby |
| `leave` | – | |
| `ping` | `{ t }` | Clock sync |

**Server → client**

| type | payload |
|---|---|
| `welcome` | `{ you, room }` |
| `room` | `{ players[], hostId, status, seed?, startAt?, limitSec }`, sent on every change |
| `pos` | `{ id, p }` (relayed) |
| `progress` | `{ id, floor, at }` |
| `results` | `{ standings: [{ id, name, floor, ms, place, dnf }] }` |
| `pong` | `{ t, now }` |
| `error` | `{ code: "full" \| "started" \| "not_found" \| "bad_token" \| "outdated" }` |

**Constants:** `ROOM_MAX_PLAYERS = 3`, `ROOM_RACE_SECONDS = 300`, `ROOM_POS_HZ = 10`,
`ROOM_COUNTDOWN_MS = 3500`, `ROOM_PROTOCOL_VERSION = 1`.

**Clock sync.** On connecting, the client sends 5 pings and keeps the result with the lowest
round-trip time: `offset = now + rtt/2 − localNow`. The local start is `startAt − offset`.
That is the moment the client resets `sim.t` and starts stepping, so every player's
platforms, hazards and gusts line up.

## 7. Web client changes (`apps/web/src/games/sky-climb/`)

- **`room.ts` (new, modelled on `live.ts`)**
  - A WebSocket client with reconnect and backoff, clock sync, and a `useRoom()` hook built
    on `useSyncExternalStore`.
  - Move the rider buffer and the sampling code out of `live.ts` into a small shared helper
    (`RiderBuffer`, `sampleBuffer`) so Live climbers and room rivals use the same code.
  - Rivals are drawn about 200 ms behind (Live climbers use 400 ms) because positions arrive
    at 10 Hz.
- **`store.ts`**
  - Add a `room` context (`code`, `status`, `seed`) and the phases `lobby` and `countdown`.
  - When a race starts, use the room's seed, bump `attempt` and call `resetRecording()`.
    Ghost recording keeps working, and the local best is still saved.
  - In a room, don't call `loadGhosts` or `joinLive`.
  - In v1, room races are not saved as `climb_runs`. Phase 4 adds that.
- **UI: `ui/Panels.tsx` plus a new `ui/Lobby.tsx`**
  - The menu gets a **Play with friends** button, which offers **Create room** or **Join
    with code**.
  - The lobby shows the code, a copy-link button, 3 avatar slots, Ready, Start (host only)
    and Leave.
  - A 3-2-1 countdown overlay.
  - A podium on the results screen, with **Play again** and **Leave room**.
- **Scene and HUD**
  - Rivals reuse `Rider` from `scene/Ghosts.tsx` with a new kind, `"rival"`: drawn opaque,
    with a coloured name tag.
  - Add `"rival"` to `RiderKind`, so rivals appear on the height bar.
  - A small strip shows the standings: each player's floor and the time left.
- **Routing.** `SkyClimbPage.tsx` reads `?room=` and joins automatically, the same way
  `?challenge=` is handled.
- **Feature flag.** Read `VITE_REALTIME_URL`. If it is unset, hide **Play with friends**,
  the same way `liveAvailable` hides Live climbers.

## 8. Integrating Cloudflare with Vercel and Render, step by step

Vercel keeps serving the web app and Render keeps running the API. Cloudflare only adds the
room service, and the browser talks to it directly.

### Step 1: Cloudflare account and CLI (one time)

1. Create a free Cloudflare account. **You don't need to move your domain's DNS.**
2. After step 2 below, log in with `pnpm --filter realtime exec wrangler login`.

### Step 2: create the `apps/realtime` workspace

`pnpm-workspace.yaml` already includes `apps/*`.

1. `apps/realtime/package.json`:
   ```jsonc
   {
     "name": "realtime",
     "private": true,
     "type": "module",
     "scripts": {
       "dev": "wrangler dev --port 3300",
       "deploy": "wrangler deploy",
       "typecheck": "tsc -p ."
     },
     "dependencies": { "@shadow/shared": "workspace:*", "jose": "…", "zod": "…" },
     "devDependencies": { "wrangler": "…", "@cloudflare/workers-types": "…" }
   }
   ```
2. `apps/realtime/wrangler.jsonc`:
   ```jsonc
   {
     "name": "sky-climb-realtime",
     "main": "src/index.ts",
     "compatibility_date": "<today>",
     "durable_objects": {
       "bindings": [{ "name": "CLIMB_ROOM", "class_name": "ClimbRoom" }]
     },
     // The Workers Free plan requires SQLite-backed Durable Objects.
     "migrations": [{ "tag": "v1", "new_sqlite_classes": ["ClimbRoom"] }],
     "ratelimits": [{ "name": "ROOM_CREATE_LIMIT", "namespace_id": "1001", "simple": { "limit": 10, "period": 60 } }]
   }
   ```
   `ALLOWED_ORIGINS`, `SUPABASE_URL` and the optional `SUPABASE_JWT_SECRET` are kept out of
   the file. Locally they come from `apps/realtime/.dev.vars` (copy `.dev.vars.example`). In
   production, set each one with `wrangler secret put <NAME>`, so a deploy never overwrites
   them.
   ```
   ```
3. `src/index.ts` is the Worker: routes, CORS, the origin check and forwarding the upgrade.
   `src/room.ts` holds `export class ClimbRoom extends DurableObject`, which uses
   `ctx.acceptWebSocket`, `webSocketMessage`, `webSocketClose`, `alarm` and
   `serializeAttachment` so each player's details survive hibernation.
4. Wrangler bundles with esbuild, so it builds `@shadow/shared`'s TypeScript source directly
   and needs no separate build step.

### Step 3: configuration on each platform

| Where | Name | Value |
|---|---|---|
| Cloudflare (secret) | `ALLOWED_ORIGINS` | The production domain, the `game-hub-*.vercel.app` preview pattern, and `http://localhost:5173` |
| Cloudflare (secret) | `SUPABASE_URL` | The same value Render uses. The room fetches the JWKS from it to verify tokens |
| Cloudflare (secret, phase 4) | `MATCH_RESULT_SECRET` | Set with `wrangler secret put MATCH_RESULT_SECRET` |
| Cloudflare (var, phase 4) | `API_URL` | `https://<render-service>.onrender.com` |
| Vercel (all environments) | `VITE_REALTIME_URL` | `https://sky-climb-realtime.<account>.workers.dev` |
| Render (phase 4) | `MATCH_RESULT_SECRET` | The same secret, used to verify the room's POST |

- `VITE_*` variables are compiled into the build. **Redeploy on Vercel after setting one.**
- Vercel preview deployments have their own URLs. That's why `ALLOWED_ORIGINS` supports a
  `*` wildcard.

### Step 4: first deploy

1. Run `pnpm --filter realtime run deploy` (`run` matters: plain `pnpm deploy` is a built-in pnpm command). The service goes live at
   `https://sky-climb-realtime.<account>.workers.dev`.
2. Smoke test:
   ```sh
   curl -X POST https://sky-climb-realtime.<account>.workers.dev/rooms   # → {"code":"K7MPQ"}
   curl https://sky-climb-realtime.<account>.workers.dev/rooms/K7MPQ     # → {"exists":true,"players":0,"status":"lobby"}
   ```
3. Set `VITE_REALTIME_URL` on Vercel and redeploy. **Play with friends** then appears.
4. A custom domain such as `realtime.<domain>` is optional. Workers Custom Domains require
   the domain's DNS zone to be on Cloudflare. If your DNS stays with Vercel or your
   registrar, keep the `workers.dev` URL; WSS works fine on it.

### Step 5: automatic deploys (pick one)

- **Cloudflare Workers Builds.** In the dashboard, connect the GitHub repo and set:
  - root directory: `apps/realtime`
  - build command: `pnpm install`
  - deploy command: `pnpm run deploy`
- **GitHub Action.** Use `cloudflare/wrangler-action` with a `CLOUDFLARE_API_TOKEN` secret,
  triggered by changes to `apps/realtime/**` or `packages/shared/**`.

Vercel, Render and Cloudflare deploy independently, so keep the protocol backward-compatible.
`hello` carries `v`, and the server answers an unsupported version with `error: outdated`,
which tells that tab to reload.

### Step 6: Render, phase 4 only

1. Add `POST /api/sky-climb/matches` to `apps/api/src/modules/sky-climb/routes.ts`.
   - It verifies `X-Signature: HMAC-SHA256(rawBody, MATCH_RESULT_SECRET)`.
   - It inserts the standings into a new `climb_matches` table, added with a Drizzle
     migration: `pnpm --filter api db:generate -- --name climb_matches`.
   - It can award winner coins through the existing profile and coin logic.
2. When a race ends, the DO calls this endpoint with `fetch`. If Render is waking from sleep
   and the call fails, the DO retries through an alarm.
3. Apart from this, rooms never call Render. Auth is checked in the DO against Supabase's
   JWKS.

### Step 7: local development

```sh
pnpm --filter realtime dev    # Miniflare runs the Worker + Durable Objects locally on :3300
pnpm dev                      # web + API, as today
```

- In `apps/web/.env`, set `VITE_REALTIME_URL=http://localhost:3300`.
- Add `--filter realtime` to the root `dev` script so `pnpm dev` starts all three.
- Port 3300 avoids the ports already taken locally: 3000 and 5173 by another app, 3100 by
  the API and 3200 by Remotion.

### Step 8: operations

- **Logs:** `pnpm --filter realtime exec wrangler tail`. The Cloudflare dashboard shows
  request and duration metrics for the Durable Objects.
- **Cost:** The Workers Free plan includes SQLite-backed Durable Objects. With hibernation,
  connected but idle sockets aren't billed for duration, so 3-player rooms should stay within
  the free tier unless traffic gets high.
- **Abuse:**
  - Rate-limit `POST /rooms` per IP with a Workers rate-limiting binding.
  - Limit each socket to about 20 messages per second.
  - Reject origins that aren't in `ALLOWED_ORIGINS`.

## 9. Rollout phases

1. **Room server.** The shared protocol in `@shadow/shared`, then `apps/realtime` with the
   lobby, the cap, host handover, countdown, position relay and results. Test it with a tiny
   script or `websocat`.
2. **Lobby in the web app.** `room.ts`, **Play with friends**, create and join (by code and
   by `?room=` link), the lobby screen, and leaving.
3. **The race.** The synced start through clock sync, rival rendering, the standings HUD,
   and the results podium.
4. **Polish.** The reconnect grace period, rematch, results stored on Render through the
   signed POST, winner coins, and a "rooms played" stat.

## 10. Risks and notes

- **A background tab falls behind.** The sim caps `dt` at 1/30 s, so a throttled tab climbs
  more slowly. That only hurts that player, which is acceptable.
- **Network jitter.** Rivals are drawn about 200 ms behind and blended, and teleports such as
  respawns snap instead of glide; `blendFrames` already handles this.
- **Cheating.** A modified client could fake its floor. The per-floor time check catches the
  obvious cases, and this is a friends-only game, so v1 accepts the remaining risk.
- **Pickups are per player.** There is nothing to arbitrate.

## 11. How to test (when implemented)

1. Run `pnpm typecheck`.
2. Start `pnpm --filter realtime dev` and `pnpm dev`, then open 3 browser windows, one of
   them incognito.
3. Create a room in window A. Join from B with the code and from C with the link.
4. Open a 4th window and join. It should get **room full**.
5. Have B leave and rejoin. Close C's tab and reopen it within 15 s; C should keep its slot.
6. As host, press Start. All three windows should count down together, and the moving
   platforms should be in the same position in every window.
7. Race to the end and check that the standings, the winner and the DNF markers are correct.
8. Press **Play again**. The room should go back to the lobby with a new tower.
