// Usage: node scripts/roles-webp.mjs
import { spawnSync } from "node:child_process";
import { readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROLE_CATALOG, ROLE_IDS } from "../shared/core/lockstep/games/g54/roles.ts";

const ROOT = new URL("..", import.meta.url).pathname;
const SRC_DIR = join(ROOT, "public/roles");
const MEAN_DIFF = 8;
const MAX_DIFF = 64;

const OVERRIDES = new Map([
  ["customofficer", "customs-officer"],
  ["guerilla", "guerrilla"],
  ["politican", "politician"],
]);

const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const run = (bin, args) => {
  const result = spawnSync(bin, args, { cwd: ROOT, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${bin} ${args.join(" ")} exited ${result.status}: ${result.stderr.trim()}`);
  }
  return result.stdout.trim();
};

const number = (bin, args) => {
  const value = Number(run(bin, args));
  if (!Number.isFinite(value)) throw new Error(`${bin} ${args.join(" ")} returned no number`);
  return value;
};

const fail = (msg) => {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
};

const main = () => {
  const byName = new Map(ROLE_CATALOG.map((spec) => [normalize(spec.name), spec.id]));
  const sources = readdirSync(SRC_DIR).filter((file) => file.endsWith(".jpeg"));

  const rows = [];
  for (const file of sources) {
    const stem = file.slice(0, -".jpeg".length);
    const key = normalize(stem);
    const id = OVERRIDES.get(key) ?? byName.get(key);
    if (id === undefined) throw new Error(`no role for ${file} (normalized "${key}")`);

    const src = join(SRC_DIR, file);
    const webp = join(SRC_DIR, `${id}.webp`);
    run("vips", ["webpsave", src, webp, "--Q", "82", "--effort", "6", "--smart-subsample", "--keep", "none"]);

    const sw = number("vipsheader", ["-f", "width", src]);
    const sh = number("vipsheader", ["-f", "height", src]);
    const ww = number("vipsheader", ["-f", "width", webp]);
    const wh = number("vipsheader", ["-f", "height", webp]);
    if (sw !== ww || sh !== wh) throw new Error(`${file}: size ${sw}x${sh} != ${id}.webp ${ww}x${wh}`);

    const diff = join(tmpdir(), `roles-webp-${String(process.pid)}-${id}-diff.v`);
    const absdiff = join(tmpdir(), `roles-webp-${String(process.pid)}-${id}-absdiff.v`);
    try {
      run("vips", ["subtract", src, webp, diff]);
      run("vips", ["abs", diff, absdiff]);
      const maxdiff = number("vips", ["max", absdiff]);
      const meandiff = number("vips", ["avg", absdiff]);
      if (maxdiff > MAX_DIFF) throw new Error(`${file}: maxdiff ${maxdiff} > ${MAX_DIFF}`);
      if (meandiff > MEAN_DIFF) throw new Error(`${file}: meandiff ${meandiff} > ${MEAN_DIFF}`);
      rows.push({ id, w: ww, h: wh, kb: statSync(webp).size / 1024, maxdiff: Math.round(maxdiff) });
    } finally {
      rmSync(diff, { force: true });
      rmSync(absdiff, { force: true });
    }

    rmSync(src, { force: true });
  }

  for (const row of rows) {
    console.log(
      `${row.id.padEnd(18)}${`${row.w}x${row.h}`.padEnd(12)}${`${row.kb.toFixed(1)} KB`.padEnd(10)}maxdiff=${row.maxdiff}`,
    );
  }

  const webps = readdirSync(SRC_DIR).filter((file) => file.endsWith(".webp"));
  if (webps.length !== ROLE_IDS.length) fail(`expected ${ROLE_IDS.length} webp files, found ${webps.length}`);

  const stems = new Set(webps.map((file) => file.slice(0, -".webp".length)));
  for (const id of ROLE_IDS) if (!stems.has(id)) fail(`missing public/roles/${id}.webp`);
  for (const stem of stems) if (!ROLE_IDS.includes(stem)) fail(`unexpected public/roles/${stem}.webp`);

  const leftovers = readdirSync(SRC_DIR).filter((file) => file.endsWith(".jpeg"));
  for (const file of leftovers) fail(`jpeg not converted: public/roles/${file}`);

  if (process.exitCode) return;
  const kb = rows.reduce((sum, row) => sum + row.kb, 0);
  const maxdiff = Math.max(...rows.map((row) => row.maxdiff));
  console.log(`${String(rows.length)} roles converted, ${kb.toFixed(1)} KB total, maxdiff<=${maxdiff}`);
};

try {
  main();
} catch (error) {
  fail(error.message);
}
