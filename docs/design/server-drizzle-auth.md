# Server data layer: drizzle, Cloudflare D1, better-auth

How server routes reach a D1-backed drizzle client and the better-auth instance. Read this before adding a server route.

## What a route author does

Server code imports two accessors from `server/utils/`, which Nitro auto-imports into the server scope.

```ts
const db = useDb(event)          // DrizzleD1Database bound to the D1 `DB` binding
const auth = getAuth(event)      // the better-auth instance for this request
const session = await getAuthSession(event)   // { session, user } | null
const { user } = await requireSession(event)  // same, but throws 401 when absent
```

A route never reads `event.context.cloudflare` itself. The accessors are the only place that knows the binding path, and they work unchanged under `nuxt dev` (Miniflare emulation) and on Cloudflare Workers.

## How it works

The flow is a chain of pure functions rooted at the request event.

```
request event
   │
   ▼
cloudflareEnv(event)   reads event.context.cloudflare.env, validates it, returns CloudflareEnv
   │
   ├─▶ dbFromEnv(env)  → drizzle(env.DB, { schema })   memoized per env object
   │
   └─▶ getAuth(event)  → betterAuth({ database: drizzleAdapter(dbFromEnv(env)), ... })
                          memoized per env object
```

`server/utils/db.ts` owns the env resolver and the db client. `server/utils/auth.ts` owns the auth instance and the session helpers, and builds its db through `dbFromEnv`, so `db` and `auth` can never disagree about which env they came from.

Both caches are `WeakMap`s keyed by the env object. Cloudflare hands the same immutable env object to every request in an isolate, so the key cannot go stale, and a rebuilt Miniflare proxy in dev is a new key rather than a stale entry. This is safe because better-auth keeps per-request state in `AsyncLocalStorage`, not on the instance.

## Files

```
wrangler.jsonc                 D1 binding `DB`, nodejs_compat, migrations_dir `drizzle`
drizzle.config.ts              drizzle-kit config: dialect sqlite, schema, out
drizzle/                       generated migration SQL
server/db/schema.ts            drizzle tables: user, session, account, verification
server/utils/db.ts             CloudflareEnv, Db, cloudflareEnv, dbFromEnv, useDb
server/utils/auth.ts           AppAuth, createAuth, getAuth, getAuthSession, requireSession
server/api/auth/[...all].ts    better-auth HTTP handler at /api/auth/*
scripts/verify-auth.mjs        live round-trip proof against local D1
```

## Migrations

Generate SQL from the schema, then apply it to the local D1 database.

```sh
pnpm drizzle-kit generate
pnpm exec wrangler d1 migrations apply boardgame --local
```

For production, run the same commands against the remote database with `--remote`. That path needs a real `database_id` in `wrangler.jsonc`: replace the all-zero placeholder with the id from `wrangler d1 create boardgame` first.

## Configuration

`BETTER_AUTH_SECRET` (at least 32 characters) and `BETTER_AUTH_URL` are read from the Cloudflare env. Locally they come from `.dev.vars`; in production set them with `wrangler secret put`. A missing or short secret fails the request with a 500 rather than starting a broken auth instance.

## Why the schema is hand-written

`server/db/schema.ts` is written by hand, not pasted from the better-auth CLI. The CLI's generated file imports `defineRelationsPart`, which does not exist in `drizzle-orm@0.45.3`, so it would not compile. The schema matches better-auth's field names exactly, which the drizzle adapter requires: it indexes each table by field name, so a JS property key must equal the better-auth field name. SQL column names are snake_case.

## Verify

`node scripts/verify-auth.mjs` boots the dev server under the Cloudflare preset, signs up a user, reads the session back with the issued cookie, and asserts the row landed in local D1.
