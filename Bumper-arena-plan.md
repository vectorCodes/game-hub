# GameHub · Bumper Arena plan

Sumo in bumper rings. Every player is their own GameHub avatar sitting in a round, squishy
bumper ring on a floating arena. Drive, dash and shove your friends off the edge; the last
ring on the arena wins the round. Rooms of 2–4 friends, rounds of about a minute, a match of
5 rounds, an instant rematch. It is played on **computers and tablets, not phones**: a
phone's screen is too small to follow a whole arena of rings with room left for the thumbs.
Tablets get one stick and two buttons; the fixed camera shows the whole arena.

Solo players get the **Daily Gauntlet**: the same seeded arena and bot waves for everyone,
one life, a shareable score. That keeps Bumper Arena in the hub's daily loop, not only a
party game.

Status: ✅ done · ⏳ next · ⬜ planned

---

## 1. Why this game, and why it fits the hub

- **It's the party game tablets can play.** Prop Hunt is desktop only; Bumper Arena works
  on a computer or a tablet. A round is short enough for a quick break.
- **Every round makes a story.** The last-second dodge that sends the attacker flying, the
  two players who team up and then betray each other, the player who falls off alone.
- **Easy to learn, deep to master.** Move and dash is all you need. Braces, timing, edge
  play and pickups are what good players use.
- **Most of it already exists:**
  - **Avatars** (`apps/web/src/avatar/`): the rider is the player's own character.
  - **Rooms** (`apps/realtime/src/roomCore.ts`): codes, links, lobby, host handover,
    reconnecting, countdown, rate limits and saving results.
  - **Input** (`prop-hunt/input.ts`, Sky Climb's touch stick): keyboard, gamepad-like
    touch stick.
  - **Results, XP and coins**: the signed results POST and XP gains that Prop Hunt uses.
- **What's new:** a server-authoritative physics sim (players hit each other, so one judge
  must decide), client prediction, and bots.

---

## 2. The game

### Name and tagline

- **Title:** Bumper Arena · **short title:** Bumper
- **Tagline:** "Bump your friends off the edge. Last ring rolling wins."
- **Route:** `/games/bumper-arena` (landing), `/games/bumper-arena/play` (game),
  `/games/bumper-arena/play?room=K7MPQ` (a room).

### Modes

| Mode | Players | What it is |
|---|---|---|
| **Party** (rooms) | 2–4 friends | The main mode, every ring for itself. Code or link, host picks the map and rules, a match of rounds. |
| **Daily Gauntlet** | Solo | Same seeded arena + modifier for everyone. Survive waves of bots. One life, one scored run a day (practice runs unlimited). |
| **Practice** | Solo + 1–7 bots | Any unlocked map, any bot level, nothing at stake. Also the tutorial. |

### A party match

```
lobby ──▶ countdown (3 s) ──▶ round (~60–90 s) ──▶ round results (6 s) ──▶ … ×5 ──▶ podium
```

1. **Lobby.** Players join with the code. The host picks:
   - Map: one map, or **Rotation** (a different map each round, the default).
   - Rounds: 3 / **5** / 7.
   - Pickups: **on** / off.
   - Bots: fill empty seats up to N with bots (off by default) ⬜ phase 5.
2. **Countdown.** Everyone spawns evenly around the arena, facing the middle, frozen for 3 s.
3. **Round.** Shove people off. A ring that leaves the arena falls and is **out** for the
   round. Out players watch (the camera stays on the whole arena anyway) and can still send
   emotes.
4. **Sudden death.** At 60 s, the arena starts shrinking (each map has its own way, §2 maps).
   At 90 s it's tiny. Nobody can hide forever.
5. **Round ends** when one ring is left (or none: if the last two fall together, the one who
   fell second wins; a true tie shares the win).
6. **Podium** after the last round: top 3 on a little podium with their avatars cheering,
   plus fun titles (§Scoring). **Play again** returns everyone to the lobby with the same
   settings.

### Controls

| Action | Desktop | Tablet |
|---|---|---|
| Drive | WASD / arrows | Floating stick, left half of the screen |
| **Dash** | Space | Big button, bottom right |
| **Brace** | Shift (hold) | Smaller button above Dash (hold) |
| Emotes | 1–4 | Emote wheel button, top right |

- **Drive:** steer and accelerate. The ring has momentum: you slide, you don't stop dead.
- **Dash:** a burst forward (≈2.2× top speed for 0.25 s). Cooldown 2.5 s, shown as a ring
  around the button and a glow on the bumper. Dash hits push hardest.
- **Brace:** while held, you are 2× heavier (shoved less) but drive at 40% speed and can't
  dash. Max 1.5 s, then a 2 s cooldown. Great at the edge; bad if you're caught moving.
- That's it: no jump, no aim. Everything works with one thumb plus one or two buttons.

### Knockback and the Wobble meter

Smash-style: the more you've been hit, the further you fly.

- Each player has a **Wobble** meter, 0–150%, shown as a small arc under their ring and in
  the HUD. It resets every round.
- Getting bumped adds Wobble (a dash hit +20%, a plain bump +8%, a shockwave +15%).
- Knockback you receive = base × (1 + Wobble / 100). At 0% you're hard to move; at 120%
  you're a pinball.
- Wobble drains slowly (−3% a second) while nobody touches you, so hiding briefly helps but
  doesn't reset you.
- Your ring visibly wobbles and its face (see §Characters) looks dizzier as Wobble grows. At
  100%+ little stars spin over the avatar's head.

### Scoring (party)

| Event | Points |
|---|---|
| Win the round (last ring) | +5 |
| 2nd / 3rd to last | +3 / +2 |
| Knock someone out (you were the last to hit them, within 3 s) | +2 |
| Fall off with nobody touching you in the last 3 s ("self-out") | 0, and it counts for the title below |

The most points after the last round wins the match (ties: more round wins, then more KOs).

**Podium titles** (just for fun, shown on the podium and in share text):

| Title | Who |
|---|---|
| **Bully** | Most knockouts |
| **Unbudgeable** | Lowest total Wobble taken |
| **Gravity's Friend** | Most self-outs |
| **Pinball** | Highest Wobble ever reached and survived |
| **Last Second** | Won a round with under 5 s of sudden death left |

### Pickups (party and gauntlet, can be turned off)

One pickup spawns at a random safe spot every 12 s (max 2 on the arena). Drive over to grab
it. A pickup is a floating capsule with an icon; it pulses for 1 s before it appears, so
nobody gets it by pure luck.

| Pickup | Effect | Duration |
|---|---|---|
| **Heavyweight** (anvil) | Ring grows 1.4×, mass 2.5×, a bit slower | 6 s |
| **Turbo** (lightning) | Dash cooldown 0.6 s | 5 s |
| **Shockwave** (ring) | Next Dash also blasts everyone within 3 m outward | one use |
| **Bubble** (shield) | The next hit you take is absorbed (no Wobble, no knockback) | until hit or 8 s |
| **Banana** (peel) | Drops a slick patch behind you; anyone on it loses grip for 1.5 s | patch lasts 10 s |

All five come from Kenney kits (Food Kit banana, Platformer Kit items) or are tiny
hand-made GLBs.

### Emotes

Four emotes on 1–4 or the wheel: **Wave**, **Laugh**, **Taunt** ("come at me" hand gesture),
**Cry**. They play a Mini Characters animation on the rider and a speech-bubble icon. 1.5 s
cooldown. Out players can emote too: that's half the fun of watching.

---

## 3. Characters: avatar + bumper ring

- **The rider is the player's GameHub avatar** (`apps/web/src/avatar/`), sitting inside the
  ring, visible from the waist up. Their hat and eyewear show.
- **The ring** is a chunky low-poly bumper ring (a short, fat torus with a rubber bumper
  band), about 1.2 m across. One hand-made GLB with a recolourable body (palette texture,
  like the avatars), so it matches Kenney's style.
- **Animations** (all from Mini Characters' 32 clips):
  - Idle in the ring: `sit` with a small bob.
  - Driving: lean into the direction of travel (a bone offset, not a clip).
  - Dash: `sprint` pose for the burst, arms forward.
  - Hit: a quick `hit`/flinch.
  - Falling off: `fall` with flailing, ring and rider tumble down, a little "boing" puff.
  - Win: `emote-yes` / cheer on the podium; loser: `emote-no`.
- **Ring skins** (cosmetic, the game's own unlock track):

Every skin can be earned through its challenge or bought with coins.

| Skin | How to earn it |
|---|---|
| Classic (any colour of 8) | Default |
| Rubber Duck | 10 rounds won |
| Donut (sprinkles) | Daily Gauntlet: wave 10 |
| Tractor Tyre | 50 knockouts |
| Lifebuoy | Survive at 120%+ Wobble |
| Saucer (UFO) | Coins, or reach deep space in Sky Climb (cross-game) |
| Golden Ring | Win 25 matches |

- **Cross-game avatar unlock:** **Crash Helmet** (a hat worn in every game) for winning 10
  party matches. Goes into the shared catalog like the crown and wizard hat.
- **Bots** wear random avatar configs (from the free items only) with names like
  "Bumpy", "Wobbles", "Sir Shove", "Donut Dan", so it's always clear they are bots (a small
  robot tag next to the name).

---

## 4. Maps

All arenas float in the sky above a soft, far-away world (falling off is falling into the
clouds), so the edge is always obvious and falls read clearly. Each map is a flat-ish arena,
full size from 4 rings (a full party room), 85% for 2 rings, with **one twist**.
Built from Kenney Platformer Kit / Nature Kit / Food Kit pieces and simple meshes.

**8 maps: 4 at launch, 4 later.**

### Launch maps

| # | Map | Shape | Twist | Sudden death |
|---|---|---|---|---|
| 1 | **Picnic Plate** | Round, 16 m radius (8 rings) | None: the clean, learnable map. Tutorial and Practice default. | The rim crumbles inward in rings |
| 2 | **Ice Floe** | Round floe of cracked ice | Grip ×0.42 everywhere: you glide, momentum is king. | The rim breaks off a ring at a time |
| 3 | **Spinner** | Round, with a post in the middle | A bar through the post sweeps round (one turn every 9 s, up to every 4 s by 90 s); it carries rings along and adds Wobble. | The rim breaks off; the bar keeps speeding up |
| 4 | **Hex Hive** | Honeycomb of hex tiles | Tiles wear under the rings on them: 2.5 ring-seconds and a tile cracks, 2 s later it drops. Fights eat the floor; keep moving. A quick ring skims across a hole (0.3 s). | Outer tiles crack from the edge in (from 50 s) |

### Later maps ⬜

| # | Map | Twist |
|---|---|---|
| 5 | **Birthday Cake** | Three tiers; drop down a tier by driving off, you only lose when you fall off the bottom. Candles are bumpers that bounce you. |
| 6 | **Conveyor Factory** | Strips of conveyor belts run toward the edge, and switch direction every 10 s (arrows flash first). |
| 7 | **Seesaw** | A big plate balanced on a point: it tilts toward where the most weight is. Crowd one side and everyone slides. |
| 8 | **Moon Base** | Sky Climb's deep-space look. Low gravity: knockback sends you much further, and falling rings drift. Craters are slower ground. |

**Map data:** each map is pure data in `packages/shared/src/bumperMaps.ts`: the floor shape
(circle, polygon, or a list of hex tiles), spawn points, hazards (spinner arms, belts,
bumpers) with their timing, friction, gravity, and the sudden-death script. The physics
uses only that data; the web client also loads the map's art.

### Daily Gauntlet

- **Seeded** from the date (server-picked like the other dailies): one of the unlocked maps +
  one **modifier** + the bot waves.
- **Modifiers:** Classic (Gauntlet #1 always), Slippery (grip about ×0.5), Big Rings (rings
  1.3×), Heavy Hitters (all knockback ×1.3), Low Gravity (longer slides, slow falls), No
  Brakes (no Brace). Pickup Party comes back with pickups (phase 4).
- **Waves:** wave 1 = 1 easy bot, wave 2 = 2, … bots get smarter and more numerous; at most
  6 bots on the arena. A wave is cleared when every bot is out. The arena resets between
  waves (and your Wobble drops by half).
- **Score:** 100 × k for clearing wave k (so 1+2+…+n hundred for n waves), plus 25 a
  knockout; ties go to the quicker run. One scored run a day per account (guests: per
  device); re-runs after are free. The server checks a run against its own clock (at least
  5 s a wave) and refuses more knockouts than there were bots.
- **Share text:**

  ```
  Bumper Arena · Gauntlet #12 · Ice Floe, Slippery
  🛟🛟🛟🛟🛟🛟🛟💥  7 waves
  14 KOs · peak wobble 132%
  gamehub…/games/bumper-arena
  ```

- **Leaderboard:** daily top on `/leaderboard`, like Sky Climb.

---

## 5. Camera, look and feel

- **Action camera**, high and angled (about 55°), framing the rings still on the arena
  (yours among them while you're in): close in while they're bunched up, pulling back as
  they spread, never further than the whole plate. The arenas are big (Picnic Plate is 16 m
  across the radius for 8 rings), so a whole-plate view would make riders tiny. No camera
  controls at all, which is why it works on tablets.
- **Your ring** gets a coloured outline and an arrow over it for the first 3 s of each round.
- **Juice:**
  - Hit-stop: 60 ms freeze on big hits, a little camera shake, a "BONK" puff.
  - Squash and stretch on the ring when it hits.
  - Speed lines on dash; a whistle as someone falls; a crowd "ooh" on a KO.
  - Wobble stars, dizzy face.
- **Paper / editorial UI**, like the rest of GameHub: names over rings, the Wobble arc,
  round number, a timer that turns red in sudden death, a kill feed ("Ana bumped Raj out").
- **Performance target:** 60 fps on a mid-range tablet with 8 riders. One directional light
  with a small shadow map (arena only), baked sky, instanced hex tiles.

---

## 6. Architecture

### Who decides what

Prop Hunt lets each client move itself. That doesn't work here: two players collide, and
both can't be right about who pushed whom. So **the room's Durable Object runs the physics**
and is the only judge.

| Thing | Who decides |
|---|---|
| Positions, velocities, collisions, knockback, falling out | **Server** (sim at 30 Hz) |
| Your own ring's movement, between server updates | **Your client predicts it**, then corrects to the server |
| Other rings | **Client draws them ~100 ms in the past**, blending server snapshots (like Sky Climb's live riders) |
| Pickups, hazards, sudden death, scores, round end | **Server** |
| Emotes | Client asks, server relays |

### The shared sim (`packages/shared/src/bumperSim.ts`)

One pure TypeScript sim that runs in three places: the room server, the client (to predict
your own ring), and solo modes (Practice / Gauntlet, where it's the whole game).

- **2D physics on the floor plane** plus a simple fall: every ring is a circle (radius,
  mass, position, velocity, facing), so collisions are circle-vs-circle and
  circle-vs-segment. No physics engine needed; this is a few hundred lines and very cheap.
- Fixed step 1/30 s, seeded RNG (`makeRng`, as in Sky Climb) for pickups and bots.
- **Each step:** apply input (accelerate toward the stick direction, cap speed, friction) →
  dash/brace timers → move → ring-vs-ring collisions (impulse with restitution 0.9, plus
  the knockback bonus from Wobble, with the dasher's bonus) → ring-vs-hazard → pickups →
  "is the centre off the floor?" → falling → out.
- **KO credit:** each ring remembers who hit it last and when; if it falls within 3 s, that
  player gets the KO.
- Same code, same numbers: tuning lives in `bumper.ts` constants.

### Netcode

- **Client → server: inputs**, not positions: `{ seq, stick: [x, z] (int8), dash, brace }`.
  Sent at **15 Hz, and only when they change** (plus a keep-alive every 500 ms). This matters
  for cost; see §9.
- **Server → clients: snapshots** at 15–20 Hz: the step number, plus for each ring
  `[x, z, vx, vz]` in centimetres as int16, facing (one byte), wobble (one byte), state flags
  (dash, brace, falling, out, bubble…), the last input `seq` the server applied for that
  player. Pickups and hazard phases ride along. About 20 bytes per ring.
- **Prediction:** your client runs the sim for your own ring at 60 fps with your inputs.
  On each snapshot it resets your ring to the server's state at the acknowledged `seq` and
  replays the inputs since. Small errors are smoothed over 100 ms, not snapped.
- **Big events** (KO, round end, pickup grabbed) also go as their own reliable messages, so
  the HUD never misses one.
- **The DO stays awake during a round** (a 30 Hz `setInterval`); between matches it goes
  back to hibernating as usual. RoomCore's alarm still handles countdown, results and idle
  clean-up.

### Rooms

- `BumperRoom extends RoomCore` in `apps/realtime/src/bumperRoom.ts`, new binding
  `BUMPER_ROOM` and migration tag `v3` in `wrangler.jsonc`, routing in `index.ts`.
- 2–4 players (`maxPlayers` is 4), free-for-all only: every ring for itself. No joining while a match is on (RoomCore's `playing()`); a player who drops
  mid-round has their ring keep coasting (no input) until reconnect or grace runs out, so
  they can still be bumped out.
- RoomCore's `MAX_MESSAGES_PER_SECOND` (20) becomes a per-game setting; Bumper needs ~25.
- Results POSTed to the API with the signed header, like Prop Hunt: placements, KOs, round
  wins, titles → XP, coins and unlocks.

### Bots

- One bot brain in `packages/shared/src/bumperBots.ts`, used by solo modes (client) and,
  later, to fill room seats (server).
- Simple and readable behaviour: pick a target (nearest, or the one nearest the edge), get
  "behind" them relative to the arena centre, dash when lined up within range, brace when
  near the edge and something is coming, grab pickups that are close, back off from hazards.
- **Levels:** Easy (slow reactions 600 ms, wobbly aim, rarely braces), Normal (300 ms),
  Hard (150 ms, edge-aware, uses pickups well). Gauntlet waves mix levels.

---

## 7. Code layout

### Shared (`packages/shared/src/`)

| File | What |
|---|---|
| `bumper.ts` | Constants (speeds, dash, brace, wobble, scoring, timings, limits), ring skins, modifiers, `rankBumper`, daily gauntlet seeding |
| `bumperMaps.ts` | The 8 maps as data |
| `bumperSim.ts` | The physics step, state types, snapshot pack/unpack |
| `bumperBots.ts` | Bot brains |
| `bumperRoom.ts` | Zod protocol: client and server messages, the room view, results body |

### Room server (`apps/realtime/src/`)

`bumperRoom.ts` (lobby settings, rounds, the 30 Hz loop, snapshots, scoring, results POST),
plus `index.ts` routing and `wrangler.jsonc`.

### API (`apps/api/`)

- `POST /bumper/results` (signed by the room): XP, coins, unlocks, match stats.
- `POST /bumper/gauntlet` and `GET /bumper/gauntlet/today`: daily run + leaderboard, same
  trust model as Sky Climb runs (sanity bounds on waves and time).
- Profile stats: matches, wins, KOs, best gauntlet.

### Web (`apps/web/src/games/bumper-arena/`)

```
BumperArenaHome.tsx    landing page: what it is, daily gauntlet card, create/join room
BumperArenaPage.tsx    the game: picks mode (room / gauntlet / practice)
HubCard.tsx            Cover + Status ("Gauntlet #12: Ice Floe, Slippery")
config.ts              client-only tuning (camera, interpolation delay)
input.ts               keyboard + touch stick + buttons (reuses Sky Climb's stick)
net.ts / room.ts       room client: inputs out, snapshots in, prediction + reconcile
store.ts               zustand: mode, phase, HUD state, settings
progress.ts            XP / unlocks display
scene/                 Arena (per map), Rider (avatar + ring), Pickups, Hazards, Effects, Camera
ui/                    Lobby, HUD, Wobble arc, kill feed, round results, podium, emote wheel,
                       gauntlet results + share
art/                   ring GLB loader, skin colours
```

Registry entry in `games/registry.ts`, plus `game_started` / `game_finished` PostHog events
with `game: "bumper-arena"` and mode.

### Assets (all CC0)

- Kenney **Mini Characters** (riders, already in use), **Platformer Kit** (arena pieces,
  pickups), **Nature Kit** (far-below scenery), **Food Kit** (cake, donut, banana), **Space
  Kit** (Moon Base).
- Hand-made low-poly GLBs: the bumper ring (and its skins), the spinner bar, hex tile.
- Short sounds from Kenney's audio packs (Impact Sounds, Interface Sounds), CC0.
- Listed in `assets/LICENSES.md`. Download budget for the game: under ~6 MB.

---

## 8. Rollout phases

1. **Feel prototype ✅** (05ee7ae). The whole risk of this game is whether bumping feels
   good, so this came first, offline. The Tuning panel (T, dev builds only) still edits
   `BUMPER_TUNING` live and copies the values out.
   - `bumperSim.ts` + Picnic Plate in greybox, avatar in a placeholder ring, keyboard and
     touch, Easy bots.
   - Tune speed, momentum, dash, brace, knockback and Wobble until a 1v3 against bots is fun
     for 10 minutes. Try it on a tablet.
2. **Solo game ✅ built.**
   - `/games/bumper-arena/play`: a menu over a bots-only round, Practice (any arena, 1–7
     bots, easy/normal/hard) and the **Daily Gauntlet** (`bumperGauntlet.ts`: date → arena +
     twist, waves, score; share text; guest runs claimed on sign-in).
   - API `apps/api/src/modules/bumper-arena` (table `bumper_runs`, migration 0011): start,
     finish, today, leaderboard (`/leaderboard?game=bumper-arena`), claim.
   - The four launch maps (Picnic Plate, Ice Floe, Spinner, Hex Hive), with bots that dodge
     the bar and step off cracking tiles. Landing page, hub tile (05), nav entry.
   - Still to do here ⬜: a modelled ring GLB and skins (today's ring is built from simple
     shapes), map-specific sounds, a profile section.
3. **Party rooms ✅ built** (2–4 players). The room steps the sim 60 times a second and sends
   snapshots 15 a second; the client predicts its own ring and replays unacknowledged inputs.
   - `bumperRoom.ts` protocol, `BumperRoom` DO with the 30 Hz loop, prediction and
     interpolation on the client.
   - Lobby (map / rounds / pickups), rounds, sudden death, scores, podium, rematch.
   - Test with real latency (one player on mobile data far away) before tuning anything else.
4. **Progression and polish ⏳ next.** Planned in detail in §12: results → XP and coins,
   pickups, emotes, podium titles and share text, profile stats, then ring skins and the
   Crash Helmet.
5. **Later ⬜.**
   - The other four maps (Birthday Cake, Conveyor Factory, Seesaw, Moon Base).
   - Bots filling empty room seats.
   - Public quick-match.

---

## 9. Risks and notes

- **Latency.** A Durable Object lives near whoever created the room. Players far away get
  ~150–250 ms. Prediction hides it for your own driving, but collisions with others will
  sometimes correct a little after the fact. Mitigations: interpolation delay ~100 ms,
  smooth corrections, slightly generous hit radius for dashes. Test this early (phase 3).
- **Cost on the Workers Free plan.** Incoming WebSocket messages to a DO count as requests
  (20 messages = 1 request) and an awake DO uses duration (GB-s). 4 players sending at 30 Hz
  would be ~6 requests/s per room: only a couple of hours of play a day on the free 100k.
  Hence inputs at 15 Hz, **only on change**, which in practice cuts it by 3–5×. Outgoing
  snapshots aren't billed as requests. Watch the dashboard after launch; the Workers Paid
  plan ($5/mo) removes the worry.
- **Float determinism.** Prediction doesn't need bit-exact sims (the server corrects), and
  the gauntlet is trusted with bounds, so ordinary JS floats are fine.
- **Tablet performance.** 8 skinned avatars + effects. Keep the avatar's skinned mesh simple
  (already low-poly), share materials, instance tiles, cap DPR at 2.
- **Griefing / camping.** Sudden death and the Wobble drain stop anyone hiding at the edge
  forever; teaming up is fine (it's part of the fun).
- **Clarity.** With up to 8 rings in Practice, the player must always find themselves: the outline,
  the arrow, and their name in bold.

---

## 10. Decisions (2026-10-23)

1. **Name:** Bumper Arena.
2. **Order:** solo first (Practice + Daily Gauntlet), then party rooms, as in §8.
3. **Free-for-all match:** 5 rounds by default, most points wins.
4. **Ring skins:** each one can be earned through its challenge **or** bought with coins.
5. **Party rooms are 2–4 players, free-for-all only** (changed from 2–8 on 2026-10-23).
   There is no Teams mode: no 2v2 or 3v3.

---

## 11. How to test (when implemented)

- **Sim:** a script that runs `bumperSim` headless with scripted inputs: two rings head-on,
  a dash into a braced ring, a ring pushed off the edge, KO credit within 3 s.
- **Solo:** play the Gauntlet on desktop and on a tablet; check share text and that a second
  scored run the same day is refused.
- **Rooms:** `wrangler dev` (realtime) + `pnpm dev`, open 3–4 browser windows, throttle one
  to "Slow 4G" in DevTools; check the lobby, rounds, sudden death, disconnect and rejoin
  mid-round, podium and rematch.
- `pnpm typecheck` before every push.

---

## 12. Phase 4 plan: progression and polish

Phase 3 made party rooms playable; phase 4 makes them worth coming back to. Seven steps,
each one shippable on its own, in this order: rewards first (everything else builds on
them), then the things that change how a round plays, then the things you collect.

Status: ⬜ planned for every step.

### 4.1 Results → XP and coins ⬜

The room reports a finished match to the API, the way Prop Hunt does, so signed-in players
level up and earn coins. Nobody can award themselves anything: only the room can report.

- **Room → API:** at the podium, `BumperRoom` POSTs `{ matchId, players: [{ userId, place,
  score, roundWins, kos, dnf, stats }] }` to `POST /api/bumper/results`, signed with the
  results secret the Worker and API already share for Prop Hunt (same retries: 0, 10 s,
  30 s). Guests are left out.
- **API:** module `bumper-arena` gets `bumper_progress` (user id, xp, matches, wins, rounds
  won, KOs, coins earned, best surviving wobble, owned and equipped skin) and
  `bumper_results` (match id + user id, the XP and coins given: a retried report counts
  once). Migration 0012.
- **XP:** the same level curve as Prop Hunt (`xpForLevel`): a match gives its points + 50
  for finishing + 100 / 50 / 25 for the podium. Leaving early gives nothing.
- **Coins:** 10 a round won + 3 a KO + 5 for finishing (about 20–60 a match). They join the
  hub balance that buys avatar items: the balance becomes Sky Climb coins + Bumper coins −
  spent. The Daily Gauntlet gives no coins: its runs are reported by the browser, so they
  could be farmed.
- **Back to the players:** the room sends each signed-in player an `xp` message (level,
  XP gained, coins gained), shown on the podium with a level bar. Guests see "Sign in to
  earn XP and coins".

### 4.2 Pickups ⬜

The pickups from §2, in party rooms and the Gauntlet.

- **Sim (`bumperSim.ts`):** a pickup list; one spawns every 12 s at a random safe spot (on
  firm floor, away from rings and the spinner bar), at most 2 at a time, pulsing for 1 s
  before it can be taken. Seeded RNG, so the Gauntlet stays the same for everyone.
- **The five:** Heavyweight (1.4× ring, 2.5× mass, slower, 6 s), Turbo (0.6 s dash cooldown,
  5 s), Shockwave (next dash blasts everyone within 3 m), Bubble (absorbs the next hit, up
  to 8 s), Banana (a slick patch behind you for 10 s; 1.5 s of no grip on it).
- **Each ring carries its effect and time left**, so snapshots and prediction include it
  (a heavier, bigger or quicker-dashing ring must predict the same way as the room).
- **Room:** pickups and banana patches ride in the snapshot; a "pickup" event for the
  sound and the HUD. Lobby toggle **Pickups on / off** (on by default). Protocol bump.
- **Gauntlet:** the **Pickup Party** twist comes back; Normal and Hard bots go for pickups
  that are close.
- **Art:** Kenney Platformer Kit / Food Kit items (CC0) in a floating, spinning capsule;
  a small HUD chip with the effect's time left.

### 4.3 Emotes ⬜

- Wave, Laugh, Taunt, Cry on keys **1–4** (an emote button with a small wheel on tablets),
  1.5 s cooldown. Out players can emote too.
- Client sends `{ type: "emote", id }`; the room checks the cooldown and relays it to
  everyone. In solo modes it plays locally only.
- The rider plays a Mini Characters clip over the driving pose, with an icon bubble over
  the name tag for 1.5 s. Check which of the 32 clips read best from the high camera.

### 4.4 Podium titles and share text ⬜

- The room keeps a few stats per player over the match: KOs, total Wobble taken, self-outs
  (fell with nobody touching them in the last 3 s), highest Wobble reached and survived the
  round, and rounds won in the last 5 s of sudden death.
- Titles at the podium (one each at most, the rarest first): **Bully**, **Unbudgeable**,
  **Gravity's Friend**, **Pinball**, **Last Second**. Shown under the podium avatars and in
  the standings list.
- **Share** button on the podium:

  ```
  Bumper Arena · party of 4 · 5 rounds
  🥇 23 pts · 3 rounds won · 5 KOs · Bully
  gamehub…/games/bumper-arena
  ```

### 4.5 Profile stats ⬜

- A Bumper Arena section on `/profile`: level and XP bar, matches, wins, rounds won, KOs,
  best Gauntlet (waves and score), and the equipped skin (once 4.6 is in).
- `GET /api/bumper/progress` returns it; the web app also uses it for the level badge in
  the lobby (the room is told your level, like Prop Hunt's loadout message).

### 4.6 Ring skins ⬜ (postponed once; confirm before starting)

- **The base car first:** the modelled car that phase 2 left open (today's is built from
  simple shapes), with a body that takes a colour, so skins are variations of it.
- **Catalog (`bumperSkins.ts`)**, each earned **or** bought (§10, decision 4):

  | Skin | Earn it | Or buy |
  |---|---|---|
  | Classic | Free | - |
  | Rubber Duck | 10 rounds won | 400 |
  | Donut | Gauntlet: clear wave 10 | 600 |
  | Tractor Tyre | 50 KOs | 800 |
  | Lifebuoy | Survive a round at 120%+ Wobble | 600 |
  | Saucer | Reach deep space in Sky Climb | 1,000 |
  | Golden Ring | Win 25 matches | 2,500 |

  (Prices are a starting point, to tune against what a match pays.)
- **API:** progress lists owned skins; `POST /api/bumper/skins/:id/buy` (coins) and
  `POST /api/bumper/skin` (equip). Earned skins unlock from `bumper_progress`, the
  Gauntlet's best run, and Sky Climb's best floor.
- **Room:** a `loadout` message (skin, level) like Prop Hunt's; the room only checks the
  skin id exists (it's cosmetic). Practice and the Gauntlet use your equipped skin too.
- **Picker:** on the menu and in the lobby, locked skins showing how to earn them.

### 4.7 Crash Helmet ⬜

- A new hat in the avatar catalog (`hat:crash-helmet`, drawn in `avatar/build.ts` like the
  other hats), worn in every game. Earned by winning **10 party matches**: a new rule kind
  next to the Sky Climb achievements and Shadow Guess stats that unlock items today.

### How to check each step

- 4.1: a local match with a signed-in player: XP and coins on the podium, the balance on
  the avatar page goes up, and a repeated report doesn't count twice.
- 4.2–4.4: two browser windows on a local room, as in phase 3.
- 4.5–4.7: the profile page and the avatar page after a match.
- `pnpm typecheck` before every push; migration 0012 applied with `pnpm --filter api
  db:migrate`, and the room server deployed whenever the protocol changes.
