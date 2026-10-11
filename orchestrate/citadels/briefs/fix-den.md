# Unit: fix-den (D11)

## GOAL
Let the Thieves' Den be paid partly in gold and partly in cards, at 1 card = 1 gold.

## THE DEFECT
**D11.** `thievesDenBuild` only offers card payment when gold is entirely
insufficient. With 2 gold and 3 spare cards on a cost-4 Den, the build is refused;
the rule allows any split.

## SCOPE (the files you own)
- shared/core/lockstep/games/citadels/districts/thieves-den.ts
- shared/core/tests/lockstep/citadels/fix-den.test.ts (NEW, only if needed)

Read districts.ts (`BuildTerms`) and helpers.ts `tryBuild` to see how
`payCards` is consumed; do not edit either. Do not edit any other file.

## ACCEPTANCE
The counterexample D11 in verification-report.test.ts passes, plus a test for a
fully-card payment and a fully-gold payment. The whole citadels suite is green.

## VERIFY
`scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification-report.test.ts --own shared/core/lockstep/games/citadels/districts/thieves-den.ts`
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
exact BuildTerms shape you return for a mixed payment.

## STANDING ORDERS
1. WORKTREE. All agents share ONE worktree and ONE branch: /home/kevin/.t3/worktrees/boardgame/t3-a32da114 on feat/citadels-game-definitions. There is no per-agent worktree. Never run `git checkout`, `git switch`, `git stash`, `git reset`, `git rebase`, or `git branch`.
2. COMMITS. Commit ONLY through `scripts/citadels-commit.sh "<message>" <path> [<path>...]`, which takes a lock on the shared git index. Never run bare `git commit` or `git add`. Stage only the paths you own; the script refuses a path that does not exist.
3. VERIFY. Your gate is `scripts/citadels-verify.sh <your test file> --own <each source file you edited>`. Pass `--own` for every source file you edit; without it the script derives only from existing test names. Do not run repo-wide `vp test` or `vp check`: both are red at baseline for unrelated reasons.
4. SCOPE. Write only the files named in your brief. Never edit a sibling's file, and never edit a shared file (state.ts, actions.ts, windows.ts, helpers.ts, setup.ts, scoring.ts, index.ts, characters.ts, districts.ts, characters/index.ts, districts/effects.ts). If you need a shared-file change, report it and stop; the coordinator serializes it.
... 8 more; narrow with state/track filters or limit
