# Unit: verify-17 (SEVENTEENTH adversarial pass, head 1f892a1)

## GOAL
Re-verify the citadels game definition at the head fix16-witch-resume lands. Passes
1-16 each returned FAIL with a defect family; every fix has landed. Your job is to find
what is STILL wrong, including anything the D16-1 fix (the Witch resume) introduced or
papered over.

## HEAD
`1f892a1` on `feat/citadels-game-definitions`, worktree
`/home/kevin/.t3/worktrees/boardgame/t3-a32da114`. Confirm the full citadels suite is
green before you start. Do not trust the green suite.

## CONTEXT: what the D16-1 fix changed (this pass's target)
verify-16 proved D16-1: the D15 plain-turn relocation moved the Witch's resumed ability
window below the resume turn window, carrying the ability's own pending, so `resolveTurn`
no longer read the `WITCH_RESUME_NOTE` marker and the resume gathered a second time
(gold trail 0,2,...,4). The fix (see `orchestrate/citadels/briefs/fix16-witch-resume.md`
and the lead `salvage/fix16-witch-lead.diff`) keeps the resume turn from gathering while
preserving the D15 order. Read the actual diff at the head, not the brief.

## THE SEAM IS CONVERGING - WATCH FOR A FOURTH CASE
Every defect since D13 has been in ONE seam: the ordering of a character's ability window
relative to the gather and the build (`relocateEffectBelowThreat` + `resolveTurn`).
D13 (11 defects) moved the ability windows below the threat; D14 (1) moved the build below
the ability; D15 (3) moved the ability below the gather; D16 (1) broke the Witch resume,
whose stack the D15 move reordered. Counts are falling (11, 1, 3, 1). If you find a fourth
defect in this seam, say so explicitly and name the under-specified rule - the coordinator
will consider a design pass rather than another patch. A defect OUTSIDE this seam is a
different matter and is always worth finding.

## READ FIRST
- `orchestrate/citadels/verification-16.md` (the last pass) and `-15.md`, `-14.md`,
  `-13.md` (the ordering contracts).
- `orchestrate/citadels/decisions.tsv` (the D13-D16 rulings and the convergence note).
- `docs/design/citadels-catalog.md` and `docs/design/citadels-full-game.md`.
- The whole module and test suite under `shared/core/lockstep/games/citadels/` and
  `shared/core/tests/lockstep/citadels/`.

## WHAT TO DO
1. **Re-run every prior pass's counterexamples** (verification-report through
   verification16). Confirm they still pass and that each fix addresses its defect rather
   than its test.
2. **Attack the Witch's two turns end to end.** Her held turn (fixed +2, no build) and her
   resume (the bewitched character's turn with her hand/gold/city, no gather). For EVERY
   bewitched character, fold the resume and assert the end state equals the bewitched
   character's own plain turn (adjusted for the Witch's held-turn gather). Check the
   two-character-seat keying and the School of Magic declaration on the resume.
3. **Attack the D15 order still holds** under the D16 fix: a plain turn is gather ->
   abilities -> build; a refused threatened turn is gather -> threat -> abilities -> build;
   a refused turn equals the plain turn for every window-opening character.
4. **The guard gaps.** verify-16 named two: only the Spy has an absolute-gold guard among
   the five multi-pass effects, and `verification14` D14-1 stays green under the D15
   relocation revert. Confirm the fix16 unit closed them (or report them still open).
5. **New defects.** Anything the D16 fix introduced: a double gather, a lost payload, a
   conservation break, a window that re-offers forever, a turn that runs twice, a district
   hook that fires twice.
6. **Coverage.** For each of the 27 characters and 30 districts, name any that still has no
   test that would FAIL if the engine stopped invoking it. Note the standing gaps: no
   test compares the 27 character `summary` strings to rules.json; the surfaces no pass has
   re-derived (preset casts, scoring under two claims, terminal/winner under every stack
   shape, 2-7 seat convergence).

## SCOPE (the files you own)
- `shared/core/tests/lockstep/citadels/verification17.test.ts` (NEW) - a failing test per
  real defect, plus positive probes for the clauses you did not break
- `orchestrate/citadels/verification-17.md` - your report

Do not edit any source file, any other test file, or the shared registries. If a defect
needs a source fix, report it with the mechanism and stop; the coordinator routes it.

## STANDING ORDERS
Read `orchestrate/citadels/preferences.md` (all 13). One worktree, one branch; never
`git checkout`/`switch`/`stash`/`reset`/`rebase`/`branch`. Commit only through
`scripts/citadels-commit.sh "<message>" <path>...`. Your gate is
`scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification17.test.ts --own shared/core/tests/lockstep/citadels/verification17.test.ts`.
No repo-wide `vp test`/`vp check`.

## METHOD (the teeth audit - every prior pass did this)
For every guard you cite, prove it reddens when the behaviour it protects is neutered. Copy
the worktree to `/tmp/citadels-v17` (`git archive HEAD | tar -x -C`), patch one source
file in the copy with a replace that ASSERTS the pattern is present, run the guard with
`-t`, record RED/GREEN, restore from the shared worktree by copy. Report any guard that
stays GREEN under a neuter as a finding.

## REPORT
End with: status, files written, the exact verify command, its raw result, the commit SHA,
and any deviation or shared-file change you need. State explicitly whether any defect you
found is in the turn-ordering seam or elsewhere.
