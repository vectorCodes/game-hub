# GameHub · Prop Hunt plan

Hide and seek, toy-sized, in a big, real-looking house. Players are tiny (their GameHub
avatars are about 20 cm tall), so an ordinary family home becomes a huge world: under the
sofa, on top of the bookshelf, in the kitchen sink, in the long grass of the garden.
**Hiders** turn into anything around them (a mug, a toaster, a shoe, a potted plant) and try
to blend in. **Seekers** hunt them down by zapping anything that looks out of place. Found
hiders join the hunt, so nobody sits out a round. Rooms of 2–8 friends, 4-minute rounds, an
instant rematch.

Status: ✅ done · ⏳ next · ⬜ planned

---

## 1. Why this game, and why it fits the hub

- **Every round makes a story.** You might be the mug next to five other mugs, or the sofa
  that slowly creeps across the room, or the seeker who zapped every chair except the right
  one. That's what makes players ask for another round.
- **It isn't a shadow game, a race or a memory game.** It's social, and it's in 3D.
- **Most of it already exists:**
  - **Avatars** (`apps/web/src/avatar/`): everyone plays as their own GameHub character until
    they disguise.
  - **Rooms** (`apps/realtime`): codes, links, lobby, host handover, reconnect grace,
    countdown, clock sync, hibernation and rate limits all work today for Sky Climb.
  - **Movement and remote players**: the input (`input.ts`, keyboard and touch stick), the
    position packing and buffering (`live.ts`, `ghosts.ts`), and the `Rider` component.
    Sky Climb's platformer feel (jump, land, one-way platforms) suits climbing furniture.
- **The one thing that's new is the look.** The house and its props are realistic (see §3),
  not Kenney's flat cartoon style. The cartoon avatars then read as living toys in a real
  home, which is the premise of the game.

---

## 2. The game

### Roles

| Players | Seekers at the start |
|---|---|
| 2–4 | 1 |
| 5–8 | 2 |

- The seeker role rotates each round, so everyone gets to seek.
- **Found hiders are out** until the next round: they watch the others (Space for the next player).

### A round

```
hide (40 s) ──▶ seek (240 s) ──▶ round results (8 s) ──▶ next round … ──▶ final podium
```

1. **Hide (40 s).** That's enough time to reach the far side of the house or go upstairs.
   - Hiders spawn in the house as their avatar. Seekers are shut in the garage with a dark
     screen and a countdown.
   - A hider looks at any prop marked as disguisable and presses **E** (or taps **Become**).
     They turn into that prop at its size.
   - A hider who isn't disguised when seeking starts is revealed to everyone for 5 s. Disguise
     early.
2. **Seek (240 s).**
   - The garage door opens.
   - Seekers can **sprint** (1.6× speed for 3 s, recharging), because the house is big.
   - Seekers aim with a crosshair and **zap** (click or tap). A zap hits whatever is under
     the crosshair within 6 units (about 7 avatar heights).
     - **Hit a hider:** the hider pops out of the prop with a squeak and confetti, and is
       out for the round (watching). The seeker scores and heals +25 HP.
     - **Hit a real prop:** the prop wobbles, and the seeker loses 10 HP. At 0 HP the seeker
       is dizzy for 5 s (the screen spins and they can't zap), then comes back at 50 HP.
       This keeps seekers from zapping everything in sight, without knocking anyone out.
3. **Round end.** The seekers win the round if every hider is found. The hiders still hidden
   win if time runs out.
4. **Match.** One round per player (each player seeks once), up to 6 rounds. The highest
   total score wins, and the results show a podium of avatars.

### Hider controls

| Action | Desktop | Phone |
|---|---|---|
| Move | WASD / arrows | Left stick |
| Look (orbit camera) | Mouse (pointer lock) | Drag on the right half |
| Become the prop in view | E | **Become** button |
| Lock rotation (stay perfectly still while looking around) | Q | **Lock** button |
| Taunt | F | **Taunt** button |
| Hop | Space | **Hop** button |

- **Hopping props are the joke of the game.** A toaster bouncing down the hall should be
  funny, and it's also a way to get caught.
- **Taunts** play a silly sound from where the hider is: +5 points each, at most one every
  10 s.
- **Forced taunt.** In the final 60 s, every hider taunts automatically every 20 s. This is
  the most important anti-camping rule: it gives the end of every round a frantic finish.

### Seeker controls

| Action | Desktop | Phone |
|---|---|---|
| Move / look | WASD + mouse | Stick + drag |
| Zap | Click | **Zap** button (aim with the centre crosshair) |
| Jump | Space | **Jump** button |
| Sonar (once per round, from 60 s left) | R | **Sonar** button |

**Sonar** sends a ring outward from the seeker and shows which direction the nearest hider
is in (not its distance) for 3 s. It helps seekers who are stuck.

### Scoring

| Event | Points |
|---|---|
| Seeker finds a hider | +100 (+50 if found in the first 30 s of seeking) |
| Hider survives a 30 s stretch | +20 |
| Hider survives the whole round | +150 |
| Taunt (manual) | +5 |
| The last hider found | +50 to that hider ("last one standing") |

### The map: "The Big House" (v1)

**Scale.** The avatar is 0.9 game units tall and stands for about 20 cm, so 1 unit ≈ 22 cm.
A real 12 × 9 m two-storey house with a 12 × 8 m garden becomes a world of roughly
55 × 80 units per floor. At Sky Climb's run speed (5.2 units/s), crossing the ground floor
takes about 10 s, and the whole property about 20 s. It's big enough that the hiders can
spread out, and small enough that the seekers can cover it in 4 minutes.

**Areas and their hiding spots.** Every area has hiding spots on three levels: the floor,
under things, and on top of things.

| Area | What's there | Good hiding spots |
|---|---|---|
| Hallway + stairs | shoe rack, coats, umbrella stand, rug, stairs to the first floor | as a shoe in a row of shoes; behind the umbrella stand |
| Living room | sofa, armchair, coffee table, TV unit, bookshelf, floor lamp, plants, rug, toys on the floor | under the sofa; on the bookshelf (climb the armchair → the shelf); among the toys |
| Kitchen + dining | counters, fridge, sink, table and chairs, open shelves of mugs, bowls and jars, fruit bowl | in the sink; among the mugs on the shelf; on top of the fridge (a long jump from the counter) |
| Bathroom | bath, toilet, sink, cabinet, towels, bottles | among the bottles on the bath's edge; behind the toilet |
| Kids' bedroom (first floor) | bed, toy box, desk, books, a toy train track | under the bed; in a pile of toys |
| Main bedroom (first floor) | bed, wardrobe (doors open), nightstands, lamps | inside the open wardrobe; among the slippers |
| Garage (seekers' start) | car, tool bench, paint cans, boxes, a bicycle | on the tool bench; among the paint cans |
| Garden | long grass, flower beds, a shed, a wheelbarrow, a watering can, garden toys, stones | in the long grass (only a hider who stands still is truly hidden); among the stones |

**How the map is laid out:**
- **Climbing routes.** Furniture is placed so it forms paths up: chair → table → shelf,
  bed → windowsill. Small props reward exploring high places, and seekers have to look up.
- **Doorways and gaps.** Doors are open, and there are gaps under the sofa, the bed and the
  wardrobe that only small props fit through. Small disguises can escape that way.
- **Lots of repeats.** About 400 placed props, of which about 120 are disguisable. Each prop
  type appears in clusters of 3–8 (mugs, shoes, books, jars, stones, toy blocks), so a hider
  always has a crowd to blend into.
- **Disguise sizes.** A disguise is between 0.3 and 2.5 units across (from a dice to a
  shoe). Furniture is terrain and can't be a disguise.
- **Spawns.** Hiders spawn spread out across 6 spots on both floors. Seekers start in the
  garage, which has an exit to the hallway and another to the garden, so they have to choose
  which way to go first.

Later maps: **Grandma's Attic** (dusty, a single warm light), **Supermarket** (endless
shelves of identical products), **Camping site** (forest, tent, a campfire at night).

### Graphics: natural and smooth

The goal is to look like a real home photographed at toy height, while running at a steady
60 fps on a recent laptop and at least 30 fps on a mid-range phone.

**Assets (all CC0):**
- **Models:** Poly Haven (realistic furniture, kitchenware, decor, plants and garden items,
  with PBR textures), plus a few made in Blender to fill gaps such as shoes or toy blocks.
- **Materials:** wood, tile, fabric, carpet, plaster and grass from Poly Haven and
  ambientCG, as PBR textures (colour, normal, roughness and AO maps).
- **Lighting:** an HDRI from Poly Haven for reflections and ambient light, matched to the
  sun and the window light.
- **Credits:** all of them are listed in `assets/LICENSES.md`.

**Rendering (three.js / react-three-fiber):**

| Technique | What it gives | Notes |
|---|---|---|
| **Baked lightmaps** for the house shell and static furniture | Soft shadows, light bouncing off walls, sunlight from the windows: the main reason a scene looks real | Baked in Blender (Cycles) to a second UV set; costs nothing at runtime |
| **HDRI environment** + PBR materials | Real reflections on tile, metal and glass | `<Environment files=…>` from drei, a 1k HDR |
| **One real-time sun shadow** | Players and disguised props cast the same shadows | Shadow maps follow the camera; `PCFSoftShadowMap` |
| **Ambient occlusion** (N8AO) | Contact shadows under objects, which make props sit on surfaces | Through `@react-three/postprocessing`, already a dependency |
| **Tone mapping** (AgX), a little bloom on lamps and windows, SMAA | A filmic image and clean edges | |
| **Garden:** instanced grass with a wind shader, swaying plants, a gradient sky, floating dust in the sunbeams indoors | The world feels alive | Grass is one instanced draw call, thinned out on phones |
| **Depth of field** only in menus and on the results podium | A tilt-shift "toy photo" look | Off during play, so it's always readable |

**The rule that matters most for gameplay:** a disguised hider must look exactly like the
real props around it.
- **Disguisable props are never baked into the lightmap.** They're drawn like the players:
  real-time shadow, AO and the same material.
- **Disguises use the same mesh and materials** as the real props.
- **Static props have no extra idle animation,** so a hider that's still is identical to the
  real thing.

**Smoothness:**
- **Assets are optimised** with `gltf-transform`: meshopt compression, KTX2 (Basis)
  textures, 1k textures for small props and 2k for big surfaces, LODs for furniture.
  - Target download: about 25 MB in total.
  - The house shell and the hallway load first; the rest streams in behind the lobby's
    loading bar.
- **Draw calls stay low.** Repeated props are instanced, and the static house is merged by
  material. Targets: fewer than 250 draw calls, and about 1M triangles on desktop and 400k
  on phones.
- **Quality tiers.**
  - **High:** AO, bloom, 2k shadows, dense grass.
  - **Medium:** AO at half resolution, 1k shadows.
  - **Low:** no post-processing, baked light only, sparse grass.
  - The tier is picked automatically with drei's `PerformanceMonitor`; the device pixel
    ratio is capped at 1.5 (1.25 on phones) and lowers if fps drops. It can also be
    overridden in settings.
- **Motion is smooth everywhere.**
  - Other players are interpolated, as in Sky Climb.
  - The camera is smoothed and pulls in when it hits a wall instead of clipping through.
  - Disguises morph with a quick squash-and-pop instead of snapping.
  - Footsteps and hops have dust particles.

---

## 3. Architecture

```
Browser ── HTTPS + WSS ──▶ Cloudflare Worker (apps/realtime)
                              /rooms/…        → ClimbRoom DO   (Sky Climb, unchanged)
                              /hunt/rooms/…   → HuntRoom DO    (new, one per room)
```

No new service is needed: Prop Hunt rooms run in the same Worker, under their own Durable
Object class, so a hunt code and a climb code can never clash with each other.

### Who decides what

| Thing | Owner | Why |
|---|---|---|
| Own movement and position | Client (sent at 10 Hz) | Same as Sky Climb. Movement feels instant |
| Roles, phases, timers, the seeker rotation | Server | One source of truth |
| Disguise (which prop) | Server, on request | The server checks the prop is disguisable |
| **Zaps (hit or miss)** | **Server** | The client says what it aimed at; the server checks range and state |
| HP, dizzy, score | Server | |
| Static props | Map data in `@shadow/shared` | Deterministic: never sent over the network |

### Zap validation (server)

The client raycasts and sends `zap { target: hiderId | null }`. The server accepts a hit only
if all of these hold:

- The seeker is a seeker, isn't dizzy, the phase is `seek`, and 0.5 s have passed since their
  last zap.
- The target is a hider who is disguised and hasn't been found.
- The distance between the seeker's and the target's last reported positions is at most
  `ZAP_RANGE + 1.5` units (slack for latency).

If any check fails, the zap counts as a miss (−10 HP). Like Sky Climb, this is light
anti-cheat for a friends-only game.

### What seekers can't see

- During **hide**, the server doesn't relay hiders' positions to seekers at all.
- During **seek**, disguised hiders are relayed to seekers **without names**, as an opaque
  `slot` number that changes each round.
- A modified client could still find hiders from their positions. Like Sky Climb, v1 accepts
  that risk for games between friends.

---

## 4. Shared code (`packages/shared/src/`)

### `propHunt.ts`: rules and the map

```ts
export const HUNT_MAX_PLAYERS = 8;
export const HUNT_HIDE_SECONDS = 40;
export const HUNT_SEEK_SECONDS = 240;
export const HUNT_ROUND_RESULTS_MS = 8000;
export const HUNT_ZAP_RANGE = 6;
export const HUNT_ZAP_COOLDOWN_MS = 500;
export const HUNT_MISS_DAMAGE = 10;
export const HUNT_HIT_HEAL = 25;
export const HUNT_DIZZY_MS = 5000;
export const HUNT_TAUNT_COOLDOWN_MS = 10_000;
export const HUNT_FORCED_TAUNT = { fromSecondsLeft: 60, everyMs: 20_000 };

export interface MapProp {
  id: number;            // index within the map
  model: string;         // prop model id, e.g. "mug-white"
  pos: [number, number, number];
  yaw: number;
  scale: number;
  disguise: boolean;     // can a hider become it?
}
export const BIG_HOUSE: { props: MapProp[]; walls: Box[]; spawns: …; seekerSpawn: … };
export const seekersFor = (players: number) => (players <= 4 ? 1 : 2);
```

The map lives here so that the server can check that a disguise exists and is disguisable,
and the client can build the house from the same data.

The placement data (`BIG_HOUSE`) is exported from the Blender scene by a script in
`tools/prop-hunt/`, so the level is designed in Blender and never hand-typed.

### `propHuntRoom.ts`: the protocol

This follows `skyClimbRoom.ts`, and reuses `ROOM_CODE_*`, `normalizeRoomCode` and the
`hello` shape.

**Client → server**

| type | payload | notes |
|---|---|---|
| `hello` | as in Sky Climb | |
| `ready` / `start` / `rematch` / `leave` / `ping` | as in Sky Climb | |
| `pos` | `{ p: [x, y, z, yaw, pose, locked] }` | cm, 1/256 turns, pose index, 0/1 |
| `disguise` | `{ prop: number }` | The map prop id. Allowed during hide and seek |
| `zap` | `{ target: string \| null }` | Seekers only |
| `taunt` | `{ sound: number }` | Rate-limited by the server |
| `sonar` | – | Once per round, from 60 s left |

**Server → client**

| type | payload |
|---|---|
| `welcome` / `room` / `pong` / `error` | as in Sky Climb, plus `round`, `phase`, `phaseEndsAt`, roles, scores, HP |
| `pos` | `{ id, p }`: filtered per recipient (see §3) |
| `disguised` | `{ id, prop }` |
| `zapped` | `{ by, target \| null, hit, at }`: everyone sees the zap beam and the result |
| `found` | `{ id, by }`: the hider pops out and becomes a seeker |
| `taunt` | `{ id, sound, forced }` |
| `sonar` | `{ by, dir: [x, z] }`: sent only to that seeker |
| `roundResults` | `{ round, winners: "seekers" \| "hiders", scores[] }` |
| `results` | `{ standings[] }`: the final podium |

---

## 5. Room server (`apps/realtime/`)

1. **Extract the shared room plumbing** from `room.ts` into `roomCore.ts`: `hello` and
   auth, seating, the reconnect grace, host handover, the flood guard, the idle cleanup,
   `commit()`, `broadcast()` and the hibernation attachments. `ClimbRoom` and `HuntRoom`
   then contain only their game rules. Sky Climb's behaviour doesn't change.
2. **`huntRoom.ts`: `HuntRoom`.**
   - Phases: `lobby → countdown → hide → seek → roundResults → (hide …) → results`.
   - Each phase change is one alarm, at `phaseEndsAt`, the same way the race limit works
     today.
   - Forced taunts and the sonar unlock are scheduled on the same alarm, which always targets
     the next due event.
   - Leaving mid-round: if the last seeker leaves, a random hider becomes the seeker. If the
     last hider leaves, the round ends.
3. **`index.ts`**: route `/hunt/rooms…` to `HUNT_ROOM`, in the same way as `/rooms…`.
4. **`wrangler.jsonc`**: add the binding and the migration
   `{ "tag": "v2", "new_sqlite_classes": ["HuntRoom"] }`.
5. **Load.** 8 players × 10 Hz is about 80 incoming and 560 outgoing messages per second per
   room during play: small. Idle lobbies still hibernate.

---

## 6. Web client (`apps/web/src/games/prop-hunt/`)

```
prop-hunt/
  config.ts          movement, camera, colours, sounds
  map.ts             builds the house from BIG_HOUSE: baked shell, instanced props, colliders
  sim.ts             character controller: capsule vs boxes, gravity, hop; the hitbox follows the disguise
  net.ts             room client (generalised from sky-climb/room.ts, see below)
  store.ts           zustand: phase, role, disguise, hp, scores, local prefs
  input.ts           keyboard / pointer-lock mouse / touch (reuses sky-climb's stick)
  sound.ts           taunts, zap, pop, dizzy: synthesised with Web Audio, no files (like lib/sound.ts)
  scene/
    Game.tsx         Canvas, lights, the third-person camera rig (over the shoulder, collides with walls)
    House.tsx        walls, floors, the props
    Player.tsx       you: your avatar, or the prop you've become (wobble on hop, squash on land)
    Others.tsx       other players: avatar or prop, blended like Sky Climb rivals (~200 ms behind)
    Zap.tsx          beam, hit confetti, miss wobble
    Highlight.tsx    hiders: outline on the prop you're aiming at to "Become"
  ui/
    Lobby.tsx        code, link, 8 avatar slots, ready/start (adapted from sky-climb's Lobby)
    Hud.tsx          phase + timer, role banner, HP bar, hiders left, buttons on touch
    Blindfold.tsx    the seekers' dark garage screen during hide
    RoundResults.tsx / Podium.tsx
  PropHuntHome.tsx   landing page (paper theme, like the others)
  PropHuntPage.tsx   /games/prop-hunt/play?room=CODE
  HubCard.tsx        cover + status ("3 rooms playing")
```

- **The shared room client.** Most of `sky-climb/room.ts` (socket, backoff, clock sync,
  `useSyncExternalStore`) is game-agnostic. Move it to `apps/web/src/lib/realtimeRoom.ts`,
  parameterised by path prefix and message schemas. Then make Sky Climb and Prop Hunt thin
  wrappers around it.
- **Collisions.** No physics engine is needed.
  - The level's colliders are simple boxes and ramps (the stairs) drawn in Blender next to
    the art, and exported with the placement data. A capsule-vs-box solve, like Sky Climb's
    platform sides, is enough.
  - Small props on the floor aren't colliders; players brush past them.
  - A disguised hider's collider becomes the prop's footprint.
- **Picking.** Seekers raycast against prop meshes and other players' meshes with three.js
  `Raycaster`, sped up with `three-mesh-bvh` because the house is dense, and only send
  `zap`. Hiders raycast to choose what to become.
- **Rendering.** See "Graphics: natural and smooth" in §2.
  - Repeated props use `<Instances>` from drei.
  - The house shell is one baked, merged mesh per material.
  - Disguised players are ordinary meshes cloned from the same GLB, so they look identical
    to the real ones. **That's the whole game.**
- **The art pipeline (`tools/prop-hunt/`).** The house is built in one Blender file
  (`assets/prop-hunt/big-house.blend`): the shell, the furniture and the props, plus a
  collider layer and spawn markers. A script then:
  1. bakes the lightmaps;
  2. exports `house.glb` (the shell and static furniture), one GLB per disguisable prop
     type, and `bigHouse.ts` (placements, colliders and spawns) into `@shadow/shared`;
  3. runs `gltf-transform` (meshopt, KTX2, LODs).

  The output goes to `apps/web/public/prop-hunt/`.
- **Registry.** Add a fourth entry in `games/registry.ts`, with the tagline *"Hide as a
  toaster. Hunt your friends. Don't twitch."*

---

## 7. Rollout phases

1. **Greybox sandbox ⏳.**
   - Block out the whole house at final scale with plain boxes, plus the colliders and
     spawns, through the Blender → `bigHouse.ts` export.
   - Build the character controller, the camera, highlighting and becoming a prop, lock, hop
     and taunt sounds, all offline.
   - Walk it and time it: is it big enough, are there hiding spots on every level, does
     crossing it take about 20 s? Fix the layout now, while it's cheap.
2. **Art pass.**
   - Real models and materials, baked lightmaps, the HDRI, AO and tone mapping, the garden
     grass, and the quality tiers.
   - Check on a mid-range phone (30 fps or better) and against the download budget (about
     25 MB).
   - Check that a disguised prop is indistinguishable from the real one in a screenshot.
3. **Room server.** `roomCore.ts` extraction (Sky Climb still passes its own manual test
   plan), the `propHunt.ts` and `propHuntRoom.ts` shared code, and `HuntRoom` with phases,
   roles, disguises, zap validation and scores.
4. **The online round.** The shared web room client, the lobby, the blindfold, other players
   as avatars or props, zaps, found → seeker, the HUD and round results.
5. **The full match and polish.** The seeker rotation, the final podium, forced taunts,
   sonar, the dizzy effect, mobile controls, the hub card and landing page.
6. **Later ⬜.**
   - A second map (Grandma's Attic).
   - A "Master of disguise" hat unlock for avatars (survive 10 rounds).
   - Match results stored through the signed POST to Render, as in `Multiplayer.md` phase 4.
   - Decoys (a hider drops a fake copy of their prop) and public matchmaking.

---

## 8. Risks and notes

- **Disguised props must look exactly like the real ones.** Use the same model, scale,
  materials and lighting (never baked; see §2), with no name tags and no shadows that
  differ. Also snap the yaw of
  a locked disguise to the nearest 90° so it lines up like the furniture around it.
- **Camping.** Forced taunts, sonar and survival points that tick every 30 s (instead of only
  at the end) push hiders to make noise. Tune these numbers after playtests.
- **Seekers zapping everything.** The 10 HP miss cost (10 misses before dizzy) is the lever.
  Tune it after playtests.
- **Phones.** The touch layout has two thumbs plus four buttons, and test it early. Pointer
  lock doesn't exist on touch, so dragging the right half of the screen is the camera.
- **Latency on zaps.** The range check gets 1.5 units of slack. Seekers zapping a fast-moving
  hopping prop may occasionally miss; that's acceptable, and it's funnier than a false hit.
- **Art takes the longest.** Building and baking a realistic house is the biggest single
  task, more than the netcode. Greybox first (phase 1) so that work is never wasted on a
  layout that doesn't play well.
- **Weight on phones.** Realistic textures are heavy. KTX2, the 25 MB budget, streaming
  rooms in behind the lobby, and the low tier keep it playable. Measure on a real mid-range
  Android in phase 2, not at the end.
- **A big map with 2–3 players** can feel empty. Seekers get the sonar earlier (from 120 s
  left) when there are 3 or fewer players, and later the map could close off the first floor
  for small rooms.
- **Small rooms.** With 2 players, the game is 1 seeker versus 1 hider. It works, but it's
  best with 4 or more; the lobby says so.

---

## 9. How to test (when implemented)

1. Run `pnpm --filter realtime dev` and `pnpm dev`, then open 4 windows, some of them
   incognito.
2. Create a room in A and join from B, C and D (by code and by link). A 9th connection should
   get **room full**.
3. Start the match. The seeker's screen should be blindfolded, and hiders should not appear
   in the seeker's network traffic during hide.
4. Walk the house on desktop and on a phone. Movement and the camera should stay smooth,
   the quality tier should settle, and nothing should pop in or stutter while streaming.
5. As a hider, become a mug among the other mugs, lock it and look around; then hop and
   taunt. Other windows should see and hear it.
6. As the seeker, zap a real mug: it wobbles and HP drops by 10. Zap the hider: it pops out
   and becomes a seeker. Zap 10 wrong props: the seeker goes dizzy.
7. Let time run out with a hider still hidden. Forced taunts should play in the last 60 s,
   and the round results should show the hiders winning.
8. Play the full match. Every player should seek once, and the podium totals should match the
   round results.
9. Close a hider's tab mid-round and reopen it within 15 s. They should be back as the same
   prop in the same place.
