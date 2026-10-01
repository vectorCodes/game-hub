# GameHub · Shadow Guess

Guess a hidden 3D object from its shadow. Every wrong guess turns the light.

## Run locally

```sh
pnpm install
pnpm dev        # web → http://localhost:5173, API → http://localhost:3100
```

Without `DATABASE_URL`, the API uses an embedded Postgres (PGlite, stored in
`apps/api/.pglite`). On every startup it migrates and re-syncs `assets/catalog.json`, so
just restart the API after editing the catalog. PGlite is single-process, so don't run
`db:seed` while the dev API is running. No Docker is needed.

- Game: http://localhost:5173/games/shadow-guess
- Angle picker (dev only): http://localhost:5173/dev/angles

## Layout

| Path | What |
|---|---|
| `apps/web` | React + Vite + react-three-fiber: games hub, Shadow Guess, dev angle picker |
| `apps/api` | Fastify + Drizzle: sessions, server-side guess checking and scoring, daily puzzle |
| `packages/shared` | Guess matcher, scoring, angles, Zod API contract (used by web + api) |
| `tools/models` | Model pipeline: fetch Kenney kits → normalize → upload to Supabase Storage |
| `assets/catalog.json` | Hand-edited object list (names, aliases, category, source model, angles) |
| `assets/models/` | Built GLBs named by content hash + `manifest.json` (id → key) |

## Model pipeline

```sh
pnpm models:fetch    # download the CC0 Kenney kits into assets/raw (gitignored)
pnpm models:build    # center, scale, strip names, meshopt-compress → assets/models
pnpm --filter api db:seed   # sync catalog.json + manifest into game_objects
```

To add an object, add an entry to `assets/catalog.json`, then run build and seed.

`models:build` rounds off low-poly facets with Loop subdivision so round things cast smooth
shadows. Food, Nature and Animals are smoothed by default (2 passes); everything else stays
crisp. Override per object with `"smooth": 0 | 1 | 2` in the catalog: smoothing melts boxy
shapes and can speckle parts that mix several palette colours, so check the revealed model.
Pick its 6 angles in `/dev/angles`: **Save** writes them to `catalog.json` and the DB.

## Supabase

1. Copy `apps/api/.env.example` to `apps/api/.env`, then fill in `DATABASE_URL` (pooler,
   transaction mode), `SUPABASE_URL`, and `MODELS_BASE_URL=https://<project>.supabase.co/storage/v1/object/public/models`.
2. Run `pnpm --filter api db:migrate` then `pnpm --filter api db:seed`.
3. Run `SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… pnpm models:upload`.

Every table has RLS enabled with no policies, so the public anon key can't read answers.

After changing `apps/api/src/db/schema.ts`, run `pnpm --filter api db:generate -- --name <change>`.

## Google sign-in

Sign-in is optional: without the web env vars, the site runs guest-only. Guests can play
everything; signing in adds stats, a daily streak, and one daily per account. Games
played as a guest in the same browser move into the account on sign-in.

1. **Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID**
   (type *Web application*). Under *Authorized redirect URIs*, add
   `https://<project>.supabase.co/auth/v1/callback`.
2. **Supabase → Authentication → Sign In / Providers → Google**: enable it and paste
   the client ID and secret.
3. **Supabase → Authentication → URL Configuration**: set *Site URL* to
   `http://localhost:5173` and add `http://localhost:5173/**` to the redirect URLs
   (add your production domain too).
4. Copy `apps/web/.env.example` to `apps/web/.env` and set `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY`.
5. Set `SUPABASE_URL` in `apps/api/.env`, so the API can verify tokens via JWKS. Use
   `SUPABASE_JWT_SECRET` only for legacy HS256 projects.

## Tests

```sh
pnpm test        # shared matcher/scoring + API (in-memory PGlite)
pnpm typecheck
```

## Status

Milestones 1–6 are done (sign-in is Google only). Remaining: milestone 7, deployment (Vercel + Railway + Supabase).
