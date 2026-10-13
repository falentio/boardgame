# Unit: verify-18 (EIGHTEENTH adversarial pass, head <FIX17_SHA>)

## GOAL
Re-verify the citadels game definition at the head fix17-resume-token lands. Passes
1-17 each returned FAIL with a defect family; every fix has landed. Your job is to find
what is STILL wrong, including anything the D17 seam redesign introduced or papered
over.

## HEAD
`<FIX17_SHA>` on `feat/citadels-game-definitions`, worktree
`/home/kevin/.t3/worktrees/boardgame/t3-a32da114`. Confirm the full citadels suite is
green before you start. Do not trust the green suite.

## CONTEXT: the D17 seam redesign (this pass's target)
verify-17 proved D17-1..5: the Witch's resume identity rode the shared mutable `pending`
slot (recognized by `pending.note === "witch-resume"`), which every bewitched effect
clobbers when it writes its own `pending.note` (Abbot/Emperor/Spy/Blackmailer -> the
ability lands on the real holder, D17-2..5); and effects that re-seat turn windows
(Scholar/Architect `withBuildLimit`) moved their windows above the fix16 arm step, so
the resume gathered a second time (D17-1). The redesign (commit to be named in the fix
report) owns the resume identity in a dedicated non-clobberable state field and
recognizes the resume turn window by position. Read the ACTUAL diff at the head, not
the brief.

## READ FIRST
- `orchestrate/citadels/verification-17.md` (the last pass) and `-16.md`, `-15.md`.
- `orchestrate/citadels/decisions.tsv` (the D13-D17 rulings, the convergence note, the
  arena collapse).
- `orchestrate/citadels/design/resume-seam/GROUNDING-NOTE.md` (the clobber map).
- `docs/design/citadels-catalog.md` and `docs/design/citadels-full-game.md`.
- The whole module and test suite under `shared/core/lockstep/games/citadels/` and
  `shared/core/tests/lockstep/citadels/`.

## WHAT TO DO
1. **Re-run every prior pass's counterexamples** (verification-report through
   verification17). Confirm they still pass and that each fix addresses its defect,
   not its test.
2. **Attack the new resume mechanism end to end.** For EVERY bewitched character (all
   27), fold the Witch's held turn and resume, and assert the resume reaches the
   bewitched character's own plain-turn end state (adjusted for the Witch's held-turn
   +2), with the ability acting on the WITCH's hand/gold/city. Pay attention to the
   characters that clobbered `pending.note` (Abbot, Emperor, Spy, Blackmailer) and the
   ones that re-seat turn windows (Scholar, Architect).
3. **The codec.** The new field/step must round-trip: encode a mid-resume state, decode
   it, and confirm the resume identity survives. Also confirm a mid-resume snapshot does
   not leak the Witch's hidden information through `project`.
4. **Attack the seam for a FIFTH family.** D13 (11), D14 (1), D15 (3), D16 (1), D17 (5)
   were all the same seam. If the redesign did not close the seam but only moved the
   failure, say so explicitly and name the under-specified rule. A defect OUTSIDE the
   seam is a different matter and always worth finding.
5. **New defects.** Anything the redesign introduced: a double gather, a lost payload, a
   conservation break, a window that re-offers forever, a turn that runs twice, a
   district hook that fires twice, a dead code path left behind (the old
   `WITCH_RESUME_NOTE` plumbing should be GONE, not shadowed).
6. **Coverage.** For each of the 27 characters and 30 districts, name any that still has
   no test that would FAIL if the engine stopped invoking it. Note the standing gaps: no
   test compares the 27 character `summary` strings to rules.json; the surfaces no pass
   has re-derived (preset casts, scoring under two claims, terminal/winner under every
   stack shape, 2-7 seat convergence).

## SCOPE (the files you own)
- `shared/core/tests/lockstep/citadels/verification18.test.ts` (NEW) - a failing test
  per real defect, plus positive probes for the clauses you did not break
- `orchestrate/citadels/verification-18.md` - your report

Do not edit any source file, any other test file, or the shared registries. If a defect
needs a source fix, report it with the mechanism and stop; the coordinator routes it.

## STANDING ORDERS
Read `orchestrate/citadels/preferences.md` (all 13). One worktree, one branch; never
`git checkout`/`switch`/`stash`/`reset`/`rebase`/`branch`. Commit only through
`scripts/citadels-commit.sh "<message>" <path>...`. Your gate is
`scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification18.test.ts --own shared/core/tests/lockstep/citadels/verification18.test.ts`.
No repo-wide `vp test`/`vp check`.

## METHOD (the teeth audit - every prior pass did this)
For every guard you cite, prove it reddens when the behaviour it protects is neutered.
Copy the worktree to `/tmp/citadels-v18` (`git archive HEAD | tar -x -C`), patch one
source file in the copy with a replace that ASSERTS the pattern is present, run the guard
with `-t`, record RED/GREEN, restore from the shared worktree by copy. Report any guard
that stays GREEN under a neuter as a finding.

## REPORT
End with: status, files written, the exact verify command, its raw result, the commit
SHA, and any deviation or shared-file change you need. State explicitly whether any
defect you found is in the turn-ordering seam or elsewhere.
