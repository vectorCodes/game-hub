# Shadow Guess · Feature plan

Goal: give players a reason to stay after the daily puzzle and come back tomorrow.

Already shipped before this plan: daily puzzle, free play, 6 angles, category hint, scoring,
daily streak, guess distribution, leaderboards (daily / weekly / all time), share text,
Google sign-in with guest-session claiming.

Status: ✅ done · ⏳ next · ⬜ planned

## Tier 1: highest impact, cheapest

### 1. Game feel ✅
- Synthesized sound effects (Web Audio, no files): light turning, miss, near miss, duplicate,
  hint, win, lose. Mute toggle on the stage, remembered per browser.
- Haptics on Android (misses, near misses, win, lose).
- Reveal flourish: the object spins once and lifts off the wall; spark burst on a win.
  Skipped for reduced-motion users.
- "Close!" nudge for near-miss guesses, decided server-side (`isCloseGuess`): shares a word
  with an answer, or is one typo past the tolerance. Never reveals the category.

### 2. Streak runs in free play ✅
- Free rounds chain into a run; solving a round continues it, failing one ends it.
- Run score (sum of round scores) and personal best (most solved in a row).
- Tracked server-side (`game_sessions.run_id`, migration `0002_runs`); best follows
  signed-in players across devices, guests keep it in the browser.
- A run doesn't repeat objects until it has used the whole catalog.
- Later: a 60-second timed variant (guess as many as you can).

### 3. Collection / Shadow Album ✅
- `/album` page: every solved object, grouped by category with progress ("Food 12/43")
  and a ★ Complete badge per finished category.
- Solved objects show a rendered picture (lit on the wall, casting its shadow); click one
  to turn it in 3D, with best angle, times solved and first-solved date.
- Unsolved objects are locked "?" tiles. No silhouettes: they would give away future puzzles.
- `POST /api/shadow-guess/album`: signed-in wins plus guest wins this browser remembers.
- Linked from the header, the footer, and the win screen.

### 4. Better share card ⏳
- Image of the first shadow ("Can you guess this? 🌑") alongside the emoji grid.
- The shadow is the hook that brings new players in.

## Tier 2: progression

### 5. Achievements and badges ⬜
- e.g. "First-angle genius" (won on angle 1), "7-day streak", "Food critic" (all food
  found), "No hints ×10". Built on stats we already compute.

### 6. Use the difficulty field ⬜
- Every object already has `difficulty` 1–3 in the catalog, but nothing uses it.
- Free-play runs ramp from easy to hard as they go.
- Difficulty multiplier on the score.

### 7. Archive of past dailies ⬜
- Play missed daily puzzles. Doesn't count toward the streak, but fills the album.

### 8. Streak protection ⬜
- One streak freeze per week for signed-in players, so one missed day doesn't wipe a long
  streak.

## Tier 3: social and content

### 9. Challenge a friend ⬜
- Share a link that serves the same object; results shown side by side
  ("You got it on angle 2, Sam on angle 4").

### 10. Themed weeks and more content ⬜
- The catalog leans on Food (43) and Kitchen (18). Add models in thin categories
  (Animals 3, Toys 1, Bathroom 3).
- Themed days/weeks (e.g. "Space Week") so the game feels alive.

### 11. Hard mode ⬜
- No category hint, and only 4 angles.

## Suggested order

Game feel → streak runs → album → share image, then Tier 2 top to bottom.
