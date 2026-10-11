# Unit: fix-scoring (D2, D3, D12)

## GOAL
Fix three scoring defects in shared/core/lockstep/games/citadels/scoring.ts.

## THE DEFECTS
- **D2.** `costSum` sums the catalog cost and ignores `PlacedDistrict.gold` (the
  Artist's beautify marker). A beautified district scores one more.
- **D3.** `uniquePoints` folds only uniques standing in a city. The Secret Vault
  cannot be built, so it lives in hand and scores 0; it must score 3 from hand.
- **D12.** `ivoryTowerScoring` hard-codes "a Haunted Quarter is non-unique", but
  the Haunted Quarter's owner chooses its type; declared `unique` means it is a
  second unique and the Ivory Tower scores 0.

## SCOPE (the files you own)
- shared/core/lockstep/games/citadels/scoring.ts
- shared/core/lockstep/games/citadels/districts/ivory-tower.ts
- shared/core/lockstep/games/citadels/districts/secret-vault.ts
- shared/core/tests/lockstep/citadels/fix-scoring.test.ts (NEW, only if needed)

Do not edit any other file. For D3, the scorer already receives the full state;
read `DistrictScoring`'s signature in districts/effects.ts before you design.

## ACCEPTANCE
The counterexamples D2, D3, D12 in verification-report.test.ts pass, and the whole
citadels suite is green.

## VERIFY
`scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification-report.test.ts --own shared/core/lockstep/games/citadels/scoring.ts --own shared/core/lockstep/games/citadels/districts/ivory-tower.ts --own shared/core/lockstep/games/citadels/districts/secret-vault.ts`
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
status; files written; verify output including the whole suite; commit SHA; how
each scorer reads the state it needs; any counterexample that encodes a wrong rule.

## STANDING ORDERS
1. WORKTREE. All agents share ONE worktree and ONE branch: /home/kevin/.t3/worktrees/boardgame/t3-a32da114 on feat/citadels-game-definitions. There is no per-agent worktree. Never run `git checkout`, `git switch`, `git stash`, `git reset`, `git rebase`, or `git branch`.
2. COMMITS. Commit ONLY through `scripts/citadels-commit.sh "<message>" <path> [<path>...]`, which takes a lock on the shared git index. Never run bare `git commit` or `git add`. Stage only the paths you own; the script refuses a path that does not exist.
3. VERIFY. Your gate is `scripts/citadels-verify.sh <your test file> --own <each source file you edited>`. Pass `--own` for every source file you edit; without it the script derives only from existing test names. Do not run repo-wide `vp test` or `vp check`: both are red at baseline for unrelated reasons.
4. SCOPE. Write only the files named in your brief. Never edit a sibling's file, and never edit a shared file (state.ts, actions.ts, windows.ts, helpers.ts, setup.ts, scoring.ts, index.ts, characters.ts, districts.ts, characters/index.ts, districts/effects.ts). If you need a shared-file change, report it and stop; the coordinator serializes it.
... 8 more; narrow with state/track filters or limit
