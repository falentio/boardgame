# Deploying to Cloudflare Workers

The app is a Nuxt 4 SSR app built with Nitro's `cloudflare_module` preset
(`nuxt.config.ts` → `nitro.preset: 'cloudflare_module'`). The build emits:

- `.output/server/index.mjs` — the Worker entry (`main` in `wrangler.jsonc`)
- `.output/public/` — static assets, including `_headers`

Data lives in Cloudflare **D1** (binding `DB`), auth is **better-auth**, and
realtime fan-out is a Pusher-compatible service configured through env vars.

## 0. One-time prerequisites

```sh
pnpm install
pnpm exec wrangler login          # or export CLOUDFLARE_API_TOKEN
```

## 1. Check `wrangler.jsonc` before the first deploy

The checked-in config is already wired for production. A fresh clone only needs
these when the target account differs:

1. **`database_id`.** The committed id `9c2350a0-71d8-45e1-94eb-4dbed723bd83`
   is the production `boardgame` database. To point at a different one, create it
   and paste the returned id:

   ```sh
   pnpm exec wrangler d1 create boardgame --update-config --binding DB
   ```

2. **Add an `assets` block.** Without it `wrangler deploy` uploads the Worker but
   no static files, so every `/_nuxt/*`, `/roles/*`, font and image request
   404s. The Nitro preset expects the assets bound as `ASSETS` (the generated
   `nitro.mjs` calls `env.ASSETS.fetch`):

   ```jsonc
   "assets": { "directory": ".output/public", "binding": "ASSETS" },
   ```

   (Alternatively, keep the config untouched and pass
   `--assets .output/public` on every deploy command.)

3. **`BETTER_AUTH_URL` lives in `vars`, not a secret.** It is the Worker's own
   public URL. better-auth trusts it as an origin, so it must match the deployed
   host or sign-in POSTs get `403 INVALID_ORIGIN`.

Resulting shape:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "boardgame",
  "compatibility_date": "2025-07-15",
  "compatibility_flags": ["nodejs_compat"],
  "main": ".output/server/index.mjs",
  "assets": { "directory": ".output/public", "binding": "ASSETS" },
  "vars": {
    "PUSHER_APP_KEY": "boardgame-byc3vc",
    "PUSHER_HOST": "wss.vask.dev",
    "BETTER_AUTH_URL": "https://boardgame.falent.workers.dev"
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "boardgame",
      "database_id": "9c2350a0-71d8-45e1-94eb-4dbed723bd83",
      "migrations_dir": "drizzle"
    }
  ]
}
```

## 2. Set production secrets

`BETTER_AUTH_SECRET` (≥ 32 chars) is required. A missing or short value makes
every request 500 (`server/utils/db.ts`). `BETTER_AUTH_URL` is a `vars` entry,
not a secret, and is already set in `wrangler.jsonc`.

```sh
openssl rand -base64 48 | pnpm exec wrangler secret put BETTER_AUTH_SECRET
printf '<pusher-app-secret>' | pnpm exec wrangler secret put PUSHER_SECRET
```

`PUSHER_SECRET` is optional. Without it room realtime is a no-op and
`POST /api/pusher/auth` returns `503`, so a room still works but does not
push updates. `PUSHER_APP_KEY` / `PUSHER_HOST` are non-secret and already in
`vars`.

> **Auth origins:** better-auth trusts `new URL(BETTER_AUTH_URL).origin`
> automatically, so the deployed host is trusted once `BETTER_AUTH_URL` matches
> it. `LOCAL_HOSTNAMES` in `server/utils/auth.ts` covers only local dev and
> previews; you do not need to add the production origin there. If you change the
> Worker host, update `BETTER_AUTH_URL` in the same deploy or sign-in POSTs
> return `403 INVALID_ORIGIN`.

## 3. Apply migrations to the remote D1

```sh
pnpm exec wrangler d1 migrations apply boardgame --remote
```

Migrations are the hand-authored SQL in `drizzle/` (`migrations_dir`). Generate
new ones with `pnpm db:generate` and commit them. Use `--local` for the Miniflare
database used by `nuxt dev`.

## 4. Build and deploy

```sh
pnpm build                       # nuxt build → .output (cloudflare_module preset)
pnpm exec wrangler deploy        # reads main + assets + d1 from wrangler.jsonc
```

Deploy output should list bindings: `env.DB`, `env.ASSETS`,
`env.PUSHER_APP_KEY`, `env.PUSHER_HOST` (plus the secrets).

Preview the production build locally against local D1 before shipping:

```sh
pnpm build
pnpm exec wrangler dev            # main + assets + local D1
```

## 5. Verify

```sh
curl -sS -o /dev/null -w '%{http_code}\n' https://<your-worker-domain>/
pnpm exec wrangler tail           # stream live logs / errors
```

Then exercise a real sign-up and a room create/join. Watch for
`Missing D1 binding "DB"` / `Missing BETTER_AUTH_SECRET` 500s — those come from
`cloudflareEnv()` and mean a binding or secret did not reach the Worker.

## 6. Syncing `wrangler.jsonc` with dashboard edits

`wrangler.jsonc` is the **source of truth**. If you add a D1 binding, KV
namespace, var, etc. in the Cloudflare dashboard, the next `wrangler deploy`
will **remove** anything not in the config file. Secrets are the exception:
they are never deleted by a deploy, but their values can't be read back either.

There is **no `wrangler pull` / `wrangler import`** command to download a
config. The closest primitives are:

| Command | Gives you |
| --- | --- |
| `wrangler versions list --name boardgame --json` | version ids, newest last |
| `wrangler versions view <id> --name boardgame --json` | `resources.bindings` — the actual deployed bindings, incl. D1/KV/R2 ids |
| `wrangler deployments status --name boardgame --json` | which version ids are live |
| `wrangler secret list --name boardgame --json` | secret **names** only |

`scripts/sync-wrangler-bindings.mjs` wraps those into a config fragment plus a
drift report:

```sh
pnpm sync:bindings                 # human-readable report + drift vs wrangler.jsonc
pnpm sync:bindings -- --json       # machine-readable
node scripts/sync-wrangler-bindings.mjs --from saved-version.json   # offline
```

It prints a `wrangler.jsonc`-shaped `vars` / `d1_databases` /
`kv_namespaces` / `r2_buckets` / `queues` / … fragment, the secret names to
re-issue, and an `ok`/`DIFF` line per field against the checked-in config —
so you can copy the remote ids back into `wrangler.jsonc` by hand.

Two related flags:

- **`keep_vars: true`** in `wrangler.jsonc` makes Wrangler *not* delete
  dashboard vars on deploy. Handy while you migrate dashboard-managed config
  into the file; turn it off once the file is authoritative.
- `wrangler d1 create boardgame --update-config --binding DB` writes the new
  `database_id` straight into `wrangler.jsonc` (so does `--update-config` on
  the KV/R2 create commands).

Note the binding **names** must match what the code reads: `DB` for D1
(`server/utils/db.ts`), and `ASSETS` for static assets. Renaming a binding in
the dashboard without updating the config and code breaks the app.

## Notes

- `nodejs_compat` is required: the Pusher signer uses `node:crypto`
  (`createHash('md5')`, `createHmac('sha256')`).
- Assets are served by the `ASSETS` binding; `_headers` from the build sets
  immutable caching for `/_nuxt/*`.
- Nothing here runs on Node — `wrangler deploy` bundles `.output/server/index.mjs`
  into a single Worker with the unenv Node shims.
