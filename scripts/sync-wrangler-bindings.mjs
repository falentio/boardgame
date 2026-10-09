// Reads the bindings of the Worker's currently-deployed version from
// Cloudflare and prints them as a wrangler.jsonc fragment, so a config that has
// drifted from dashboard edits can be brought back in sync.
//
// Wrangler has no "pull the config down" command. The closest primitives are:
//   wrangler versions list --name <worker> --json   -> version ids
//   wrangler versions view <id> --name <worker> --json -> resources.bindings
//   wrangler deployments status --json              -> the live version ids
//   wrangler secret list --json                     -> secret *names* only
// This wraps them into one report plus a drift diff against wrangler.jsonc.
//
// Usage: node scripts/sync-wrangler-bindings.mjs [--name <worker>] [--json] [--from <file>]
//
// --from reads a saved `wrangler versions view <id> --json` payload instead of
// calling Cloudflare. Handy offline, and how the mapping is unit-tested.

import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import {
  stripJsonc,
  wranglerFragmentFromBindings,
  diffAgainstConfig,
} from "./lib/wrangler-bindings.mjs";

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const JSON_ONLY = args.includes("--json");
const FROM = argOf("--from", null);
const ROOT = new URL("..", import.meta.url).pathname;
const CONFIG = new URL("../wrangler.jsonc", import.meta.url).pathname;

const run = (argv) => {
  const r = spawnSync("pnpm", ["exec", "wrangler", ...argv], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (r.status !== 0) {
    throw new Error(
      `wrangler ${argv.join(" ")} failed:\n${r.stdout}\n${r.stderr}`,
    );
  }
  return JSON.parse(r.stdout);
};

const local = existsSync(CONFIG)
  ? JSON.parse(stripJsonc(readFileSync(CONFIG, "utf8")))
  : {};
const name = argOf("--name", local.name);
if (!name) {
  console.error('No worker name. Pass --name or set "name" in wrangler.jsonc.');
  process.exit(1);
}

// --- read the remote side -------------------------------------------------
let latest;
let version;
if (FROM) {
  version = JSON.parse(readFileSync(FROM, "utf8"));
  latest = { id: version.id ?? "(from file)", metadata: version.metadata ?? {} };
} else {
  const versions = run(["versions", "list", "--name", name, "--json"]);
  const list = Array.isArray(versions) ? versions : (versions.versions ?? []);
  if (list.length === 0) {
    console.error(`Worker "${name}" has no versions to inspect.`);
    process.exit(1);
  }
  latest = list
    .slice()
    .sort((a, b) =>
      String(b.metadata?.created_on ?? "").localeCompare(
        String(a.metadata?.created_on ?? ""),
      ),
    )[0];
  version = run(["versions", "view", latest.id, "--name", name, "--json"]);
}

const mapped = wranglerFragmentFromBindings(version.resources?.bindings);

if (JSON_ONLY) {
  console.log(
    JSON.stringify(
      {
        name,
        version: latest.id,
        fragment: mapped.fragment,
        secrets: mapped.secrets,
        other: mapped.other,
        drift: diffAgainstConfig(local, mapped),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

// --- report ---------------------------------------------------------------
console.log(`Worker:  ${name}`);
console.log(`Version: ${latest.id}  (${latest.metadata?.created_on ?? "?"})`);
console.log("");
console.log("Deployed bindings -> wrangler.jsonc fragment:");
console.log(JSON.stringify(mapped.fragment, null, 2));
if (mapped.secrets.length) {
  console.log("");
  console.log("Secrets (values are never readable; re-set with `wrangler secret put`):");
  for (const s of mapped.secrets) console.log(`  - ${s}`);
}
if (mapped.other.length) {
  console.log("");
  console.log("Bindings this script does not map (copy by hand):");
  for (const o of mapped.other) console.log(`  - ${o.type} ${o.name}`);
}

console.log("");
console.log("Drift vs wrangler.jsonc:");
for (const row of diffAgainstConfig(local, mapped)) {
  console.log(`  ${row.equal ? "ok   " : "DIFF "} ${row.label}`);
  if (!row.equal) {
    console.log(`        remote: ${JSON.stringify(row.remote)}`);
    console.log(`        local:  ${JSON.stringify(row.local)}`);
  }
}
console.log("");
console.log(
  "Note: wrangler.jsonc is the source of truth. Any var or binding in the",
);
console.log(
  "dashboard but absent from the config is removed on the next deploy, unless",
);
console.log("keep_vars is true (vars only; secrets are never deleted).");
