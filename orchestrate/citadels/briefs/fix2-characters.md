# Unit: fix2-characters (V2-5, V2-6, V2-9)

## GOAL
Fix three remaining fidelity defects: two declared-type income counters, the
Diplomat's Great Wall toll, and the Museum's decline.

## THE DEFECTS (read each counterexample in verification2.test.ts)
- **V2-5.** `trader.ts` and `emperor.ts` still read `specOfDistrict(id).type`
  directly and ignore `PlacedDistrict.declaredType`. Use `typeOfPlaced` from
  districts.ts, as the eight counters fixed in e887390 already do. A Trader with a
  School of Magic declared trade gains 1; an Emperor with one declared noble gains 1.
- **V2-6.** `diplomat.ts` uses `exchangeCost(taken.id, given.id)` alone and never
  consults `greatWallExchangeToll` (districts/great-wall.ts), so it pays 4 not 5 to
  exchange a district out of a Great Wall city.
- **V2-9.** `museumPlace` (districts/museum.ts) treats any non-null report as a
  placement (`action.t === "keep" ? action.index : 0`), so a `pass` tucks the
  hand's first card. Declining must place nothing.

## SCOPE (the files you own)
- shared/core/lockstep/games/citadels/characters/trader.ts
- shared/core/lockstep/games/citadels/characters/emperor.ts
- shared/core/lockstep/games/citadels/characters/diplomat.ts
- shared/core/lockstep/games/citadels/districts/museum.ts
- shared/core/tests/lockstep/citadels/fix2-characters.test.ts (NEW, only if needed)

A sibling owns windows.ts, helpers.ts, blackmailer.ts, alchemist.ts, armory.ts,
thieves-den.ts; do not touch those. Read great-wall.ts and districts.ts but do not
edit them.

## ACCEPTANCE
The counterexamples V2-5 (both cases), V2-6, V2-9 pass. The whole citadels suite
is green.

## VERIFY
`scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification2.test.ts --own shared/core/lockstep/games/citadels/characters/trader.ts --own shared/core/lockstep/games/citadels/characters/emperor.ts --own shared/core/lockstep/games/citadels/characters/diplomat.ts --own shared/core/lockstep/games/citadels/districts/museum.ts`
Then `vp test shared/core/tests/lockstep/citadels/` and report both.

## HOW TO WORK
The second verifier wrote executable counterexamples at
shared/core/tests/lockstep/citadels/verification2.test.ts. Your fixes are done when
YOUR assigned counterexamples in that file pass and the whole citadels suite is
green. Read each counterexample first; it is the spec. Fix the source, not the test.
If a counterexample encodes a wrong rule, report it and stop.

Do NOT edit verification2.test.ts or verification-report.test.ts. Do NOT edit a
file outside your SCOPE. Commit through scripts/citadels-commit.sh.

## REPORT
status; files written; verify output including the whole suite; commit SHA; the
exact change per defect.

## STANDING ORDERS
1. WORKTREE. All agents share ONE worktree and ONE branch: /home/kevin/.t3/worktrees/boardgame/t3-a32da114 on feat/citadels-game-definitions. There is no per-agent worktree. Never run `git checkout`, `git switch`, `git stash`, `git reset`, `git rebase`, or `git branch`.
2. COMMITS. Commit ONLY through `scripts/citadels-commit.sh "<message>" <path> [<path>...]`, which takes a lock on the shared git index. Never run bare `git commit` or `git add`. Stage only the paths you own; the script refuses a path that does not exist.
3. VERIFY. Your gate is `scripts/citadels-verify.sh <your test file> --own <each source file you edited>`. Pass `--own` for every source file you edit; without it the script derives only from existing test names. Do not run repo-wide `vp test` or `vp check`: both are red at baseline for unrelated reasons.
4. SCOPE. Write only the files named in your brief. Never edit a sibling's file, and never edit a shared file (state.ts, actions.ts, windows.ts, helpers.ts, setup.ts, scoring.ts, index.ts, characters.ts, districts.ts, characters/index.ts, districts/effects.ts). If you need a shared-file change, report it and stop; the coordinator serializes it.
... 8 more; narrow with state/track filters or limit
