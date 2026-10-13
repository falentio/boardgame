# Unit: verify-19 (NINETEENTH adversarial pass, head 511a50a)

## GOAL
Re-verify the citadels game definition at the head fix19-resume-turn-shape lands.
Passes 1-18 each returned FAIL with a defect family; every fix has landed. Your job is
to find what is STILL wrong, including anything the D18 fix (the resume turn-shape
reuse) introduced or papered over.

## HEAD
`511a50a` on `feat/citadels-game-definitions`, worktree
`/home/kevin/.t3/worktrees/boardgame/t3-a32da114`. Confirm the full citadels suite is
green before you start. Do not trust the green suite.

## CONTEXT: what the D18 fix changed (this pass's target)
verify-18 proved D18-1/D18-2: the Witch's resume armed a hard-coded turn template
`[RESOLVE, arm, turn, ...]` instead of the bewitched character's own turn shape. The
Alchemist's turn-open pass (which keys on `ctx.rest[0]` being a turn window) was
defeated, losing its refund (D18-1); the Navigator's effect ran above its turn window,
so no choice window opened (D18-2). The fix extracts `applyCall`'s arming into one
helper both call. Read the ACTUAL diff at the head, not the brief.

## READ FIRST
- `orchestrate/citadels/verification-18.md` (the last pass) and `-17.md`, `-16.md`.
- `orchestrate/citadels/decisions.tsv` (the D13-D18 rulings).
- `docs/design/citadels-catalog.md` and `docs/design/citadels-full-game.md`.
- The whole module and test suite under `shared/core/lockstep/games/citadels/` and
  `shared/core/tests/lockstep/citadels/`.

## WHAT TO DO
1. **Re-run every prior pass's counterexamples** (verification-report through
   verification18). Confirm they still pass and that each fix addresses its defect, not
   its test.
2. **Attack the resume turn shape end to end.** For EVERY bewitched character, fold the
   Witch's held turn and resume, and assert the resume reaches the bewitched character's
   own plain-turn end state (adjusted for the Witch's held-turn +2). Pay special attention
   to characters whose turn shape or effect position differs: the **Navigator** (turn
   window IS the gain choice), the **Alchemist** (turn-open pass + settle resolve after the
   build), the **Scholar**/**Architect** (re-seated build windows), the **Trader**
   (trader-build window).
3. **The shared arming helper.** Confirm `applyCall` and the resume call the SAME helper,
   so a future character whose shape differs cannot diverge again. If the resume still
   hand-builds any part of the shape, say so - that is the seam re-opening.
4. **Attack the seam for a SIXTH family.** D13 (11), D14 (1), D15 (3), D16 (1), D17 (5),
   D18 (2) were all the same seam. If the fix moved the failure rather than closing it,
   say so explicitly and name the under-specified rule. A defect OUTSIDE the seam is
   always worth finding.
5. **New defects.** Anything the fix introduced: a double gather, a lost payload, a
   conservation break, a window that re-offers forever, a turn that runs twice, a district
   hook that fires twice, a dead code path.
6. **Coverage.** For each of the 27 characters and 30 districts, name any that still has
   no test that would FAIL if the engine stopped invoking it. Note the standing gaps: no
   test compares the 27 character `summary` strings to rules.json; the surfaces no pass
   has re-derived (preset casts, scoring under two claims, terminal/winner under every
   stack shape, 2-7 seat convergence).

## SCOPE (the files you own)
- `shared/core/tests/lockstep/citadels/verification19.test.ts` (NEW) - a failing test per
  real defect, plus positive probes for the clauses you did not break
- `orchestrate/citadels/verification-19.md` - your report

Do not edit any source file, any other test file, or the shared registries. If a defect
needs a source fix, report it with the mechanism and stop; the coordinator routes it.

## STANDING ORDERS
Read `orchestrate/citadels/preferences.md` (all 13). One worktree, one branch; never
`git checkout`/`switch`/`stash`/`reset`/`rebase`/`branch`. Commit only through
`scripts/citadels-commit.sh "<message>" <path>...`. Your gate is
`scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification19.test.ts --own shared/core/tests/lockstep/citadels/verification19.test.ts`.
No repo-wide `vp test`/`vp check`.

## METHOD (the teeth audit - every prior pass did this)
For every guard you cite, prove it reddens when the behaviour it protects is neutered.
Copy the worktree to `/tmp/citadels-v19` (`git archive HEAD | tar -x -C`), patch one
source file in the copy with a replace that ASSERTS the pattern is present, run the guard
with `-t`, record RED/GREEN, restore from the shared worktree by copy. Report any guard
that stays GREEN under a neuter as a finding.

## REPORT
End with: status, files written, the exact verify command, its raw result, the commit
SHA, and any deviation or shared-file change you need. State explicitly whether any defect
you found is in the turn-ordering seam or elsewhere.
