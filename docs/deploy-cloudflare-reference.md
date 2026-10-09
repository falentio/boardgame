# Deployment reference

Lookup material for the Cloudflare deployment. For the deploy steps, read
[Deploying to Cloudflare Workers](./deploy-cloudflare.md).

## Worker

| Field | Value |
| --- | --- |
| Worker name | `boardgame` |
| Live URL | `https://boardgame.falent.workers.dev` |
| Account | `50e368dda66512a4e6a16238f4f5bd23` |
| Entry | `.output/server/index.mjs` |
| Build preset | `cloudflare_module` |
| Config | `wrangler.jsonc` |

## Bindings and variables

`wrangler.jsonc` sets these. The binding name must match what the code reads,
or the Worker starts and then fails on the first request that needs it.

| Name | Kind | Read by |
| --- | --- | --- |
| `DB` | D1 database | `server/utils/db.ts` (`cloudflareEnv`) |
| `ASSETS` | Static assets | the Nitro `cloudflare_module` handler, via `env.ASSETS.fetch` |
| `BETTER_AUTH_URL` | Var | `server/utils/auth.ts` (`baseURL`) |
| `PUSHER_APP_KEY` | Var | `nuxt.config.ts`, `server/modules/realtime/config.ts` |
| `PUSHER_HOST` | Var | `nuxt.config.ts`, `server/modules/realtime/config.ts` |
| `BETTER_AUTH_SECRET` | Secret | `server/utils/auth.ts` (`secret`) |
| `PUSHER_SECRET` | Secret | `server/modules/realtime/config.ts` |

Secrets are set with `wrangler secret put`. Their values cannot be read back,
only their names. A `vars` entry and a secret with the same name conflict, so
set each name in one place only.

## Routes

| Route | Serves |
| --- | --- |
| `/` | the app shell, or a redirect to `/login` when signed out |
| `/login`, `/signup` | better-auth forms |
| `/rooms/*`, `/games/*`, `/join/*` | game surfaces |
| `/api/auth/*` | better-auth (`server/api/auth/[...all].ts`) |
| `/api/me` | the session user (`server/api/me.get.ts`) |
| `/api/rooms` | the room service (`server/modules/rooms/http.ts`) |
| `/api/pusher/auth` | channel auth (`server/api/pusher/auth.post.ts`) |

## D1

| Field | Value |
| --- | --- |
| Database name | `boardgame` |
| Database id | `9c2350a0-71d8-45e1-94eb-4dbed723bd83` |
| Migrations dir | `drizzle` |
| Tables | `user`, `session`, `account`, `verification`, `room` |

Migrations are hand-authored SQL in `drizzle/`. Apply them to production with
`pnpm db:migrate:remote` and to the local Miniflare database with
`pnpm db:migrate:local`.

## Scripts

| Command | Does |
| --- | --- |
| `pnpm build` | builds `.output` with the `cloudflare_module` preset |
| `pnpm db:migrate:remote` | applies `drizzle/` migrations to the production D1 |
| `pnpm db:migrate:local` | applies `drizzle/` migrations to the local D1 |
| `pnpm sync:bindings` | prints the deployed bindings and the drift against `wrangler.jsonc` |
| `pnpm verify:deploy` | drives a browser sign-up against the live URL |
| `pnpm verify:auth` | proves the local auth flow against the local D1 |
| `pnpm verify:ui` | proves the local UI flows |

## Related

- [Deploying to Cloudflare Workers](./deploy-cloudflare.md)
- [Server, Drizzle, and auth](./design/server-drizzle-auth.md)
- [P2P lockstep](./design/p2p-lockstep.md)
