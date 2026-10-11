# Unit: fix-warlord (D4, D5, D6, and D9 for the Warlord's income)

## GOAL
Make the Warlord respect the Great Wall, the Keep, and the Bishop's shield, and
count a district's declared type in its military income.

## THE DEFECTS
- **D4.** `warlordResolve` charges `destroyPrice` alone; the Great Wall's toll
  (`greatWallToll` in districts/great-wall.ts) is never added.
- **D5.** The Keep's protection (`keepProtects` in districts/keep.ts) is never
  consulted, so the Warlord destroys the Keep.
- **D6.** The Bishop's shield (`bishopShield` in characters/bishop.ts) is computed
  but never enforced; the rank-8 Warlord freely destroys a district in the
  Bishop's city.
- **D9 (Warlord's share).** `militaryIn` reads `specOfDistrict(id).type` and
  ignores `PlacedDistrict.declaredType`; use `typeOfPlaced` from districts.ts so a
  district that declares military counts.

## SCOPE (the files you own)
- shared/core/lockstep/games/citadels/characters/warlord.ts
- shared/core/tests/lockstep/citadels/fix-warlord.test.ts (NEW, only if needed)

Read great-wall.ts, keep.ts, and bishop.ts but do NOT edit them; their helpers are
already exported. Do not edit any other file.

## ACCEPTANCE
The counterexamples D4, D5, D6 in verification-report.test.ts pass, plus a test
proving the Warlord's income counts a declared-military district. The whole
citadels suite is green.

## VERIFY
`scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification-report.test.ts --own shared/core/lockstep/games/citadels/characters/warlord.ts`
Then `vp test shared/core/tests/lockstep/citadels/` and report both.

## HOW TO WORK
The independent verifier wrote executable counterexamples at
shared/core/tests/lockstep/citadels/verification-report.test.ts. Your fixes are
done when YOUR assigned counterexamples in that file pass, and the whole citadels
suite is green. Read the counterexample first; it is the spec. Fix the source, not
the counterexample. If a counterexample encodes a wrong rule, report it and stop.

Do NOT edit verification-report.test.ts. Do NOT edit a file outside your SCOPE.
Commit through scripts/citadels-commit.sh.

## REPORT
status; files written; verify output including the whole suite; commit SHA; the
exact guard you added for each of the three protections; any counterexample that
encodes a wrong rule.

## STANDING ORDERS
1. WORKTREE. All agents share ONE worktree and ONE branch: /home/kevin/.t3/worktrees/boardgame/t3-a32da114 on feat/citadels-game-definitions. There is no per-agent worktree. Never run `git checkout`, `git switch`, `git stash`, `git reset`, `git rebase`, or `git branch`.
2. COMMITS. Commit ONLY through `scripts/citadels-commit.sh "<message>" <path> [<path>...]`, which takes a lock on the shared git index. Never run bare `git commit` or `git add`. Stage only the paths you own; the script refuses a path that does not exist.
3. VERIFY. Your gate is `scripts/citadels-verify.sh <your test file> --own <each source file you edited>`. Pass `--own` for every source file you edit; without it the script derives only from existing test names. Do not run repo-wide `vp test` or `vp check`: both are red at baseline for unrelated reasons.
4. SCOPE. Write only the files named in your brief. Never edit a sibling's file, and never edit a shared file (state.ts, actions.ts, windows.ts, helpers.ts, setup.ts, scoring.ts, index.ts, characters.ts, districts.ts, characters/index.ts, districts/effects.ts). If you need a shared-file change, report it and stop; the coordinator serializes it.
... 8 more; narrow with state/track filters or limit
