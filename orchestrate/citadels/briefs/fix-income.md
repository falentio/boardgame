# Unit: fix-income (D9 across eight characters)

## GOAL
Make every income counter honour `PlacedDistrict.declaredType`, so a district that
declares a type (the School of Magic, a Haunted Quarter) counts for that type.

## THE DEFECT
**D9.** The income counters read `specOfDistrict(id).type` directly, ignoring
`declaredType`. Use `typeOfPlaced(district)` from districts.ts instead. The
affected files each compute a per-type count:
- king.ts (noble), bishop.ts (religious), merchant.ts (trade), diplomat.ts
  (military), marshal.ts (military), patrician.ts (noble), cardinal.ts (religious),
  abbot.ts (religious).

## SCOPE (the files you own)
- shared/core/lockstep/games/citadels/characters/king.ts
- shared/core/lockstep/games/citadels/characters/bishop.ts
- shared/core/lockstep/games/citadels/characters/merchant.ts
- shared/core/lockstep/games/citadels/characters/diplomat.ts
- shared/core/lockstep/games/citadels/characters/marshal.ts
- shared/core/lockstep/games/citadels/characters/patrician.ts
- shared/core/lockstep/games/citadels/characters/cardinal.ts
- shared/core/lockstep/games/citadels/characters/abbot.ts
- shared/core/tests/lockstep/citadels/fix-income.test.ts (NEW, only if needed)

Do not edit warlord.ts (a sibling owns it), scoring.ts, or any shared file. Read
districts.ts for `typeOfPlaced`. Keep each character's other clauses unchanged.

## ACCEPTANCE
A test per file proving a declared-type district counts for that character's
income (at minimum, the King with a School of Magic declared noble, which the
counterexample D9 covers). The whole citadels suite is green.

## VERIFY
`scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification-report.test.ts --own shared/core/lockstep/games/citadels/characters/king.ts --own shared/core/lockstep/games/citadels/characters/bishop.ts --own shared/core/lockstep/games/citadels/characters/merchant.ts --own shared/core/lockstep/games/citadels/characters/diplomat.ts --own shared/core/lockstep/games/citadels/characters/marshal.ts --own shared/core/lockstep/games/citadels/characters/patrician.ts --own shared/core/lockstep/games/citadels/characters/cardinal.ts --own shared/core/lockstep/games/citadels/characters/abbot.ts`
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
status; files written; verify output including the whole suite; commit SHA; which
of the eight had a declared-type bug and which were already correct.

## STANDING ORDERS
1. WORKTREE. All agents share ONE worktree and ONE branch: /home/kevin/.t3/worktrees/boardgame/t3-a32da114 on feat/citadels-game-definitions. There is no per-agent worktree. Never run `git checkout`, `git switch`, `git stash`, `git reset`, `git rebase`, or `git branch`.
2. COMMITS. Commit ONLY through `scripts/citadels-commit.sh "<message>" <path> [<path>...]`, which takes a lock on the shared git index. Never run bare `git commit` or `git add`. Stage only the paths you own; the script refuses a path that does not exist.
3. VERIFY. Your gate is `scripts/citadels-verify.sh <your test file> --own <each source file you edited>`. Pass `--own` for every source file you edit; without it the script derives only from existing test names. Do not run repo-wide `vp test` or `vp check`: both are red at baseline for unrelated reasons.
4. SCOPE. Write only the files named in your brief. Never edit a sibling's file, and never edit a shared file (state.ts, actions.ts, windows.ts, helpers.ts, setup.ts, scoring.ts, index.ts, characters.ts, districts.ts, characters/index.ts, districts/effects.ts). If you need a shared-file change, report it and stop; the coordinator serializes it.
... 8 more; narrow with state/track filters or limit
