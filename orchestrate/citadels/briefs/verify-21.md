# Unit: verify-21 (CLOSURE pass, head 08500d8)

## GOAL
Close the citadels verification program, or name the concrete predicate-blocking defect
that stops it. This is NOT an open-ended hunt: passes 1-20 each returned FAIL and each
was fixed; the last four families (D17-D20) were all the Witch resume, now shown BOUNDED
(five resume-conditioned branches, all in `resolveTurn`) and guarded by a 24-character
resume-vs-plain sweep. Your job:
1. Confirm the D20 fix (the Cardinal's resume shortfall) and the sweep hold at the head.
2. Check the DONE PREDICATE clause by clause on the real artifact
   (`docs/design/citadels-full-game.md`, 'Definition of done').
3. Give a final verdict: **CLOSED** (no predicate-blocking defect) or **OPEN** (name the
   exact predicate clause a defect blocks, with a failing counterexample).

## HEAD
`08500d8` on `feat/citadels-game-definitions`, worktree
`/home/kevin/.t3/worktrees/boardgame/t3-a32da114`. The suite should be green at 92 files
/ 760 tests. Do not trust the green suite.

## THE DONE PREDICATE (check each on the artifact, not from memory)
1. A full game from genesis reaches terminal (one winner) by folding frames, for 3, 4, 5,
   and 6 seats, and for at least three distinct casts.
2. Every one of the 27 characters has its ability implemented and a named test that
   exercises it.
3. Every district in the catalog has cost/type/(unique) effect implemented, a test per
   unique effect.
4. Scoring is exact (cost sum, +3 all five types, +4 first completed city, +2 each other,
   unique points, tie-breaks).
5. Hidden info redacted; two peers folding the same frames reach identical state.
6. `vp test` green for the module; `tsc -p tsconfig.citadels.json` clean; no unverified
   file.

## THE STANDING GAPS (check these specifically - passes 10-20 flagged them, none fixed)
- No data-driven test compares the 27 character `summary` strings to `rules.json`.
- The six preset casts; scoring under two claims; terminal/winner under every stack
  shape; determinism and convergence at 2-7 seats.
Decide for each: does it block a predicate clause, or is it a non-blocking follow-up?
State which.

## WHAT TO DO
1. Re-run the full suite and every prior pass's counterexamples (verification-report
   through verification20, plus verification20sweep).
2. Check the predicate clause by clause; for each, name the artifact that proves it.
3. Attack the resume one final time: fold the resume for every bewitchable character on
   several boards and confirm it equals the plain turn (the sweep is your baseline).
4. If you find a defect, produce a FAILING counterexample and name the predicate clause it
   blocks. If you find only non-predicate gaps, list them as follow-ups.
5. Give the final verdict.

## SCOPE (the files you own)
- `shared/core/tests/lockstep/citadels/verification21.test.ts` (NEW) - only if you have a
  real counterexample to pin
- `orchestrate/citadels/verification-21.md` - your report

Do not edit any source file, any other test file, or the shared registries. Report a
defect with its mechanism and stop; the coordinator routes it.

## STANDING ORDERS
Read `orchestrate/citadels/preferences.md` (all 16). One worktree, one branch; never
`git checkout`/`switch`/`stash`/`reset`/`rebase`/`branch`. Commit only through
`scripts/citadels-commit.sh "<message>" <path>...`. No repo-wide `vp test`/`vp check`.
Teeth probes in a `/tmp` archive copy ONLY (standing order 14).

## REPORT
End with: the predicate table (clause -> PASS/FAIL -> evidence artifact), the follow-ups
list, and the final verdict CLOSED or OPEN. If OPEN, the exact clause and the failing
counterexample.
