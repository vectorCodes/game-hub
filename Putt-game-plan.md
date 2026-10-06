# GameHub · Game #3 plan: **Putt Isles** ⛳ (daily mini-golf on floating islands)

## Context

GameHub has two games. **Shadow Guess** is a daily puzzle you solve by thinking. **Sky Climb**
is a daily 3D platformer you play by reflex. Around them we've built shared systems: avatars,
daily seeds, leaderboards, streaks, a locker with coins, ghosts, and multiplayer rooms on
Durable Objects. The third game should:
1. **Feel different** from both: not another guessing game and not another jump-and-run.
2. **Reuse the hub**: the player's avatar, the daily seed, leaderboards, rooms and the locker.
3. **Keep the hub's daily habit**: one shared challenge a day, about 5 minutes, and a result
   worth sharing.


---

## 1. Which game? (why mini-golf)

| Candidate | Fun | Different from the hub | Reuse | Daily + share | Cost | Verdict |
|---|---|---|---|---|---|---|
| **⛳ Mini-golf (Putt Isles)** | High. "One more try," lip-out drama | ✅ Aim and physics, calm but skilful | Avatar, seed, rooms, ghosts, locker | ✅ Strokes vs par share like Wordle | Medium | **Pick** |
| 🟥 Floor-falls party (Hex-a-gone style) | Very high with friends | Medium: still a platformer | sim.ts, rooms | ❌ Needs live players or bots | Medium | Later, as a room mode |
| 🏎️ Kart racer | High | ✅ | Avatar | Medium | High: tracks, AI, netcode | No |
| 🧱 Stack builder | Medium, gets shallow | ✅ | Little | ✅ | Low | No |

Why mini-golf wins:
- **Anyone can play in 3 seconds.** Drag back, let go. It works the same on phone and desktop.
- **Skill on top of luck.** Bank shots, ramps and windmill timing reward mastery, but a lucky
  bounce can still give a beginner a hole-in-one. That's the moment people share.
- **Fits the daily format.** 9 holes, a par for each, and everyone plays the same course. The
  score is one number (−2, E, +3), easy to compare and brag about.
- **Kenney Minigolf Kit (CC0)** has ~125 pieces in the same low-poly style as our Platformer
  Kit: straights, corners, ramps, loops, windmill, castle, bumpers, holes, flags, ball, club.

---

## 2. What the game is

**Putt Isles:** a chain of 9 floating sky islands (the same sky world as the hub and Sky
Climb). Each island is one mini-golf hole. Your avatar is the golfer. Sink the ball in as few
strokes as you can. Every day brings a new course, the same for everyone.

### Core loop (one hole, about 20–40 s)
1. **Flyover:** the camera glides from the cup back to the tee and shows the hole (skip with a tap).
2. **Aim:** drag back from the ball like a slingshot. A dotted line shows the direction up to
   the first bounce, and the length of the pull sets the power (a ring fills green → yellow → red).
3. **Shoot:** your avatar swings. The ball rolls, bounces and rides ramps while the camera follows it.
4. **Settle:** the ball stops and you aim again, or it drops in the cup 🎉, or it falls in the
   water or off the island (+1 stroke, back to where you shot from).
5. **Pick up:** still not in after 7 strokes, the hole ends and scores 7, so nobody gets stuck.

### A round
- **Daily course:** 9 holes, seed `putt-daily-<date>`. One scored attempt a day; replay as
  practice.
- **Difficulty ramp**, like Sky Climb's zones:

| Holes | Island | Look | New mechanic |
|---|---|---|---|
| 1–2 | 🌱 Meadow | Grass, flowers | Straights, corners, gentle slopes (par 2) |
| 3–4 | 🌳 Grove | Wood, hedges | Ramps, bumpers, first windmill (par 2–3) |
| 5–6 | 🏜️ Dunes | Sand, cacti | Sand traps (slow), conveyors, split paths with a risky shortcut |
| 7–8 | ❄️ Glacier | Ice, snow | Slippery ice, moving blocks, a cannon tube (reuses the Sky Climb cannon idea) |
| 9 | ⛈️ Storm Finale | Night, lightning | Long multi-tier hole with a loop-the-loop and a jump gap over the void |

- **Practice / Free play:** random seed, unlimited, no leaderboard.
- **Score:** total strokes vs total par. Tie-breaker: fewer resets, then faster time.

### Course generator (seeded, hand-made pieces)
Same idea as Sky Climb's chunks (`tower.ts`):
- A library of about 40 **hand-made hole templates** (`holes.ts`): grid layout of kit tiles,
  tee, cup, par and difficulty 1–5.
- The seed picks one template per slot to fit the ramp, then varies it: mirror, rotation,
  obstacle swaps (bumper ↔ windmill), the phase of moving parts, and where coins go.
- Each template ships with a known solution shot (angle and power) and a check that it still
  sinks, so every hole can be finished.

---

## 3. The hook: why players come back and share

1. **Wordle-style share card**, one emoji per hole:
   `Putt Isles #12 ⛳ −2  🦅🐦⚪⚪🐦🟧⚪🐦⭐` (🦅 eagle, 🐦 birdie, ⚪ par, 🟧 bogey, ⭐ hole-in-one).
   It also has an image of the course map with your ball's path drawn in (later, as with Shadow Guess's share image).
2. **Hole-in-one is the jackpot.** Every hole has at least one bank or ramp route that can go
   straight in. Finding it is the secret people talk about.
3. **Ghost balls:** after your shot, a faint trail shows how the day's best player played that
   hole (built from `ghosts.ts`: record and blend frames). Learn from the best, then beat them.
4. **Golden Ring coins:** floating rings over risky lines. Shoot through them for coins in the
   shared locker. Risk and reward: the ring line is often the harder line.
5. **Cross-game unlocks** (the avatar is the link between games):
   - First hole-in-one → 🧢 **Golf cap** (avatar hat)
   - 7-day putt streak → 🧤 **Pro visor**
   - Finishing under par 10 times → ⛳ **Golden club** (club skin)
   - Locked items appear in the avatar editor with "Earn in Putt Isles", which advertises the game.
6. **Friends' rooms (phase 3):** the existing `apps/realtime` rooms. Everyone plays the same
   9 holes at once, sees other balls rolling live on the same island (no collisions), and the
   lowest total wins.
7. **Streaks and leaderboards:** daily, weekly and all time. Reuses `apps/api` leaderboard
   patterns and the `user_stats` row per game.

### Is it fun? (honest check)
- ✅ **Short sessions:** a hole takes under a minute and a round about 5 minutes. Fits a coffee break.
- ✅ **Drama:** lip-outs, near misses and slow rolls to the edge are naturally tense; lean on
  slow motion and sound for them.
- ✅ **Mastery:** the same moving obstacles every day reward timing; the leaderboard rewards
  finding shortcuts.
- ⚠️ **Risk: physics that feels floaty or unfair.** Mitigation: every tuning value lives in
  `config.ts`; the cup gently pulls in a ball that is slow and close (capture radius), and a
  fast ball lips out. Prototype the feel first (Phase 1) before building content.
- ⚠️ **Risk: repetition.** Mitigation: 40+ templates × variations × 5 island themes, and
  themed weeks reused from `assets/themes.json` (e.g. 🎃 Spooky Putt with the Graveyard Kit).

---

## 4. Animations and game feel

| Moment | Animation / effect | Sound (synthesized in `lib/sound.ts`) |
|---|---|---|
| Hole start | Camera flyover cup → tee; the island floats up out of the clouds | Soft whoosh |
| Aiming | Avatar in address pose; dotted aim line; power ring pulses; the club pulls back with power | Rising tick as power grows |
| Swing | Procedural swing: arm and spine bones rotate, the club attached to the hand bone; head follows the ball | "Tok" pitched by power |
| Ball roll | Ball spins to match its speed; a short trail (locker trails reuse Sky Climb trails); dust on grass, puffs on sand | Rolling hum |
| Wall bounce | Small spark and squash on the ball | Wood or stone "clack" |
| Windmill / movers | Constant motion driven by the sim clock, so everyone sees the same thing | Creak loop |
| Near the cup | Slow motion (0.4×) when the ball is within 1 m and slow; the camera leans in | Crowd "ooooh" swell |
| Sink | Ball drops with a "plunk"; the flag jumps; confetti burst; result stamp (BIRDIE!) slams in | Plunk + chime |
| Hole-in-one | Slow motion, camera orbits the cup, fireworks; the avatar plays `emote-yes` and a jump | Fanfare |
| Water / void | Splash or "fall into the clouds"; the avatar plays `emote-no` | Splash / whistle |
| Lip-out | Ball circles the rim and pops out, with a camera shake | Clink + "aww" |
| Scorecard | Cards flip in per hole; the total ticks up; the share button bounces | Card flips |

Reduced motion: skip the flyover, slow motion and shake (same rule as the Shadow Guess reveal).
Haptics on Android for the swing, the sink and splashes.

---

## 5. Tech plan (reuse first)

### Physics
- **Rapier** (`@dimforge/rapier3d-compat`, loaded lazily so only this game pays the WASM
  cost). A ball rolling on slopes, ramps, loops and moving bumpers needs real rigid-body
  contact; Sky Climb's one-way-platform sim doesn't cover that.
- Fixed 60 Hz step; collision shapes are made once per template from simple box and ramp
  shapes, not from the visual meshes.
- **Deterministic:** Rapier is deterministic on all platforms. A shot is recorded as
  `{tick, angle, power}`, so the API can **replay a round in Node to verify the score**
  (better anti-cheat than Sky Climb's speed limit), and ghosts are just replays.

### Reused as-is
- Avatar: `apps/web/src/avatar/` (`useAvatarModel`, `buildAvatar`, `animateAccessories`). The
  golfer is the player's avatar; the club is a small GLB on the hand bone.
- Daily seeds: `makeRng` from `apps/web/src/games/sky-climb/tower.ts` (move it to `packages/shared`).
- Ghost recording and blending: `apps/web/src/games/sky-climb/ghosts.ts`.
- Sounds: `apps/web/src/lib/sound.ts` (add new `Sound` ids).
- Hub entry: `apps/web/src/games/registry.ts` (add a `putt-isles` entry with Landing, Component, Cover, Status).
- Rooms: `apps/realtime` (`room.ts`) and `packages/shared/src/skyClimbRoom.ts`. Make the protocol
  game-generic, or add a `PuttRoom` Durable Object class.
- Locker, coins and achievements: the pattern in `packages/shared/src/skyClimb.ts`
  (`CLIMB_ITEMS`, `evaluateAchievements`, `ownedItems`).
- Guest runs claimed on sign-in: the pattern in `apps/web/src/games/sky-climb/guest.ts`.

### New files (they mirror the `sky-climb/` layout)
```
apps/web/src/games/putt-isles/
  config.ts        physics and tuning values, island themes, par rules
  holes.ts         hand-made hole templates
  course.ts        seeded generator: picks templates and varies them
  physics.ts       Rapier world wrapper: step, shot, settle detection, replay
  store.ts         zustand: round state, strokes, phase (flyover/aim/roll/sunk)
  input.ts         drag-to-aim (pointer events, mobile first)
  PuttHome.tsx · PuttPage.tsx · HubCard.tsx · guest.ts
  scene/  Game.tsx  CourseView.tsx  Ball.tsx  Golfer.tsx  Cup.tsx  AimLine.tsx  Effects.tsx  Environment.tsx
  ui/     Hud.tsx  Scorecard.tsx  Panels.tsx  Share.tsx
apps/web/public/putt-isles/kit/      Minigolf Kit GLBs (meshopt-compressed)
packages/shared/src/puttIsles.ts     zod bodies, par/score names, items, achievements
apps/api/src/modules/putt-isles/     routes.ts, service.ts (start, finish+verify, daily, leaderboard)
apps/api migration 0006_putt_isles:   table putt_rounds(id, user_id, mode, seed, date,
                                      strokes int[], shots jsonb, total, par, status, created_at)
```

---

## 6. Phases

| Phase | What ships | Status |
|---|---|---|
| **1. Feel prototype** | One hand-made hole, Rapier ball, drag aim, camera, sink. Tune until putting feels great. | ✅ |
| **2. MVP daily** | 20 templates, generator, 9-hole daily + practice, avatar golfer, scorecard, share text, hub card, API + leaderboard | ⬜ |
| **3. Juice** | All animations in §4, slow motion, sounds, island themes, reduced-motion mode | ⬜ |
| **4. Hooks** | Ghost balls, golden rings and coins, locker items, cross-game avatar unlocks, achievements, streak | ⬜ |
| **5. Social** | Friend rooms on `apps/realtime`, share image with the path drawn in, server replay verification | ⬜ |
| **6. Content** | 40+ templates, themed-week courses, weekly "Pro Course" (18 holes, harder) | ⬜ |

### Phase 1 notes (as built)
- Holes are ASCII maps (`holes.ts`); `course.ts` auto-tiles them: every cell gets walls wherever it
  has no neighbour, so any fairway or green shape picks its own kit piece and rotation.
- Collision comes straight from the kit's meshes (`collision.ts`): one merged green mesh and one
  wall mesh per hole, seams merged so the ball rolls over tile joins.
- Contacts are frictionless and the ball's rotation is locked; rolling is modelled as damping plus
  a steady rolling resistance, and the spin is only drawn. Rapier's own friction scrubbed bank
  shots dead and made rolls crawl. Full power rolls ~8 m in ~4 s.
- Hole limit: 7 strokes; still not in after 7, the hole is picked up and scores 7.
- Out of bounds: +1 stroke, the ball comes back where it was hit from.

---

## 7. Verification
- Phase 1: play the prototype hole at `/games/putt-isles/play` on desktop and on a phone over
  the LAN; check the ball never tunnels through walls at maximum power.
- Generator: a dev page `/dev/putt` renders any seed's 9 holes and replays each template's
  stored solution shot (it must sink).
- API: finish a daily round, see it on the leaderboard; post a tampered `strokes` array and
  check the replay verifier rejects it.
- Ports: API on 3100, web on its usual port (see local port conflicts memory).
- Per project preference, the user runs typecheck and build; no new tests unless asked.
