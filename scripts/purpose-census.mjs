// Which declared window purposes can actually open? A purpose is declared in
// state.ts, given a kind, and given a resolver. A window opens only where code
// builds a step for it: winStep("<purpose>", ...) or a literal purpose: "<purpose>"
// in a window spec. A purpose with neither is unreachable, and its resolver is
// code no game can run.
//
// --allow names the purposes believed unreachable. The check fails when a purpose
// is unreachable and not allowed (a new dead purpose) and when an allowed purpose
// turns out to be constructed (a stale allowance), so the list cannot rot.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ENGINE = "shared/core/lockstep/games/citadels";

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return name.endsWith(".ts") && !name.includes("test") ? [path] : [];
  });

/** Every declared purpose, with the files that construct a window for it. */
export const census = () => {
  const state = readFileSync(join(ENGINE, "state.ts"), "utf8");
  const union = /export type WindowPurpose =([^;]*);/.exec(state)[1];
  const purposes = [...union.matchAll(/"([a-z0-9-]+)"/g)].map((match) => match[1]);
  const sources = walk(ENGINE).map((path) => ({ path, text: readFileSync(path, "utf8") }));
  const constructs = (text, purpose) =>
    text.includes("winStep(\"" + purpose + "\"") ||
    text.includes("purpose: \"" + purpose + "\"") ||
    text.includes("windowKindFor(\"" + purpose + "\")");
  return purposes.map((purpose) => ({
    purpose,
    sites: sources.filter(({ text }) => constructs(text, purpose)).map(({ path }) => relative(process.cwd(), path)),
  }));
};

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  const at = process.argv.indexOf("--allow");
  const allowed = at < 0 ? [] : (process.argv[at + 1] ?? "").split(",").filter((name) => name.length > 0);
  const rows = census();
  const dead = rows.filter((row) => row.sites.length === 0).map((row) => row.purpose);
  for (const row of rows) {
    console.log((row.sites.length === 0 ? "UNREACHABLE " : "opens       ") + row.purpose.padEnd(22) + (row.sites[0] ?? "no construction site in the engine"));
  }
  const newlyDead = dead.filter((name) => !allowed.includes(name));
  const stale = allowed.filter((name) => !dead.includes(name));
  console.log("");
  console.log("declared " + String(rows.length) + " · constructed " + String(rows.length - dead.length) + " · unreachable " + (dead.join(", ") || "none"));
  if (newlyDead.length > 0) console.log("FAIL a purpose opens no window and is not allowed: " + newlyDead.join(", "));
  if (stale.length > 0) console.log("FAIL an allowed purpose is constructed now, so drop it from --allow: " + stale.join(", "));
  if (newlyDead.length > 0 || stale.length > 0) process.exitCode = 1;
}
