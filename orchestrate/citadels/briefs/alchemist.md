# Unit: character alchemist

## GOAL
Implement the Alchemist character (rank 6) and prove each of its rule clauses with a test.

## READ FIRST (with the read tool, in full; do not grep for fragments)
- docs/design/citadels-catalog.md — the authoritative card data. Never invent a name, rank, cost, or count.
- docs/design/citadels-full-game.md — the rules of record.
- shared/core/lockstep/games/citadels/state.ts, actions.ts, helpers.ts, windows.ts — the contract you implement against.
- shared/core/lockstep/games/citadels/characters/index.ts or districts/effects.ts — your registry seam (read only; never edit).
- shared/core/tests/lockstep/citadels/driver.ts — the test driver your test builds on.
- shared/core/tests/lockstep/citadels/scaffold.test.ts — a worked example of the test style.
- The official rulebook text for your ability is quoted below. It is the spec.

## SCOPE (the files you own)
- shared/core/lockstep/games/citadels/characters/alchemist.ts
- shared/core/tests/lockstep/citadels/characters/alchemist.test.ts (NEW)

Your file already exists as a stub exporting alchemist (a CharacterEffect) and
alchemistResolve (a WindowResolver). Fill both in. CHARACTER_EFFECTS and
CHARACTER_RESOLVERS in characters/index.ts already point at them; do not edit that
registry. No window: refund at end of turn.

## THE ABILITY (official rulebook text; the spec)
At the end of your turn, take back all the gold you paid to build districts this turn, but not gold paid for other reasons such as the Smithy or the Tax Collector. You can only build what you could afford at the time.

## ACCEPTANCE (one test per clause, in alchemist.test.ts)
- one test per clause above; name each after the clause it proves.
- at least one test that would FAIL if the ability were a no-op.

## VERIFY
scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/characters/alchemist.test.ts

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
