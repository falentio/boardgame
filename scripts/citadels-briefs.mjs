#!/usr/bin/env node
// Generate citadels unit briefs from one data table. A brief is a product; 30
// hand-written ones drift. This script is the single source for their shape.
//
// Usage: node scripts/citadels-briefs.mjs <outDir>

import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const outDir = process.argv[2] ?? "orchestrate/citadels/briefs";
const standing = readFileSync("orchestrate/citadels/preferences.md", "utf8").trim();

const readFirst = [
  "## READ FIRST (with the read tool, in full; do not grep for fragments)",
  "- docs/design/citadels-catalog.md — the authoritative card data. Never invent a name, rank, cost, or count.",
  "- docs/design/citadels-full-game.md — the rules of record.",
  "- shared/core/lockstep/games/citadels/state.ts, actions.ts, helpers.ts, windows.ts — the contract you implement against.",
  "- shared/core/lockstep/games/citadels/characters/index.ts or districts/effects.ts — your registry seam (read only; never edit).",
  "- shared/core/tests/lockstep/citadels/driver.ts — the test driver your test builds on.",
  "- shared/core/tests/lockstep/citadels/scaffold.test.ts — a worked example of the test style.",
  "- The official rulebook text for your ability is quoted below. It is the spec.",
  "",
].join("\n");

const footer = [
  "## FORBIDDEN",
  "Standing orders apply. Plus: never edit a shared file (state.ts, actions.ts,",
  "windows.ts, helpers.ts, setup.ts, scoring.ts, index.ts, characters.ts,",
  "districts.ts, characters/index.ts, districts/effects.ts). If your ability needs a",
  "shared-file change, report the exact change and stop; the coordinator serializes it.",
  "Never implement another character's or district's file.",
  "",
  "## REPORT",
  "status; files written; the verify command and its raw output; the commit SHA; each",
  "distinct rule clause you tested and the test name that covers it; any shared-file",
  "change you need; any rule in the rulebook text you could not represent.",
  "",
  "## STANDING ORDERS",
  standing,
  "",
].join("\n");

const charBrief = (u) => [
  "# Unit: character " + u.id,
  "",
  "## GOAL",
  "Implement the " + u.name + " character (rank " + u.rank + ") and prove each of its rule clauses with a test.",
  "",
  readFirst,
  "## SCOPE (the files you own)",
  "- shared/core/lockstep/games/citadels/characters/" + u.file + ".ts",
  "- shared/core/tests/lockstep/citadels/characters/" + u.file + ".test.ts (NEW)",
  "",
  "Your file already exists as a stub exporting " + u.camel + " (a CharacterEffect) and",
  u.camel + "Resolve (a WindowResolver). Fill both in. CHARACTER_EFFECTS and",
  "CHARACTER_RESOLVERS in characters/index.ts already point at them; do not edit that",
  "registry. " + u.windows,
  "",
  "## THE ABILITY (official rulebook text; the spec)",
  u.rule,
  "",
  "## ACCEPTANCE (one test per clause, in " + u.file + ".test.ts)",
  u.tests,
  "",
  "## VERIFY",
  "scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/characters/" + u.file + ".test.ts",
  "",
  footer,
].join("\n");

const distBrief = (u) => [
  "# Unit: district " + u.id,
  "",
  "## GOAL",
  "Implement the " + u.name + " unique district and prove its effect with a test.",
  "",
  readFirst,
  "## SCOPE (the files you own)",
  "- shared/core/lockstep/games/citadels/districts/" + u.file + ".ts",
  "- shared/core/tests/lockstep/citadels/districts/" + u.file + ".test.ts (NEW)",
  "",
  "Your file exists as a stub exporting " + u.camel + " (a DistrictEffect) and",
  u.camel + "Scoring (a DistrictScoring). Fill both in. To have the engine call your",
  "effect, set your own id's entry in UNIQUE_TRIGGERS to the hook you declare — that is",
  "the one shared table you may edit, and only your own id's row. " + u.hook,
  "",
  "## THE EFFECT (official rulebook text; the spec)",
  u.rule,
  "",
  "## ACCEPTANCE",
  u.tests,
  "",
  "## VERIFY",
  "scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/districts/" + u.file + ".test.ts",
  "",
  footer,
].join("\n");

mkdirSync(outDir, { recursive: true });
const chars = JSON.parse(readFileSync("orchestrate/citadels/characters.json", "utf8"));
const dists = JSON.parse(readFileSync("orchestrate/citadels/districts.json", "utf8"));
let n = 0;
for (const u of chars) { writeFileSync(join(outDir, u.id + ".md"), charBrief(u)); n += 1; }
for (const u of dists) { writeFileSync(join(outDir, u.id + ".md"), distBrief(u)); n += 1; }
console.log("wrote " + n + " briefs to " + outDir);
