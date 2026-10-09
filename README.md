# boardgame

A web app for playing Coup: Rebellion G54 with friends. Nuxt 4 renders the
client and the server. Rooms, seats, and game state live in Cloudflare D1, auth
is better-auth, and realtime fan-out uses a Pusher-compatible service.

The game runs on a lockstep primitive in `shared/core/lockstep`. Two peers that
fold the same frames reach identical state, which is what lets the room keep
players in sync.

Live at https://boardgame.falent.workers.dev.

## Requirements

- Node 24 (`.nvmrc`)
- pnpm 12

## Run it locally

```sh
pnpm install
cp .dev.vars.example .dev.vars      # then fill in the values
pnpm db:migrate:local
pnpm dev
```

The dev server runs at http://localhost:3000 and uses a local Miniflare D1
database, so it needs no Cloudflare account.

`BETTER_AUTH_SECRET` must be at least 32 characters, and `BETTER_AUTH_URL`
must match the host you serve from, or sign-in fails with `403 INVALID_ORIGIN`.

## Checks

```sh
pnpm test            # unit and integration tests
pnpm typecheck       # shared
pnpm typecheck:server
pnpm typecheck:client
pnpm verify:auth     # local auth flow, end to end
pnpm verify:ui       # local UI flows, in headless Chrome
```

## Layout

| Path | Holds |
| --- | --- |
| `app/` | Nuxt pages, components, and composables |
| `server/` | API routes and the room, game, realtime, and user modules |
| `shared/` | the lockstep engine, the G54 game, and room rules |
| `drizzle/` | D1 migrations |
| `scripts/` | proofs and the binding sync tool |

## Docs

- [Deploying to Cloudflare Workers](./docs/deploy-cloudflare.md)
- [Deployment reference](./docs/deploy-cloudflare-reference.md)
- [Server, Drizzle, and auth](./docs/design/server-drizzle-auth.md)
- [P2P lockstep](./docs/design/p2p-lockstep.md)
- [G54 full game](./docs/design/g54-full-game.md)
- [G54 rules research](./docs/research/coup-rebellion-g54/README.md)
