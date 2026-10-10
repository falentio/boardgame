# Unit: chars-rank5

## GOAL
Implement the 3 characters below, each in its own file,
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
# Unit: character bishop

## GOAL
Implement the Bishop character (rank 5) and prove each of its rule clauses with a test.

## READ FIRST (with the read tool, in full; do not grep for fragments)
- docs/design/citadels-catalog.md — the authoritative card data. Never invent a name, rank, cost, or count.
- docs/design/citadels-full-game.md — the rules of record.
- shared/core/lockstep/games/citadels/state.ts, actions.ts, helpers.ts, windows.ts — the contract you implement against.
- shared/core/lockstep/games/citadels/characters/index.ts or districts/effects.ts — your registry seam (read only; never edit).
- shared/core/tests/lockstep/citadels/driver.ts — the test driver your test builds on.
- shared/core/tests/lockstep/citadels/scaffold.test.ts — a worked example of the test style.
- The official rulebook text for your ability is quoted below. It is the spec.

## SCOPE (the files you own)
- shared/core/lockstep/games/citadels/characters/bishop.ts
- shared/core/tests/lockstep/citadels/characters/bishop.test.ts (NEW)

Your file already exists as a stub exporting bishop (a CharacterEffect) and
bishopResolve (a WindowResolver). Fill both in. CHARACTER_EFFECTS and
CHARACTER_RESOLVERS in characters/index.ts already point at them; do not edit that
registry. No window: the passive rank-8 protection is a state flag.

## THE ABILITY (official rulebook text; the spec)
Gain 1 gold per religious district in your city. During this round the rank 8 character cannot use its ability on your districts. If killed, rank 8 may target you; if bewitched, rank 8 cannot target the Witch's districts but can target the Bishop's.

## ACCEPTANCE (one test per clause, in bishop.test.ts)
- one test per clause above; name each after the clause it proves.
- at least one test that would FAIL if the ability were a no-op.

## VERIFY
scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/characters/bishop.test.ts

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

# Unit: character abbot

## GOAL
Implement the Abbot character (rank 5) and prove each of its rule clauses with a test.

## READ FIRST (with the read tool, in full; do not grep for fragments)
- docs/design/citadels-catalog.md — the authoritative card data. Never invent a name, rank, cost, or count.
- docs/design/citadels-full-game.md — the rules of record.
- shared/core/lockstep/games/citadels/state.ts, actions.ts, helpers.ts, windows.ts — the contract you implement against.
- shared/core/lockstep/games/citadels/characters/index.ts or districts/effects.ts — your registry seam (read only; never edit).
- shared/core/tests/lockstep/citadels/driver.ts — the test driver your test builds on.
- shared/core/tests/lockstep/citadels/scaffold.test.ts — a worked example of the test style.
- The official rulebook text for your ability is quoted below. It is the spec.

## SCOPE (the files you own)
- shared/core/lockstep/games/citadels/characters/abbot.ts
- shared/core/tests/lockstep/citadels/characters/abbot.test.ts (NEW)

Your file already exists as a stub exporting abbot (a CharacterEffect) and
abbotResolve (a WindowResolver). Fill both in. CHARACTER_EFFECTS and
CHARACTER_RESOLVERS in characters/index.ts already point at them; do not edit that
registry. You open the `abbot-split` window.

## THE ABILITY (official rulebook text; the spec)
Gain either 1 gold or 1 card per religious district in your city, in any combination you declare before taking. If at any point during your turn you are not the richest player, the richest player must give you 1 gold; on a tie you choose which tied player pays, and if you are among the tied you receive nothing.

## ACCEPTANCE (one test per clause, in abbot.test.ts)
- one test per clause above; name each after the clause it proves.
- at least one test that would FAIL if the ability were a no-op.

## VERIFY
scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/characters/abbot.test.ts

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

# Unit: character cardinal

## GOAL
Implement the Cardinal character (rank 5) and prove each of its rule clauses with a test.

## READ FIRST (with the read tool, in full; do not grep for fragments)
- docs/design/citadels-catalog.md — the authoritative card data. Never invent a name, rank, cost, or count.
- docs/design/citadels-full-game.md — the rules of record.
- shared/core/lockstep/games/citadels/state.ts, actions.ts, helpers.ts, windows.ts — the contract you implement against.
- shared/core/lockstep/games/citadels/characters/index.ts or districts/effects.ts — your registry seam (read only; never edit).
- shared/core/tests/lockstep/citadels/driver.ts — the test driver your test builds on.
- shared/core/tests/lockstep/citadels/scaffold.test.ts — a worked example of the test style.
- The official rulebook text for your ability is quoted below. It is the spec.

## SCOPE (the files you own)
- shared/core/lockstep/games/citadels/characters/cardinal.ts
- shared/core/tests/lockstep/citadels/characters/cardinal.test.ts (NEW)

Your file already exists as a stub exporting cardinal (a CharacterEffect) and
cardinalResolve (a WindowResolver). Fill both in. CHARACTER_EFFECTS and
CHARACTER_RESOLVERS in characters/index.ts already point at them; do not edit that
registry. You open the `cardinal-gold` window.

## THE ABILITY (official rulebook text; the spec)
Gain 1 CARD per religious district in your city. When you build a district and lack the gold, you may take the shortfall from one player, giving that player one card from your hand per gold taken. The player cannot refuse and you cannot take more than needed.

## ACCEPTANCE (one test per clause, in cardinal.test.ts)
- one test per clause above; name each after the clause it proves.
- at least one test that would FAIL if the ability were a no-op.

## VERIFY
scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/characters/cardinal.test.ts

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
