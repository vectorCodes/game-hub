# GameHub · Sky Climb + Avatars plan

Goal: GameHub's second game, and the first one where the player *is* someone. Every player
designs one character (outfit, hat, colours, hair, goggles…) that climbs in Sky Climb and
represents them across the hub. Sky Climb itself is a daily 3D tower: easy at the bottom,
harder the higher you go.

Status: ✅ done · ⏳ next · ⬜ planned

## Assets (all CC0, no attribution required; credited in `assets/LICENSES.md`)

| Kit | What we use |
|---|---|
| Kenney **Mini Characters** | 12 rigged characters, each a `body-mesh` + `head-mesh` on one shared skeleton. 32 animations: idle, walk, sprint, jump, fall, crouch, die, emote-yes/no, sit, interact… Glasses and sunglasses. |
| Kenney **Platformer Kit** | Tower pieces: grass/snow blocks, platforms, moving blocks, ladders, springs, conveyor belts, spikes, saws, spike blocks, coins, stars, flags, chests. |
| Our own (small GLBs) | Hats and goggles the kits lack: cap, beanie, crown, party hat, top hat, cowboy hat, propeller cap, ski goggles. Low-poly, same palette style. |

Because every Mini Character shares one skeleton, any head fits any body. That gives us
"hair/face" and "outfit" as two independent choices for free (12 × 12 combinations), before
colours and accessories.

---

## Phase 0: Avatar system ✅

Built after Phases 1–2. How it works:
- `apps/web/src/avatar/build.ts` puts any character's head on any character's body (the
  12 Mini Characters share bone names; a borrowed head is rebound with its own rest pose).
- Recolouring moves UVs between the palette's 32×128 px swatches, keeping the shading.
  Skin, hair and clothes are found from the mesh: the face is the 0.32-unit cube, hair is
  the biggest other piece's swatch (eyebrows and beards too), clothes split by height into
  top, bottoms and shoes. Eyes, glasses and headbands keep their colours.
- Hats (cap, beanie, party, cowboy, top hat, propeller, crown, wizard) and goggles are small
  low-poly models on the head bone; glasses and sunglasses come from the kit.
- `/avatar` editor: hair style + colour, skin, outfit style + top/bottom/shoe colours, hat,
  eyewear; try locked items on, unlock with coins from there; randomize; save.
- Items live in the shared catalog (`packages/shared/src/skyClimb.ts`): owning a style
  unlocks its hair and its outfit. Unlocks cross games: Snowline → ski goggles, Storm chaser
  → propeller cap (Sky Climb); 7-day Shadow Guess streak → crown, 25 solves → wizard hat.
- Shown in Sky Climb (the climber), the header menu, the profile and leaderboard rows
  (portraits drawn once per look by a small offscreen renderer). Table `avatars`; guests keep
  theirs in the browser and it moves into the account on first sign-in.

Original plan:

Built before Sky Climb, because the climber *is* the avatar.

### What the player can change

| Slot | Options at launch | How |
|---|---|---|
| Hair & face | 12 (heads from the kit) | Swap `head-mesh` |
| Outfit | 12 (bodies from the kit) | Swap `body-mesh` |
| Skin tone | 8 | Recolour palette cells in the colormap |
| Hair colour | 10 | Recolour palette cells |
| Outfit colours | 12 primary × 12 secondary | Recolour palette cells |
| Hat | none + 8 | GLB attached to the head bone |
| Eyewear | none + glasses, sunglasses, ski goggles | GLB attached to the head bone |
| Emote | yes, no, wave (later: dance) | Played in the customizer and on wins |

Later slots: back item (backpack, cape, jetpack), trail effect, victory pose.

### Customizer page (`/avatar`)
- The character stands on a lit turntable (same look as the hub hero), drag to rotate, and
  plays idle, with an emote whenever something changes.
- Tabs per slot; a swatch grid for colours; **Randomize** button; **Save**.
- Mobile first: preview on top, options in a bottom sheet.

### Unlocks (the cross-game hook)
- Most items free from the start, so everyone can look unique on day one.
- Some are earned, in *any* game:
  - Shadow Guess 7-day streak → 👑 Crown
  - Shadow Guess: complete an album category → category hat (e.g. chef hat for Kitchen)
  - Sky Climb: reach floor 50 → ski goggles; reach the summit zone → propeller cap
  - Sky Climb: 7-day climb streak → golden outfit colour
- Locked items show with a lock and how to earn them, which advertises the other game.

### Where the avatar appears
- Sky Climb (the climber), the customizer, the header account menu, the profile page, and
  leaderboard rows (a rendered head icon, cached per avatar version).
- Guests get a random avatar, saved in the browser; it moves into the account on sign-in
  (same claiming idea as guest sessions).

### Data
- `avatars` table: `user_id` (PK), `config jsonb` (slot → item id, colour ids), `version int`,
  `updated_at`.
- `unlocks` table: `user_id`, `item_id`, `unlocked_at`, `source` (e.g. `shadow-guess:streak-7`).
- Item catalog in `assets/avatar-items.json` (id, slot, name, model, unlock rule), validated
  on startup like `themes.json`.
- API: `GET /api/avatar` (mine or a default), `PUT /api/avatar` (validated: every item must
  exist and be unlocked), `GET /api/avatar/items` (catalog + my unlocks).

### Tech notes
- Recolouring: the kit uses one palette texture (`colormap`). Each avatar gets its own small
  canvas texture: copy the palette, repaint the cells for skin/hair/outfit. Needs a spike to map which
  cells each character uses for skin, hair, and outfit (risk below).
- Swapping parts: load one character GLB for the skeleton + animations; load other heads and
  bodies as skinned meshes bound to that skeleton.
- Shared code lives in `apps/web/src/avatar/` (`<Avatar config animation />` component), so
  any future game can drop in the player's character.

---

## Phase 1: Sky Climb MVP ✅

Built first, ahead of Phase 0. Until avatars exist, players pick one of the 12 Mini Characters
on the start screen (remembered per browser). Differences from the plan below:
- No Rapier: a small custom platformer engine (`sim.ts`) with one-way platforms. No WASM to
  load, and coyote time, jump buffering and moving-platform carry are easy to tune.
- The camera sits outside the spiral looking in, so left/right runs round the tower
  (2.5D-style controls) instead of a free orbit camera.
- Guest climbs move into the account on sign-in (`POST /api/sky-climb/claim`), and Sky Climb
  has its own `user_stats` row: finished climbs, summits, and a streak of days on which the
  daily tower was climbed.

### How it plays
- Third-person 3D platformer. Climb a floating tower of platforms as high as you can.
- **Controls:** WASD/arrows + Space on desktop; on phones a virtual joystick (left thumb) and
  a jump button (right thumb). Camera follows behind and above, drag to orbit.
- **Falling:** drop below your last checkpoint's level and you respawn there (the die
  animation plays, then a quick fade). Falls are counted.
- **A run** ends when you quit or reach the top of the daily tower. Score: highest floor
  reached, then time as the tie-breaker.

### Difficulty: easy at the bottom, hard at the top
The tower is a stack of zones. Each zone changes the look *and* the rules, and every number
below ramps smoothly with height, not just at zone borders.

| Floors | Zone | Look | What's new |
|---|---|---|---|
| 1–10 | 🌱 Meadow | Grass blocks, flowers, morning sun | Wide platforms, short gaps, stairs. No hazards. Coins show the path. |
| 11–25 | 🌳 Treetops | Wood, hedges, ladders | Smaller platforms, longer jumps, first slow moving platforms, springs. |
| 26–45 | 🪨 Cliffs | Stone, fences, afternoon light | Narrow beams, faster movers, spike traps on a timer, conveyor belts. |
| 46–70 | ❄️ Snow Peak | Snow blocks, pines, sunset | Slippery ice, crumbling platforms, wind gusts that push you. |
| 71–99 | ⛈️ Storm | Dark clouds, rain, night | Spinning saws, spike blocks, vanishing platforms, short time windows. |
| 100 | 🏁 Summit | Flag, chest, stars | Final jump; summit celebration. |
| 100+ | ♾️ Endless (later) | Space sky | Random mix, still getting harder. |

Ramping parameters (each a function of floor): gap distance, platform size, mover speed,
hazard density, how many paths branch, and checkpoint spacing (every 5 floors early, every
10 later). One knob table in shared code makes balancing a single-file job.

### Daily tower
- Every day gets one generated tower from a **seed = the date**, so everyone climbs the same
  tower and leaderboards are fair. Same idea as the Shadow Guess daily puzzle.
- **Practice mode:** random seed, no leaderboard, unlimited tries.
- The generator builds from hand-made "chunks" (a few floors each: a stair run, a moving
  platform crossing, a saw corridor…) tagged with a difficulty, picked by the seed to fit the
  current floor's difficulty. Hand-made chunks keep it fun; the seed keeps it fresh.
- One chunk per biome is tested to always be climbable (a test walks each chunk's required
  jumps against the controller's max jump).

### Graphics & animation (the "feel" checklist)
- **Character:** crossfaded animations (idle ↔ walk ↔ sprint ↔ jump ↔ fall), a short squash on
  landing, dust puffs on land and jump, a small lean into turns, emote-yes at each checkpoint,
  sit on the summit.
- **World:** the sky changes with height (dawn → day → sunset → night with stars), clouds you
  climb *through* and later look down on, soft shadows, light fog for depth, bloom on coins
  and stars. Each zone has its own particles: leaves, snow, rain.
- **Feedback:** coin sparkle + sound, a checkpoint flag that unfurls, a floor counter that
  ticks up, light camera shake on hard landings, a "new best!" banner.
- **Performance:** same quality tiers as the landing page (weak phones: no bloom, smaller
  shadow maps, fewer particles); only the floors near the player are kept in the scene.

### Tech
- `@react-three/rapier` for physics; a kinematic character controller (coyote time + jump
  buffering so jumps feel fair).
- Game state in a zustand store, like Shadow Guess.
- Lives at `/games/sky-climb` (landing page) and `/games/sky-climb/play`, registered in
  `apps/web/src/games/registry.ts`: the hub tile appears automatically.

### Data & API
- `climb_runs`: `id`, `user_id`, `mode` (daily / practice), `seed`, `puzzle_date`,
  `best_floor`, `time_ms`, `falls`, `coins`, `status`, `started_at`, `ended_at`.
- `user_stats` (already keyed by game type) holds played / streak for `sky-climb`.
- Endpoints: `POST /api/sky-climb/runs` (start; returns the seed), `POST …/runs/:id/progress`
  (checkpoints as they're reached), `POST …/runs/:id/finish`.
- **Cheating:** the server can't watch the client play. MVP: it accepts checkpoints only in
  order and no faster than the fastest possible climb. Later: send a compact input log and
  replay it server-side for top leaderboard entries.

---

## Phase 2: Progression & polish ✅

Built as below, with these choices:
- **Locker** (menu and results): 12 climbers (4 free, the rest 30–150 coins) and trails
  (Sparkle, Ember, Rainbow, plus Summit gold earned by the Summit achievement). Items and
  prices live in `packages/shared/src/skyClimb.ts`; tables `climb_unlocks`, `climb_loadouts`.
- **Coins:** a climb's coins add to the wallet; spending needs an account (guests see their
  coins and keep free items in the browser). Balance = coins from all climbs − spent.
- **Achievements:** 12, computed from the player's climbs rather than stored, so claimed guest
  climbs count too. Shown in the locker, on the results screen as they unlock, and on the
  profile page. Guests get them from stats kept in the browser.
- **Sound:** wind that grows with height and howls in gusts, a chord pad per zone that
  crossfades as you climb, footsteps by surface (grass, wood, snow, metal). All synthesized.
- **Leaderboards:** `/leaderboard` has a game switcher (`?game=sky-climb`). Sky Climb ranks the
  day's best floor, or floors summed over each day's best climb for the week and all time.

Original plan:
- Coins collected while climbing buy cosmetic items (no pay-to-win: cosmetics only).
- Achievements: "No falls to floor 25", "Summit in under 5 minutes", "7-day climber".
- Sound: footsteps per surface, wind louder with height, a zone music layer.
- Leaderboards: add a game switcher (Shadow Guess / Sky Climb) to `/leaderboard`; Sky Climb
  ranks by floor, then time.

## Phase 3: Playing together ✅

Built as below, with these choices:
- **Ghosts:** recorded 10×/s on the game's own play clock (`ghosts.ts`), packed by
  `encodeGhost` in shared code (centimetre deltas as varints + facing + pose, ~6 bytes a
  frame) and sent with the finish; table `climb_ghosts`. There is no friends list yet, so
  each climb races your own best plus the top 3 other players' best climbs of that tower
  (`GET /api/sky-climb/ghosts?seed=`). Guests keep their best ghost of today's tower in the
  browser. Ghosts are translucent, tinted and labelled, fade when on top of you, and show
  as dots on the HUD's height bar. A "Climb with: Ghosts / Live climbers" toggle in the menu.
- **Challenge link:** after a climb, "Challenge a friend" shares
  `/games/sky-climb/play?challenge=<runId>` (`GET /api/sky-climb/challenge/:id`). Starting a
  run with `challenge` climbs the challenger's tower: as today's daily while it still is
  (counts for the leaderboard), otherwise as practice. The results say who won.
- **Live climbs:** Supabase Realtime (`live.ts`): presence for who's there (name, avatar),
  broadcasts of positions 4×/s, drawn 400 ms late and blended; up to 8 nearest shown. Today's
  tower only, while climbing; nothing is stored.

Original plan:
- **Ghosts:** your best run and your friends' runs replay as translucent climbers wearing
  *their* avatars. Positions recorded about 10 times a second, compressed.
- **Challenge link:** "Beat my climb" opens the same seed with the sender's ghost.
- **Live climbs (stretch):** see other players climbing today's tower in real time
  (Supabase Realtime), each wearing their own avatar.

---

## How players connect across GameHub
1. **One account, one avatar.** Sign in once; your character and stats follow you everywhere.
2. **Unlocks cross games.** Earn the crown in Shadow Guess, wear it while climbing, and the
   reverse. Locked items say where to earn them.
3. **The hub shows it.** Hub tiles show today's status for both games; after finishing one
   daily, the result screen suggests the other ("Today's tower is ready 🧗").
4. **Friends.** Ghost races and challenge links bring players into Sky Climb through people
   they know.

## Suggested order
1. Spike: recolouring + head/body swap on one character, attached hat → proves the avatar idea.
2. Avatar system + customizer + saving (Phase 0).
3. Character controller and one hand-made test level that *feels* good before any generation.
4. Chunk library + seeded daily tower + zones 1–3 (Meadow, Treetops, Cliffs).
5. Runs API, leaderboard, hub tile and landing page → **ship Sky Climb MVP**.
6. Zones 4–5 (Snow, Storm) + summit, then Phase 2 and 3. ✅

## Risks and open questions
- **Palette recolouring:** depends on how the Mini Characters colormap is laid out. If the
  cells are shared in awkward ways, fall back to fixed colour variants per character.
- **Mobile controls:** 3D platforming on a touchscreen is hard; plan playtests early.
  Possible assist: auto-run forward with tap-to-jump as an "easy controls" option.
- **Tower length:** is 100 floors the right daily length? Target a 5–10 minute summit for a
  good player.
- **Physics bundle size:** Rapier is WebAssembly (~1–2 MB); it must load only on the Sky
  Climb play page, never on the hub.
