# Unit: dist-scoring

## GOAL
Implement the 10 districts below, each in its own file,
each with its own test file. This unit is one worker: you own every file named
across all the member briefs, and nothing else.

## HOW TO WORK THIS UNIT
- Read the shared contract files ONCE, in full, before the first member.
- Then implement one member at a time: write its file, write its test, run the
  verify command for that test, and only then move to the next member.
- Commit once per member through scripts/citadels-commit.sh, naming that member's
  two paths. A member that is green but uncommitted is a member you did not do.
- If a member needs a shared-file change, report it and skip that member; finish
  the others. Do not stall the whole unit on one blocked member.

## VERIFY (run per member, and once more over all of them at the end)
scripts/citadels-verify.sh <each member test file>

---
# Unit: district basilica

## GOAL
Implement the Basilica unique district and prove its effect with a test.

## READ FIRST (with the read tool, in full; do not grep for fragments)
- docs/design/citadels-catalog.md — the authoritative card data. Never invent a name, rank, cost, or count.
- docs/design/citadels-full-game.md — the rules of record.
- shared/core/lockstep/games/citadels/state.ts, actions.ts, helpers.ts, windows.ts — the contract you implement against.
- shared/core/lockstep/games/citadels/characters/index.ts or districts/effects.ts — your registry seam (read only; never edit).
- shared/core/tests/lockstep/citadels/driver.ts — the test driver your test builds on.
- shared/core/tests/lockstep/citadels/scaffold.test.ts — a worked example of the test style.
- The official rulebook text for your ability is quoted below. It is the spec.

## SCOPE (the files you own)
- shared/core/lockstep/games/citadels/districts/basilica.ts
- shared/core/tests/lockstep/citadels/districts/basilica.test.ts (NEW)

Your file exists as a stub exporting basilica (a DistrictEffect) and
basilicaScoring (a DistrictScoring). Fill both in. To have the engine call your
effect, set your own id's entry in UNIQUE_TRIGGERS to the hook you declare — that is
the one shared table you may edit, and only your own id's row. Scoring only: implement `<id>Scoring`; no hook needed.

## THE EFFECT (official rulebook text; the spec)
At end of game score 1 extra point for each district of odd cost in your city.

## ACCEPTANCE
- one test per clause above.
- for a scoring district, a test asserting the exact extra points on a crafted city.
- at least one test that would FAIL if the effect were a no-op.

## VERIFY
scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/districts/basilica.test.ts

## FORBIDDEN
Standing orders apply. Plus: never edit a shared file (state.ts, actions.ts,
windows.ts, helpers.ts, setup.ts, scoring.ts, index.ts, characters.ts,
districts.ts, characters/index.ts, districts/effects.ts). If your ability needs a
shared-file change, report the exact change and stop; the coordinator serializes it.
Never implement another character's or district's file.

## REPORT
status; files written; the verify command and its raw output; the commit SHA; each
distinct rule clause you tested and the test name that covers it; any shared-file
change you need; any rule in the rulebook text you could not represent.

## STANDING ORDERS
1. WORKTREE. All agents share ONE worktree and ONE branch: /home/kevin/.t3/worktrees/boardgame/t3-a32da114 on feat/citadels-game-definitions. There is no per-agent worktree. Never run `git checkout`, `git switch`, `git stash`, `git reset`, `git rebase`, or `git branch`.
2. COMMITS. Commit ONLY through `scripts/citadels-commit.sh "<message>" <path> [<path>...]`, which takes a lock on the shared git index. Never run bare `git commit` or `git add`. Stage only the paths you own; the script refuses a path that does not exist.
3. VERIFY. Your gate is `scripts/citadels-verify.sh <your test file>`. It runs `vp test` on that file (isolated) plus `tsc -p tsconfig.citadels.json` (whole module, retried). Do not run repo-wide `vp test` or `vp check`: both are red at baseline for unrelated reasons.
4. SCOPE. Write only the files named in your brief. Never edit a sibling's file, and never edit a shared file (state.ts, actions.ts, windows.ts, helpers.ts, setup.ts, scoring.ts, index.ts, characters.ts, districts.ts, characters/index.ts, districts/effects.ts). If you need a shared-file change, report it and stop; the coordinator serializes it.
5. FORBIDDEN. No rebase, no force-push, no amend, no `--no-verify`, no edits to `shared/core/lockstep/games/g54/**`, no edits to the lockstep primitive (`shared/core/lockstep/*.ts`), no new runtime dependencies.
6. PERSONA. Read /home/kevin/.pi/agent/skills/poteto-agent/SKILL.md, then /home/kevin/.pi/agent/skills/poteto-mode/SKILL.md in full, before any work.
7. AUTHORITATIVE DATA. docs/design/citadels-catalog.md is the only source of truth for card names, ranks, costs, types, and counts. Never invent a card name, cost, or rank. If a rule is not in that file, read docs/design/citadels-full-game.md, then the official rulebook text quoted in your brief.
8. TESTS ARE THE PRODUCT. Every behavioral claim needs a test that would fail if the behavior were wrong. A test that only asserts "it does not throw" is not a test. One test per distinct rule clause of your ability.
9. REPORT. End with: status, files written, the exact verify command, its raw result, the commit SHA, and any deviation or shared-file change you need.
10. ONE WRITER PER FILE. Every character and district effect lives in its own file and is pre-registered. You edit only your own file(s).
11. STACKER. The coordinator is the only actor that rebases or retargets. Workers never do.
12. BASELINE IS RED. 5 pre-existing failures in server/modules/rooms/tests/http.test.ts and repo-wide formatting failures predate this branch. Do not try to fix them.


---

# Unit: district capitol

## GOAL
Implement the Capitol unique district and prove its effect with a test.

## READ FIRST (with the read tool, in full; do not grep for fragments)
- docs/design/citadels-catalog.md — the authoritative card data. Never invent a name, rank, cost, or count.
- docs/design/citadels-full-game.md — the rules of record.
- shared/core/lockstep/games/citadels/state.ts, actions.ts, helpers.ts, windows.ts — the contract you implement against.
- shared/core/lockstep/games/citadels/characters/index.ts or districts/effects.ts — your registry seam (read only; never edit).
- shared/core/tests/lockstep/citadels/driver.ts — the test driver your test builds on.
- shared/core/tests/lockstep/citadels/scaffold.test.ts — a worked example of the test style.
- The official rulebook text for your ability is quoted below. It is the spec.

## SCOPE (the files you own)
- shared/core/lockstep/games/citadels/districts/capitol.ts
- shared/core/tests/lockstep/citadels/districts/capitol.test.ts (NEW)

Your file exists as a stub exporting capitol (a DistrictEffect) and
capitolScoring (a DistrictScoring). Fill both in. To have the engine call your
effect, set your own id's entry in UNIQUE_TRIGGERS to the hook you declare — that is
the one shared table you may edit, and only your own id's row. Scoring only: implement `<id>Scoring`; no hook needed.

## THE EFFECT (official rulebook text; the spec)
At end of game, if you have at least three districts of one type, score 3 extra points. This can score only once.

## ACCEPTANCE
- one test per clause above.
- for a scoring district, a test asserting the exact extra points on a crafted city.
- at least one test that would FAIL if the effect were a no-op.

## VERIFY
scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/districts/capitol.test.ts

## FORBIDDEN
Standing orders apply. Plus: never edit a shared file (state.ts, actions.ts,
windows.ts, helpers.ts, setup.ts, scoring.ts, index.ts, characters.ts,
districts.ts, characters/index.ts, districts/effects.ts). If your ability needs a
shared-file change, report the exact change and stop; the coordinator serializes it.
Never implement another character's or district's file.

## REPORT
status; files written; the verify command and its raw output; the commit SHA; each
distinct rule clause you tested and the test name that covers it; any shared-file
change you need; any rule in the rulebook text you could not represent.

## STANDING ORDERS
1. WORKTREE. All agents share ONE worktree and ONE branch: /home/kevin/.t3/worktrees/boardgame/t3-a32da114 on feat/citadels-game-definitions. There is no per-agent worktree. Never run `git checkout`, `git switch`, `git stash`, `git reset`, `git rebase`, or `git branch`.
2. COMMITS. Commit ONLY through `scripts/citadels-commit.sh "<message>" <path> [<path>...]`, which takes a lock on the shared git index. Never run bare `git commit` or `git add`. Stage only the paths you own; the script refuses a path that does not exist.
3. VERIFY. Your gate is `scripts/citadels-verify.sh <your test file>`. It runs `vp test` on that file (isolated) plus `tsc -p tsconfig.citadels.json` (whole module, retried). Do not run repo-wide `vp test` or `vp check`: both are red at baseline for unrelated reasons.
4. SCOPE. Write only the files named in your brief. Never edit a sibling's file, and never edit a shared file (state.ts, actions.ts, windows.ts, helpers.ts, setup.ts, scoring.ts, index.ts, characters.ts, districts.ts, characters/index.ts, districts/effects.ts). If you need a shared-file change, report it and stop; the coordinator serializes it.
5. FORBIDDEN. No rebase, no force-push, no amend, no `--no-verify`, no edits to `shared/core/lockstep/games/g54/**`, no edits to the lockstep primitive (`shared/core/lockstep/*.ts`), no new runtime dependencies.
6. PERSONA. Read /home/kevin/.pi/agent/skills/poteto-agent/SKILL.md, then /home/kevin/.pi/agent/skills/poteto-mode/SKILL.md in full, before any work.
7. AUTHORITATIVE DATA. docs/design/citadels-catalog.md is the only source of truth for card names, ranks, costs, types, and counts. Never invent a card name, cost, or rank. If a rule is not in that file, read docs/design/citadels-full-game.md, then the official rulebook text quoted in your brief.
8. TESTS ARE THE PRODUCT. Every behavioral claim needs a test that would fail if the behavior were wrong. A test that only asserts "it does not throw" is not a test. One test per distinct rule clause of your ability.
9. REPORT. End with: status, files written, the exact verify command, its raw result, the commit SHA, and any deviation or shared-file change you need.
10. ONE WRITER PER FILE. Every character and district effect lives in its own file and is pre-registered. You edit only your own file(s).
11. STACKER. The coordinator is the only actor that rebases or retargets. Workers never do.
12. BASELINE IS RED. 5 pre-existing failures in server/modules/rooms/tests/http.test.ts and repo-wide formatting failures predate this branch. Do not try to fix them.


---

# Unit: district dragon-gate

## GOAL
Implement the Dragon Gate unique district and prove its effect with a test.

## READ FIRST (with the read tool, in full; do not grep for fragments)
- docs/design/citadels-catalog.md — the authoritative card data. Never invent a name, rank, cost, or count.
- docs/design/citadels-full-game.md — the rules of record.
- shared/core/lockstep/games/citadels/state.ts, actions.ts, helpers.ts, windows.ts — the contract you implement against.
- shared/core/lockstep/games/citadels/characters/index.ts or districts/effects.ts — your registry seam (read only; never edit).
- shared/core/tests/lockstep/citadels/driver.ts — the test driver your test builds on.
- shared/core/tests/lockstep/citadels/scaffold.test.ts — a worked example of the test style.
- The official rulebook text for your ability is quoted below. It is the spec.

## SCOPE (the files you own)
- shared/core/lockstep/games/citadels/districts/dragon-gate.ts
- shared/core/tests/lockstep/citadels/districts/dragon-gate.test.ts (NEW)

Your file exists as a stub exporting dragonGate (a DistrictEffect) and
dragonGateScoring (a DistrictScoring). Fill both in. To have the engine call your
effect, set your own id's entry in UNIQUE_TRIGGERS to the hook you declare — that is
the one shared table you may edit, and only your own id's row. Scoring only: implement `<id>Scoring`; no hook needed.

## THE EFFECT (official rulebook text; the spec)
At end of game score 2 extra points.

## ACCEPTANCE
- one test per clause above.
- for a scoring district, a test asserting the exact extra points on a crafted city.
- at least one test that would FAIL if the effect were a no-op.

## VERIFY
scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/districts/dragon-gate.test.ts

## FORBIDDEN
Standing orders apply. Plus: never edit a shared file (state.ts, actions.ts,
windows.ts, helpers.ts, setup.ts, scoring.ts, index.ts, characters.ts,
districts.ts, characters/index.ts, districts/effects.ts). If your ability needs a
shared-file change, report the exact change and stop; the coordinator serializes it.
Never implement another character's or district's file.

## REPORT
status; files written; the verify command and its raw output; the commit SHA; each
distinct rule clause you tested and the test name that covers it; any shared-file
change you need; any rule in the rulebook text you could not represent.

## STANDING ORDERS
1. WORKTREE. All agents share ONE worktree and ONE branch: /home/kevin/.t3/worktrees/boardgame/t3-a32da114 on feat/citadels-game-definitions. There is no per-agent worktree. Never run `git checkout`, `git switch`, `git stash`, `git reset`, `git rebase`, or `git branch`.
2. COMMITS. Commit ONLY through `scripts/citadels-commit.sh "<message>" <path> [<path>...]`, which takes a lock on the shared git index. Never run bare `git commit` or `git add`. Stage only the paths you own; the script refuses a path that does not exist.
3. VERIFY. Your gate is `scripts/citadels-verify.sh <your test file>`. It runs `vp test` on that file (isolated) plus `tsc -p tsconfig.citadels.json` (whole module, retried). Do not run repo-wide `vp test` or `vp check`: both are red at baseline for unrelated reasons.
4. SCOPE. Write only the files named in your brief. Never edit a sibling's file, and never edit a shared file (state.ts, actions.ts, windows.ts, helpers.ts, setup.ts, scoring.ts, index.ts, characters.ts, districts.ts, characters/index.ts, districts/effects.ts). If you need a shared-file change, report it and stop; the coordinator serializes it.
5. FORBIDDEN. No rebase, no force-push, no amend, no `--no-verify`, no edits to `shared/core/lockstep/games/g54/**`, no edits to the lockstep primitive (`shared/core/lockstep/*.ts`), no new runtime dependencies.
6. PERSONA. Read /home/kevin/.pi/agent/skills/poteto-agent/SKILL.md, then /home/kevin/.pi/agent/skills/poteto-mode/SKILL.md in full, before any work.
7. AUTHORITATIVE DATA. docs/design/citadels-catalog.md is the only source of truth for card names, ranks, costs, types, and counts. Never invent a card name, cost, or rank. If a rule is not in that file, read docs/design/citadels-full-game.md, then the official rulebook text quoted in your brief.
8. TESTS ARE THE PRODUCT. Every behavioral claim needs a test that would fail if the behavior were wrong. A test that only asserts "it does not throw" is not a test. One test per distinct rule clause of your ability.
9. REPORT. End with: status, files written, the exact verify command, its raw result, the commit SHA, and any deviation or shared-file change you need.
10. ONE WRITER PER FILE. Every character and district effect lives in its own file and is pre-registered. You edit only your own file(s).
11. STACKER. The coordinator is the only actor that rebases or retargets. Workers never do.
12. BASELINE IS RED. 5 pre-existing failures in server/modules/rooms/tests/http.test.ts and repo-wide formatting failures predate this branch. Do not try to fix them.


---

# Unit: district imperial-treasury

## GOAL
Implement the Imperial Treasury unique district and prove its effect with a test.

## READ FIRST (with the read tool, in full; do not grep for fragments)
- docs/design/citadels-catalog.md — the authoritative card data. Never invent a name, rank, cost, or count.
- docs/design/citadels-full-game.md — the rules of record.
- shared/core/lockstep/games/citadels/state.ts, actions.ts, helpers.ts, windows.ts — the contract you implement against.
- shared/core/lockstep/games/citadels/characters/index.ts or districts/effects.ts — your registry seam (read only; never edit).
- shared/core/tests/lockstep/citadels/driver.ts — the test driver your test builds on.
- shared/core/tests/lockstep/citadels/scaffold.test.ts — a worked example of the test style.
- The official rulebook text for your ability is quoted below. It is the spec.

## SCOPE (the files you own)
- shared/core/lockstep/games/citadels/districts/imperial-treasury.ts
- shared/core/tests/lockstep/citadels/districts/imperial-treasury.test.ts (NEW)

Your file exists as a stub exporting imperialTreasury (a DistrictEffect) and
imperialTreasuryScoring (a DistrictScoring). Fill both in. To have the engine call your
effect, set your own id's entry in UNIQUE_TRIGGERS to the hook you declare — that is
the one shared table you may edit, and only your own id's row. Scoring only: implement `<id>Scoring`; no hook needed.

## THE EFFECT (official rulebook text; the spec)
At end of game score 1 point for each gold in your stash.

## ACCEPTANCE
- one test per clause above.
- for a scoring district, a test asserting the exact extra points on a crafted city.
- at least one test that would FAIL if the effect were a no-op.

## VERIFY
scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/districts/imperial-treasury.test.ts

## FORBIDDEN
Standing orders apply. Plus: never edit a shared file (state.ts, actions.ts,
windows.ts, helpers.ts, setup.ts, scoring.ts, index.ts, characters.ts,
districts.ts, characters/index.ts, districts/effects.ts). If your ability needs a
shared-file change, report the exact change and stop; the coordinator serializes it.
Never implement another character's or district's file.

## REPORT
status; files written; the verify command and its raw output; the commit SHA; each
distinct rule clause you tested and the test name that covers it; any shared-file
change you need; any rule in the rulebook text you could not represent.

## STANDING ORDERS
1. WORKTREE. All agents share ONE worktree and ONE branch: /home/kevin/.t3/worktrees/boardgame/t3-a32da114 on feat/citadels-game-definitions. There is no per-agent worktree. Never run `git checkout`, `git switch`, `git stash`, `git reset`, `git rebase`, or `git branch`.
2. COMMITS. Commit ONLY through `scripts/citadels-commit.sh "<message>" <path> [<path>...]`, which takes a lock on the shared git index. Never run bare `git commit` or `git add`. Stage only the paths you own; the script refuses a path that does not exist.
3. VERIFY. Your gate is `scripts/citadels-verify.sh <your test file>`. It runs `vp test` on that file (isolated) plus `tsc -p tsconfig.citadels.json` (whole module, retried). Do not run repo-wide `vp test` or `vp check`: both are red at baseline for unrelated reasons.
4. SCOPE. Write only the files named in your brief. Never edit a sibling's file, and never edit a shared file (state.ts, actions.ts, windows.ts, helpers.ts, setup.ts, scoring.ts, index.ts, characters.ts, districts.ts, characters/index.ts, districts/effects.ts). If you need a shared-file change, report it and stop; the coordinator serializes it.
5. FORBIDDEN. No rebase, no force-push, no amend, no `--no-verify`, no edits to `shared/core/lockstep/games/g54/**`, no edits to the lockstep primitive (`shared/core/lockstep/*.ts`), no new runtime dependencies.
6. PERSONA. Read /home/kevin/.pi/agent/skills/poteto-agent/SKILL.md, then /home/kevin/.pi/agent/skills/poteto-mode/SKILL.md in full, before any work.
7. AUTHORITATIVE DATA. docs/design/citadels-catalog.md is the only source of truth for card names, ranks, costs, types, and counts. Never invent a card name, cost, or rank. If a rule is not in that file, read docs/design/citadels-full-game.md, then the official rulebook text quoted in your brief.
8. TESTS ARE THE PRODUCT. Every behavioral claim needs a test that would fail if the behavior were wrong. A test that only asserts "it does not throw" is not a test. One test per distinct rule clause of your ability.
9. REPORT. End with: status, files written, the exact verify command, its raw result, the commit SHA, and any deviation or shared-file change you need.
10. ONE WRITER PER FILE. Every character and district effect lives in its own file and is pre-registered. You edit only your own file(s).
11. STACKER. The coordinator is the only actor that rebases or retargets. Workers never do.
12. BASELINE IS RED. 5 pre-existing failures in server/modules/rooms/tests/http.test.ts and repo-wide formatting failures predate this branch. Do not try to fix them.


---

# Unit: district ivory-tower

## GOAL
Implement the Ivory Tower unique district and prove its effect with a test.

## READ FIRST (with the read tool, in full; do not grep for fragments)
- docs/design/citadels-catalog.md — the authoritative card data. Never invent a name, rank, cost, or count.
- docs/design/citadels-full-game.md — the rules of record.
- shared/core/lockstep/games/citadels/state.ts, actions.ts, helpers.ts, windows.ts — the contract you implement against.
- shared/core/lockstep/games/citadels/characters/index.ts or districts/effects.ts — your registry seam (read only; never edit).
- shared/core/tests/lockstep/citadels/driver.ts — the test driver your test builds on.
- shared/core/tests/lockstep/citadels/scaffold.test.ts — a worked example of the test style.
- The official rulebook text for your ability is quoted below. It is the spec.

## SCOPE (the files you own)
- shared/core/lockstep/games/citadels/districts/ivory-tower.ts
- shared/core/tests/lockstep/citadels/districts/ivory-tower.test.ts (NEW)

Your file exists as a stub exporting ivoryTower (a DistrictEffect) and
ivoryTowerScoring (a DistrictScoring). Fill both in. To have the engine call your
effect, set your own id's entry in UNIQUE_TRIGGERS to the hook you declare — that is
the one shared table you may edit, and only your own id's row. Scoring only: implement `<id>Scoring`; no hook needed.

## THE EFFECT (official rulebook text; the spec)
If the Ivory Tower is the only unique district in your city at end of game, score 5 extra points. If the Haunted Quarter is also present and counted as a non-unique type, the Ivory Tower still scores.

## ACCEPTANCE
- one test per clause above.
- for a scoring district, a test asserting the exact extra points on a crafted city.
- at least one test that would FAIL if the effect were a no-op.

## VERIFY
scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/districts/ivory-tower.test.ts

## FORBIDDEN
Standing orders apply. Plus: never edit a shared file (state.ts, actions.ts,
windows.ts, helpers.ts, setup.ts, scoring.ts, index.ts, characters.ts,
districts.ts, characters/index.ts, districts/effects.ts). If your ability needs a
shared-file change, report the exact change and stop; the coordinator serializes it.
Never implement another character's or district's file.

## REPORT
status; files written; the verify command and its raw output; the commit SHA; each
distinct rule clause you tested and the test name that covers it; any shared-file
change you need; any rule in the rulebook text you could not represent.

## STANDING ORDERS
1. WORKTREE. All agents share ONE worktree and ONE branch: /home/kevin/.t3/worktrees/boardgame/t3-a32da114 on feat/citadels-game-definitions. There is no per-agent worktree. Never run `git checkout`, `git switch`, `git stash`, `git reset`, `git rebase`, or `git branch`.
2. COMMITS. Commit ONLY through `scripts/citadels-commit.sh "<message>" <path> [<path>...]`, which takes a lock on the shared git index. Never run bare `git commit` or `git add`. Stage only the paths you own; the script refuses a path that does not exist.
3. VERIFY. Your gate is `scripts/citadels-verify.sh <your test file>`. It runs `vp test` on that file (isolated) plus `tsc -p tsconfig.citadels.json` (whole module, retried). Do not run repo-wide `vp test` or `vp check`: both are red at baseline for unrelated reasons.
4. SCOPE. Write only the files named in your brief. Never edit a sibling's file, and never edit a shared file (state.ts, actions.ts, windows.ts, helpers.ts, setup.ts, scoring.ts, index.ts, characters.ts, districts.ts, characters/index.ts, districts/effects.ts). If you need a shared-file change, report it and stop; the coordinator serializes it.
5. FORBIDDEN. No rebase, no force-push, no amend, no `--no-verify`, no edits to `shared/core/lockstep/games/g54/**`, no edits to the lockstep primitive (`shared/core/lockstep/*.ts`), no new runtime dependencies.
6. PERSONA. Read /home/kevin/.pi/agent/skills/poteto-agent/SKILL.md, then /home/kevin/.pi/agent/skills/poteto-mode/SKILL.md in full, before any work.
7. AUTHORITATIVE DATA. docs/design/citadels-catalog.md is the only source of truth for card names, ranks, costs, types, and counts. Never invent a card name, cost, or rank. If a rule is not in that file, read docs/design/citadels-full-game.md, then the official rulebook text quoted in your brief.
8. TESTS ARE THE PRODUCT. Every behavioral claim needs a test that would fail if the behavior were wrong. A test that only asserts "it does not throw" is not a test. One test per distinct rule clause of your ability.
9. REPORT. End with: status, files written, the exact verify command, its raw result, the commit SHA, and any deviation or shared-file change you need.
10. ONE WRITER PER FILE. Every character and district effect lives in its own file and is pre-registered. You edit only your own file(s).
11. STACKER. The coordinator is the only actor that rebases or retargets. Workers never do.
12. BASELINE IS RED. 5 pre-existing failures in server/modules/rooms/tests/http.test.ts and repo-wide formatting failures predate this branch. Do not try to fix them.


---

# Unit: district map-room

## GOAL
Implement the Map Room unique district and prove its effect with a test.

## READ FIRST (with the read tool, in full; do not grep for fragments)
- docs/design/citadels-catalog.md — the authoritative card data. Never invent a name, rank, cost, or count.
- docs/design/citadels-full-game.md — the rules of record.
- shared/core/lockstep/games/citadels/state.ts, actions.ts, helpers.ts, windows.ts — the contract you implement against.
- shared/core/lockstep/games/citadels/characters/index.ts or districts/effects.ts — your registry seam (read only; never edit).
- shared/core/tests/lockstep/citadels/driver.ts — the test driver your test builds on.
- shared/core/tests/lockstep/citadels/scaffold.test.ts — a worked example of the test style.
- The official rulebook text for your ability is quoted below. It is the spec.

## SCOPE (the files you own)
- shared/core/lockstep/games/citadels/districts/map-room.ts
- shared/core/tests/lockstep/citadels/districts/map-room.test.ts (NEW)

Your file exists as a stub exporting mapRoom (a DistrictEffect) and
mapRoomScoring (a DistrictScoring). Fill both in. To have the engine call your
effect, set your own id's entry in UNIQUE_TRIGGERS to the hook you declare — that is
the one shared table you may edit, and only your own id's row. Scoring only: implement `<id>Scoring`; no hook needed.

## THE EFFECT (official rulebook text; the spec)
At end of game score 1 point for each card in your hand.

## ACCEPTANCE
- one test per clause above.
- for a scoring district, a test asserting the exact extra points on a crafted city.
- at least one test that would FAIL if the effect were a no-op.

## VERIFY
scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/districts/map-room.test.ts

## FORBIDDEN
Standing orders apply. Plus: never edit a shared file (state.ts, actions.ts,
windows.ts, helpers.ts, setup.ts, scoring.ts, index.ts, characters.ts,
districts.ts, characters/index.ts, districts/effects.ts). If your ability needs a
shared-file change, report the exact change and stop; the coordinator serializes it.
Never implement another character's or district's file.

## REPORT
status; files written; the verify command and its raw output; the commit SHA; each
distinct rule clause you tested and the test name that covers it; any shared-file
change you need; any rule in the rulebook text you could not represent.

## STANDING ORDERS
1. WORKTREE. All agents share ONE worktree and ONE branch: /home/kevin/.t3/worktrees/boardgame/t3-a32da114 on feat/citadels-game-definitions. There is no per-agent worktree. Never run `git checkout`, `git switch`, `git stash`, `git reset`, `git rebase`, or `git branch`.
2. COMMITS. Commit ONLY through `scripts/citadels-commit.sh "<message>" <path> [<path>...]`, which takes a lock on the shared git index. Never run bare `git commit` or `git add`. Stage only the paths you own; the script refuses a path that does not exist.
3. VERIFY. Your gate is `scripts/citadels-verify.sh <your test file>`. It runs `vp test` on that file (isolated) plus `tsc -p tsconfig.citadels.json` (whole module, retried). Do not run repo-wide `vp test` or `vp check`: both are red at baseline for unrelated reasons.
4. SCOPE. Write only the files named in your brief. Never edit a sibling's file, and never edit a shared file (state.ts, actions.ts, windows.ts, helpers.ts, setup.ts, scoring.ts, index.ts, characters.ts, districts.ts, characters/index.ts, districts/effects.ts). If you need a shared-file change, report it and stop; the coordinator serializes it.
5. FORBIDDEN. No rebase, no force-push, no amend, no `--no-verify`, no edits to `shared/core/lockstep/games/g54/**`, no edits to the lockstep primitive (`shared/core/lockstep/*.ts`), no new runtime dependencies.
6. PERSONA. Read /home/kevin/.pi/agent/skills/poteto-agent/SKILL.md, then /home/kevin/.pi/agent/skills/poteto-mode/SKILL.md in full, before any work.
7. AUTHORITATIVE DATA. docs/design/citadels-catalog.md is the only source of truth for card names, ranks, costs, types, and counts. Never invent a card name, cost, or rank. If a rule is not in that file, read docs/design/citadels-full-game.md, then the official rulebook text quoted in your brief.
8. TESTS ARE THE PRODUCT. Every behavioral claim needs a test that would fail if the behavior were wrong. A test that only asserts "it does not throw" is not a test. One test per distinct rule clause of your ability.
9. REPORT. End with: status, files written, the exact verify command, its raw result, the commit SHA, and any deviation or shared-file change you need.
10. ONE WRITER PER FILE. Every character and district effect lives in its own file and is pre-registered. You edit only your own file(s).
11. STACKER. The coordinator is the only actor that rebases or retargets. Workers never do.
12. BASELINE IS RED. 5 pre-existing failures in server/modules/rooms/tests/http.test.ts and repo-wide formatting failures predate this branch. Do not try to fix them.


---

# Unit: district statue

## GOAL
Implement the Statue unique district and prove its effect with a test.

## READ FIRST (with the read tool, in full; do not grep for fragments)
- docs/design/citadels-catalog.md — the authoritative card data. Never invent a name, rank, cost, or count.
- docs/design/citadels-full-game.md — the rules of record.
- shared/core/lockstep/games/citadels/state.ts, actions.ts, helpers.ts, windows.ts — the contract you implement against.
- shared/core/lockstep/games/citadels/characters/index.ts or districts/effects.ts — your registry seam (read only; never edit).
- shared/core/tests/lockstep/citadels/driver.ts — the test driver your test builds on.
- shared/core/tests/lockstep/citadels/scaffold.test.ts — a worked example of the test style.
- The official rulebook text for your ability is quoted below. It is the spec.

## SCOPE (the files you own)
- shared/core/lockstep/games/citadels/districts/statue.ts
- shared/core/tests/lockstep/citadels/districts/statue.test.ts (NEW)

Your file exists as a stub exporting statue (a DistrictEffect) and
statueScoring (a DistrictScoring). Fill both in. To have the engine call your
effect, set your own id's entry in UNIQUE_TRIGGERS to the hook you declare — that is
the one shared table you may edit, and only your own id's row. Scoring only: implement `<id>Scoring`; no hook needed.

## THE EFFECT (official rulebook text; the spec)
If you hold the crown at end of game, score 5 extra points.

## ACCEPTANCE
- one test per clause above.
- for a scoring district, a test asserting the exact extra points on a crafted city.
- at least one test that would FAIL if the effect were a no-op.

## VERIFY
scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/districts/statue.test.ts

## FORBIDDEN
Standing orders apply. Plus: never edit a shared file (state.ts, actions.ts,
windows.ts, helpers.ts, setup.ts, scoring.ts, index.ts, characters.ts,
districts.ts, characters/index.ts, districts/effects.ts). If your ability needs a
shared-file change, report the exact change and stop; the coordinator serializes it.
Never implement another character's or district's file.

## REPORT
status; files written; the verify command and its raw output; the commit SHA; each
distinct rule clause you tested and the test name that covers it; any shared-file
change you need; any rule in the rulebook text you could not represent.

## STANDING ORDERS
1. WORKTREE. All agents share ONE worktree and ONE branch: /home/kevin/.t3/worktrees/boardgame/t3-a32da114 on feat/citadels-game-definitions. There is no per-agent worktree. Never run `git checkout`, `git switch`, `git stash`, `git reset`, `git rebase`, or `git branch`.
2. COMMITS. Commit ONLY through `scripts/citadels-commit.sh "<message>" <path> [<path>...]`, which takes a lock on the shared git index. Never run bare `git commit` or `git add`. Stage only the paths you own; the script refuses a path that does not exist.
3. VERIFY. Your gate is `scripts/citadels-verify.sh <your test file>`. It runs `vp test` on that file (isolated) plus `tsc -p tsconfig.citadels.json` (whole module, retried). Do not run repo-wide `vp test` or `vp check`: both are red at baseline for unrelated reasons.
4. SCOPE. Write only the files named in your brief. Never edit a sibling's file, and never edit a shared file (state.ts, actions.ts, windows.ts, helpers.ts, setup.ts, scoring.ts, index.ts, characters.ts, districts.ts, characters/index.ts, districts/effects.ts). If you need a shared-file change, report it and stop; the coordinator serializes it.
5. FORBIDDEN. No rebase, no force-push, no amend, no `--no-verify`, no edits to `shared/core/lockstep/games/g54/**`, no edits to the lockstep primitive (`shared/core/lockstep/*.ts`), no new runtime dependencies.
6. PERSONA. Read /home/kevin/.pi/agent/skills/poteto-agent/SKILL.md, then /home/kevin/.pi/agent/skills/poteto-mode/SKILL.md in full, before any work.
7. AUTHORITATIVE DATA. docs/design/citadels-catalog.md is the only source of truth for card names, ranks, costs, types, and counts. Never invent a card name, cost, or rank. If a rule is not in that file, read docs/design/citadels-full-game.md, then the official rulebook text quoted in your brief.
8. TESTS ARE THE PRODUCT. Every behavioral claim needs a test that would fail if the behavior were wrong. A test that only asserts "it does not throw" is not a test. One test per distinct rule clause of your ability.
9. REPORT. End with: status, files written, the exact verify command, its raw result, the commit SHA, and any deviation or shared-file change you need.
10. ONE WRITER PER FILE. Every character and district effect lives in its own file and is pre-registered. You edit only your own file(s).
11. STACKER. The coordinator is the only actor that rebases or retargets. Workers never do.
12. BASELINE IS RED. 5 pre-existing failures in server/modules/rooms/tests/http.test.ts and repo-wide formatting failures predate this branch. Do not try to fix them.


---

# Unit: district wishing-well

## GOAL
Implement the Wishing Well unique district and prove its effect with a test.

## READ FIRST (with the read tool, in full; do not grep for fragments)
- docs/design/citadels-catalog.md — the authoritative card data. Never invent a name, rank, cost, or count.
- docs/design/citadels-full-game.md — the rules of record.
- shared/core/lockstep/games/citadels/state.ts, actions.ts, helpers.ts, windows.ts — the contract you implement against.
- shared/core/lockstep/games/citadels/characters/index.ts or districts/effects.ts — your registry seam (read only; never edit).
- shared/core/tests/lockstep/citadels/driver.ts — the test driver your test builds on.
- shared/core/tests/lockstep/citadels/scaffold.test.ts — a worked example of the test style.
- The official rulebook text for your ability is quoted below. It is the spec.

## SCOPE (the files you own)
- shared/core/lockstep/games/citadels/districts/wishing-well.ts
- shared/core/tests/lockstep/citadels/districts/wishing-well.test.ts (NEW)

Your file exists as a stub exporting wishingWell (a DistrictEffect) and
wishingWellScoring (a DistrictScoring). Fill both in. To have the engine call your
effect, set your own id's entry in UNIQUE_TRIGGERS to the hook you declare — that is
the one shared table you may edit, and only your own id's row. Scoring only: implement `<id>Scoring`; no hook needed.

## THE EFFECT (official rulebook text; the spec)
At end of game score 1 extra point for each unique district in your city.

## ACCEPTANCE
- one test per clause above.
- for a scoring district, a test asserting the exact extra points on a crafted city.
- at least one test that would FAIL if the effect were a no-op.

## VERIFY
scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/districts/wishing-well.test.ts

## FORBIDDEN
Standing orders apply. Plus: never edit a shared file (state.ts, actions.ts,
windows.ts, helpers.ts, setup.ts, scoring.ts, index.ts, characters.ts,
districts.ts, characters/index.ts, districts/effects.ts). If your ability needs a
shared-file change, report the exact change and stop; the coordinator serializes it.
Never implement another character's or district's file.

## REPORT
status; files written; the verify command and its raw output; the commit SHA; each
distinct rule clause you tested and the test name that covers it; any shared-file
change you need; any rule in the rulebook text you could not represent.

## STANDING ORDERS
1. WORKTREE. All agents share ONE worktree and ONE branch: /home/kevin/.t3/worktrees/boardgame/t3-a32da114 on feat/citadels-game-definitions. There is no per-agent worktree. Never run `git checkout`, `git switch`, `git stash`, `git reset`, `git rebase`, or `git branch`.
2. COMMITS. Commit ONLY through `scripts/citadels-commit.sh "<message>" <path> [<path>...]`, which takes a lock on the shared git index. Never run bare `git commit` or `git add`. Stage only the paths you own; the script refuses a path that does not exist.
3. VERIFY. Your gate is `scripts/citadels-verify.sh <your test file>`. It runs `vp test` on that file (isolated) plus `tsc -p tsconfig.citadels.json` (whole module, retried). Do not run repo-wide `vp test` or `vp check`: both are red at baseline for unrelated reasons.
4. SCOPE. Write only the files named in your brief. Never edit a sibling's file, and never edit a shared file (state.ts, actions.ts, windows.ts, helpers.ts, setup.ts, scoring.ts, index.ts, characters.ts, districts.ts, characters/index.ts, districts/effects.ts). If you need a shared-file change, report it and stop; the coordinator serializes it.
5. FORBIDDEN. No rebase, no force-push, no amend, no `--no-verify`, no edits to `shared/core/lockstep/games/g54/**`, no edits to the lockstep primitive (`shared/core/lockstep/*.ts`), no new runtime dependencies.
6. PERSONA. Read /home/kevin/.pi/agent/skills/poteto-agent/SKILL.md, then /home/kevin/.pi/agent/skills/poteto-mode/SKILL.md in full, before any work.
7. AUTHORITATIVE DATA. docs/design/citadels-catalog.md is the only source of truth for card names, ranks, costs, types, and counts. Never invent a card name, cost, or rank. If a rule is not in that file, read docs/design/citadels-full-game.md, then the official rulebook text quoted in your brief.
8. TESTS ARE THE PRODUCT. Every behavioral claim needs a test that would fail if the behavior were wrong. A test that only asserts "it does not throw" is not a test. One test per distinct rule clause of your ability.
9. REPORT. End with: status, files written, the exact verify command, its raw result, the commit SHA, and any deviation or shared-file change you need.
10. ONE WRITER PER FILE. Every character and district effect lives in its own file and is pre-registered. You edit only your own file(s).
11. STACKER. The coordinator is the only actor that rebases or retargets. Workers never do.
12. BASELINE IS RED. 5 pre-existing failures in server/modules/rooms/tests/http.test.ts and repo-wide formatting failures predate this branch. Do not try to fix them.


---

# Unit: district haunted-quarter

## GOAL
Implement the Haunted Quarter unique district and prove its effect with a test.

## READ FIRST (with the read tool, in full; do not grep for fragments)
- docs/design/citadels-catalog.md — the authoritative card data. Never invent a name, rank, cost, or count.
- docs/design/citadels-full-game.md — the rules of record.
- shared/core/lockstep/games/citadels/state.ts, actions.ts, helpers.ts, windows.ts — the contract you implement against.
- shared/core/lockstep/games/citadels/characters/index.ts or districts/effects.ts — your registry seam (read only; never edit).
- shared/core/tests/lockstep/citadels/driver.ts — the test driver your test builds on.
- shared/core/tests/lockstep/citadels/scaffold.test.ts — a worked example of the test style.
- The official rulebook text for your ability is quoted below. It is the spec.

## SCOPE (the files you own)
- shared/core/lockstep/games/citadels/districts/haunted-quarter.ts
- shared/core/tests/lockstep/citadels/districts/haunted-quarter.test.ts (NEW)

Your file exists as a stub exporting hauntedQuarter (a DistrictEffect) and
hauntedQuarterScoring (a DistrictScoring). Fill both in. To have the engine call your
effect, set your own id's entry in UNIQUE_TRIGGERS to the hook you declare — that is
the one shared table you may edit, and only your own id's row. Scoring only: implement `<id>Scoring`; no hook needed.

## THE EFFECT (official rulebook text; the spec)
At final scoring, count it as a district of any one type you choose. If you choose a type other than unique, it no longer counts as unique for other scoring.

## ACCEPTANCE
- one test per clause above.
- for a scoring district, a test asserting the exact extra points on a crafted city.
- at least one test that would FAIL if the effect were a no-op.

## VERIFY
scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/districts/haunted-quarter.test.ts

## FORBIDDEN
Standing orders apply. Plus: never edit a shared file (state.ts, actions.ts,
windows.ts, helpers.ts, setup.ts, scoring.ts, index.ts, characters.ts,
districts.ts, characters/index.ts, districts/effects.ts). If your ability needs a
shared-file change, report the exact change and stop; the coordinator serializes it.
Never implement another character's or district's file.

## REPORT
status; files written; the verify command and its raw output; the commit SHA; each
distinct rule clause you tested and the test name that covers it; any shared-file
change you need; any rule in the rulebook text you could not represent.

## STANDING ORDERS
1. WORKTREE. All agents share ONE worktree and ONE branch: /home/kevin/.t3/worktrees/boardgame/t3-a32da114 on feat/citadels-game-definitions. There is no per-agent worktree. Never run `git checkout`, `git switch`, `git stash`, `git reset`, `git rebase`, or `git branch`.
2. COMMITS. Commit ONLY through `scripts/citadels-commit.sh "<message>" <path> [<path>...]`, which takes a lock on the shared git index. Never run bare `git commit` or `git add`. Stage only the paths you own; the script refuses a path that does not exist.
3. VERIFY. Your gate is `scripts/citadels-verify.sh <your test file>`. It runs `vp test` on that file (isolated) plus `tsc -p tsconfig.citadels.json` (whole module, retried). Do not run repo-wide `vp test` or `vp check`: both are red at baseline for unrelated reasons.
4. SCOPE. Write only the files named in your brief. Never edit a sibling's file, and never edit a shared file (state.ts, actions.ts, windows.ts, helpers.ts, setup.ts, scoring.ts, index.ts, characters.ts, districts.ts, characters/index.ts, districts/effects.ts). If you need a shared-file change, report it and stop; the coordinator serializes it.
5. FORBIDDEN. No rebase, no force-push, no amend, no `--no-verify`, no edits to `shared/core/lockstep/games/g54/**`, no edits to the lockstep primitive (`shared/core/lockstep/*.ts`), no new runtime dependencies.
6. PERSONA. Read /home/kevin/.pi/agent/skills/poteto-agent/SKILL.md, then /home/kevin/.pi/agent/skills/poteto-mode/SKILL.md in full, before any work.
7. AUTHORITATIVE DATA. docs/design/citadels-catalog.md is the only source of truth for card names, ranks, costs, types, and counts. Never invent a card name, cost, or rank. If a rule is not in that file, read docs/design/citadels-full-game.md, then the official rulebook text quoted in your brief.
8. TESTS ARE THE PRODUCT. Every behavioral claim needs a test that would fail if the behavior were wrong. A test that only asserts "it does not throw" is not a test. One test per distinct rule clause of your ability.
9. REPORT. End with: status, files written, the exact verify command, its raw result, the commit SHA, and any deviation or shared-file change you need.
10. ONE WRITER PER FILE. Every character and district effect lives in its own file and is pre-registered. You edit only your own file(s).
11. STACKER. The coordinator is the only actor that rebases or retargets. Workers never do.
12. BASELINE IS RED. 5 pre-existing failures in server/modules/rooms/tests/http.test.ts and repo-wide formatting failures predate this branch. Do not try to fix them.


---

# Unit: district museum

## GOAL
Implement the Museum unique district and prove its effect with a test.

## READ FIRST (with the read tool, in full; do not grep for fragments)
- docs/design/citadels-catalog.md — the authoritative card data. Never invent a name, rank, cost, or count.
- docs/design/citadels-full-game.md — the rules of record.
- shared/core/lockstep/games/citadels/state.ts, actions.ts, helpers.ts, windows.ts — the contract you implement against.
- shared/core/lockstep/games/citadels/characters/index.ts or districts/effects.ts — your registry seam (read only; never edit).
- shared/core/tests/lockstep/citadels/driver.ts — the test driver your test builds on.
- shared/core/tests/lockstep/citadels/scaffold.test.ts — a worked example of the test style.
- The official rulebook text for your ability is quoted below. It is the spec.

## SCOPE (the files you own)
- shared/core/lockstep/games/citadels/districts/museum.ts
- shared/core/tests/lockstep/citadels/districts/museum.test.ts (NEW)

Your file exists as a stub exporting museum (a DistrictEffect) and
museumScoring (a DistrictScoring). Fill both in. To have the engine call your
effect, set your own id's entry in UNIQUE_TRIGGERS to the hook you declare — that is
the one shared table you may edit, and only your own id's row. Scoring only: implement `<id>Scoring`; no hook needed.

## THE EFFECT (official rulebook text; the spec)
Once per turn, place a card from your hand under the Museum. At end of game score 1 point per card under it. If the Museum is exchanged or seized the cards stay with it; if destroyed the cards are discarded to the bottom of the deck.

## ACCEPTANCE
- one test per clause above.
- for a scoring district, a test asserting the exact extra points on a crafted city.
- at least one test that would FAIL if the effect were a no-op.

## VERIFY
scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/districts/museum.test.ts

## FORBIDDEN
Standing orders apply. Plus: never edit a shared file (state.ts, actions.ts,
windows.ts, helpers.ts, setup.ts, scoring.ts, index.ts, characters.ts,
districts.ts, characters/index.ts, districts/effects.ts). If your ability needs a
shared-file change, report the exact change and stop; the coordinator serializes it.
Never implement another character's or district's file.

## REPORT
status; files written; the verify command and its raw output; the commit SHA; each
distinct rule clause you tested and the test name that covers it; any shared-file
change you need; any rule in the rulebook text you could not represent.

## STANDING ORDERS
1. WORKTREE. All agents share ONE worktree and ONE branch: /home/kevin/.t3/worktrees/boardgame/t3-a32da114 on feat/citadels-game-definitions. There is no per-agent worktree. Never run `git checkout`, `git switch`, `git stash`, `git reset`, `git rebase`, or `git branch`.
2. COMMITS. Commit ONLY through `scripts/citadels-commit.sh "<message>" <path> [<path>...]`, which takes a lock on the shared git index. Never run bare `git commit` or `git add`. Stage only the paths you own; the script refuses a path that does not exist.
3. VERIFY. Your gate is `scripts/citadels-verify.sh <your test file>`. It runs `vp test` on that file (isolated) plus `tsc -p tsconfig.citadels.json` (whole module, retried). Do not run repo-wide `vp test` or `vp check`: both are red at baseline for unrelated reasons.
4. SCOPE. Write only the files named in your brief. Never edit a sibling's file, and never edit a shared file (state.ts, actions.ts, windows.ts, helpers.ts, setup.ts, scoring.ts, index.ts, characters.ts, districts.ts, characters/index.ts, districts/effects.ts). If you need a shared-file change, report it and stop; the coordinator serializes it.
5. FORBIDDEN. No rebase, no force-push, no amend, no `--no-verify`, no edits to `shared/core/lockstep/games/g54/**`, no edits to the lockstep primitive (`shared/core/lockstep/*.ts`), no new runtime dependencies.
6. PERSONA. Read /home/kevin/.pi/agent/skills/poteto-agent/SKILL.md, then /home/kevin/.pi/agent/skills/poteto-mode/SKILL.md in full, before any work.
7. AUTHORITATIVE DATA. docs/design/citadels-catalog.md is the only source of truth for card names, ranks, costs, types, and counts. Never invent a card name, cost, or rank. If a rule is not in that file, read docs/design/citadels-full-game.md, then the official rulebook text quoted in your brief.
8. TESTS ARE THE PRODUCT. Every behavioral claim needs a test that would fail if the behavior were wrong. A test that only asserts "it does not throw" is not a test. One test per distinct rule clause of your ability.
9. REPORT. End with: status, files written, the exact verify command, its raw result, the commit SHA, and any deviation or shared-file change you need.
10. ONE WRITER PER FILE. Every character and district effect lives in its own file and is pre-registered. You edit only your own file(s).
11. STACKER. The coordinator is the only actor that rebases or retargets. Workers never do.
12. BASELINE IS RED. 5 pre-existing failures in server/modules/rooms/tests/http.test.ts and repo-wide formatting failures predate this branch. Do not try to fix them.
