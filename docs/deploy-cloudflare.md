# Deploying to Cloudflare Workers

The app is a Nuxt 4 SSR app built with Nitro's `cloudflare_module` preset
(`nuxt.config.ts`, `nitro.preset`). The build emits the Worker entry at
`.output/server/index.mjs` and the static assets in `.output/public/`.

Data lives in Cloudflare D1, auth is better-auth, and realtime fan-out uses a
Pusher-compatible service. The Worker runs at
`https://boardgame.falent.workers.dev`.

For binding names, routes, and table names, read the
[deployment reference](./deploy-cloudflare-reference.md).

## 0. Install and sign in

Install dependencies and authenticate Wrangler once per machine.

```sh
pnpm install
pnpm exec wrangler login          # or export CLOUDFLARE_API_TOKEN
```

## 1. Point `wrangler.jsonc` at the target account

The committed config already targets the production account. Change it only to
deploy somewhere else.

To use a different D1 database, create it and let Wrangler write the id:

```sh
pnpm exec wrangler d1 create boardgame --update-config --binding DB
```

Keep three things in the config:

1. An `assets` block bound as `ASSETS`. Without it `wrangler deploy` uploads
   the Worker but no static files, so every `/_nuxt/*`, `/roles/*`, font, and
   image request returns 404.
2. `BETTER_AUTH_URL` in `vars`, set to the deployed origin. better-auth trusts
   this origin, so a mismatch makes sign-in return `403 INVALID_ORIGIN`.
3. The `d1_databases` entry bound as `DB`.

If you change the Worker host, update `BETTER_AUTH_URL` in the same deploy.

## 2. Set the production secrets

`BETTER_AUTH_SECRET` is required. It needs at least 32 characters. A missing or
short value makes every request return 500 from `cloudflareEnv()`.

```sh
openssl rand -base64 48 | pnpm exec wrangler secret put BETTER_AUTH_SECRET
printf '<pusher-app-secret>' | pnpm exec wrangler secret put PUSHER_SECRET
```

`PUSHER_SECRET` is optional. Without it a room still works, but realtime pushes
stop and `POST /api/pusher/auth` returns 503.

Set each secret by piping the value in, so it never lands in your shell history.
Read the value back as a name only with `pnpm exec wrangler secret list`.

## 3. Apply the migrations

```sh
pnpm db:migrate:remote
```

The migrations are the hand-authored SQL in `drizzle/`. Generate a new one with
`pnpm db:generate` and commit it. Apply the same migrations to the local
Miniflare database with `pnpm db:migrate:local`.

## 4. Build and deploy

```sh
pnpm build                       # nuxt build, cloudflare_module preset
pnpm exec wrangler deploy        # reads main, assets, and d1 from wrangler.jsonc
```

The deploy prints the bindings it uploaded. Check that the list contains
`env.DB`, `env.ASSETS`, `env.PUSHER_APP_KEY`, and `env.PUSHER_HOST`.

To try the production build against the local D1 before you ship it, run
`pnpm build` and then `pnpm exec wrangler dev`.

## 5. Verify the deploy

Run the browser proof against the live URL.

```sh
pnpm verify:deploy
```

It signs up through the real form, so it exercises the origin check that a
`curl` POST skips. All checks passing means the Worker, the secret, the D1
binding, and the schema are live.

For a manual check, fetch the root and stream the logs.

```sh
curl -sS -o /dev/null -w '%{http_code}\n' https://boardgame.falent.workers.dev/
pnpm exec wrangler tail           # stream live logs and errors
```

A 302 to `/login` on the root is correct while signed out. A 500 with
`Missing D1 binding "DB"` or `Missing BETTER_AUTH_SECRET` means a binding or
secret did not reach the Worker.

## 6. Roll back a bad deploy

Wrangler keeps every version. To find the ids, run
`pnpm exec wrangler versions list --name boardgame --json`. The last entry is
the newest.

```sh
pnpm exec wrangler rollback <version-id>
```

A rollback restores the Worker code. It does not undo a D1 migration, so treat a
schema change as forward-only and ship a new migration to correct it.

## 7. Recover a config that drifted from the dashboard

`wrangler.jsonc` is the source of truth. If you add a binding or var in the
Cloudflare dashboard, the next `wrangler deploy` removes it unless it also
appears in the config file. Secrets are the exception. A deploy never deletes
them, and their values cannot be read back either.

Wrangler has no command that downloads a config. To see what is deployed and
how it differs from the file, run:

```sh
pnpm sync:bindings                 # report plus a drift line per field
pnpm sync:bindings -- --json       # machine-readable
node scripts/sync-wrangler-bindings.mjs --from saved-version.json   # offline
```

The report prints a `wrangler.jsonc`-shaped fragment and an `ok` or `DIFF`
line per field. Copy the remote ids back into `wrangler.jsonc` by hand.

To keep dashboard vars during a migration, set `keep_vars: true` in
`wrangler.jsonc`. Turn it off once the file is authoritative.

## Notes

- `nodejs_compat` is required. The Pusher signer uses `node:crypto`.
- The `ASSETS` binding serves static files. The `_headers` file from the build
  sets immutable caching for `/_nuxt/*`.
- Nothing runs on Node. `wrangler deploy` bundles `.output/server/index.mjs`
  into one Worker with the unenv Node shims.
