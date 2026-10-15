#!/usr/bin/env node
// Compose one unit brief from its member briefs. The unit is the spawn target;
// the members are what a worker actually writes. Keeps a unit brief honest to
// the per-file briefs instead of restating the rules.
//
// Usage: node scripts/citadels-unit-brief.mjs <unitId>
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const units = JSON.parse(readFileSync("orchestrate/citadels/units.json", "utf8"));
const unit = units.find((u) => u.id === process.argv[2]);
if (!unit) { console.error("unknown unit " + process.argv[2]); process.exit(2); }
const dir = "orchestrate/citadels/briefs";
const kind = unit.kind === "character" ? "characters" : "districts";
const parts = unit.members.map((m) => readFileSync(join(dir, m + ".md"), "utf8"));
const head = [
  "# Unit: " + unit.id,
  "",
  "## GOAL",
  "Implement the " + unit.members.length + " " + kind + " below, each in its own file,",
  "each with its own test file. This unit is one worker: you own every file named",
  "across all the member briefs, and nothing else.",
  "",
  "## HOW TO WORK THIS UNIT",
  "- Read the shared contract files ONCE, in full, before the first member.",
  "- Then implement one member at a time: write its file, write its test, run the",
  "  verify command for that test, and only then move to the next member.",
  "- Commit once per member through scripts/citadels-commit.sh, naming that member's",
  "  two paths. A member that is green but uncommitted is a member you did not do.",
  "- If a member needs a shared-file change, report it and skip that member; finish",
  "  the others. Do not stall the whole unit on one blocked member.",
  "",
  "## VERIFY (run per member, and once more over all of them at the end)",
  "scripts/citadels-verify.sh <each member test file>",
  "",
  "---",
  "",
].join("\n");
writeFileSync(join(dir, "unit-" + unit.id + ".md"), head + parts.join("\n\n---\n\n"));
console.log("wrote " + join(dir, "unit-" + unit.id + ".md"));
