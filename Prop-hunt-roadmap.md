# Prop Hunt: what's next

Ideas for making Prop Hunt more fun, more interactive and more worth coming back to. The base
game is in `Prop-hunt-plan.md`; this file is the list of additions, roughly in the order we plan
to build them.

## Done

| Change | What it does | Commit |
|---|---|---|
| Random props every round | Walls and furniture stay, but the things to hide as are shuffled from a seed the room picks: some are left out, some become something else of about their size, most are nudged and turned, and a few extra turn up. Seekers can't learn "two mugs here, so a third is a player." | `0efbcad` |
| Found hiders are out | A found hider no longer joins the seekers: they're out until the next round and watch the others (Space or Jump for the next player). | `f55fdf8` |
| Minimap | Top right: the floor you're on, its rooms, doorways and stairs, and you as an arrow. M (or a tap) opens it large with every room named. Nobody else is on it. | `b7bcee8` |
| Decoys | A disguised hider presses G to leave a copy of their prop, 2 a round. Zapping one is a miss for the seeker and +25 for its hider. | `4328467` |
| Levels and unlocks | Signed-in players earn XP every match; levels unlock 14 generated taunt sounds (a fart at level 3). | `e3d0397` |

## Next up (recommended first)

### 1. Decoys (done)
- A disguised hider presses **G** (or the Decoy button on phones) to leave a copy of the prop
  they've become, where they stand. 2 per round (`HUNT_DECOYS`).
- A decoy looks and collides like the real prop (its hider can walk through it). Zapping it
  pops it in grey fluff and costs the seeker HP like any miss; its hider scores +25.
- Seekers get a decoy as just another prop under an id like a hider's tag, and only once they
  come out of the garage (a decoy left while they're blindfolded would show where a hider was).
- On your own (the sandbox), G leaves decoys too; the last 4 stay.

**Why:** cheap to build, and it makes for funny moments ("he zapped three bottles and none of
them was me").

### 2. Health by prop size
- Small props die to one zap; big ones take 2–3.
- A hit that doesn't finish a hider knocks them out of their disguise for a moment, or makes it
  wobble, so they have to run.

**Why:** every disguise becomes a choice between hard to spot and hard to kill.

### 3. Levels and unlocks (done)
- Signed-in players only. XP = match points + 50 for finishing + 100/50/25 for the podium.
  Level L needs 50·L·(L−1) XP in total (100 for level 2, 1,000 for 5, 4,500 for 10).
- The room reports results to the API (`POST /api/hunt/results`, shared `HUNT_RESULTS_SECRET`),
  so nobody can give themselves XP; a retried report counts once.
- 14 new generated taunt sounds (a fart at level 3) unlock from level 2 to 18 (`HUNT_TAUNTS`); pick one or several
  (they shuffle) in the lobby. Level badges in the lobby and podium; XP and unlocks on the podium.

**Why:** a reason to come back tomorrow.

## Quick wins

- **Near misses:** "Close call!" when a zap lands near a hider, with bonus points if they survive it.
- **Bolder taunts pay more:** louder or longer taunts earn more points.
- **Kill feed:** a small list of who found whom, in the corner.

## Moment-to-moment fun

### Seeker gadgets (one use each per round)
- **Scanner:** real props nearby glow for 2 s; hiders don't.
- **Sniff:** footprints show for a moment.
- **Freeze grenade:** props in an area can't move for a few seconds.

### Hider abilities
- **Dash:** a quick roll to get away when spotted.
- **Swap:** instantly become the prop you're looking at, even mid-chase.

### Ghost chat for players who are out
- Players who are out can ping a spot (seen only by others who are out) or cheer, so being
  found doesn't mean just watching.

## Long-term pull

- **Daily challenges:** "Survive as a mug", "Find 3 hiders in under 60 s", rewarded with XP.
- **Match awards on the podium:** best hider, sharpest seeker (accuracy), most zaps wasted.
- **A second map:** a supermarket, school or toy shop.
- **Round replays:** a 5-second clip of how each hider was found.

## Party modes (the host picks)

- **Everyone's a mug:** every hider must be the same prop.
- **Tiny mode:** only small props allowed.
- **One seeker against everyone.**

## Notes

- Anything that changes the room's messages bumps `HUNT_PROTOCOL_VERSION` and needs a realtime
  deploy (`pnpm --filter realtime run deploy`); the web app deploys itself when main is pushed.
- The server judges everything a seeker mustn't know (decoys, who's where); clients only show it.
