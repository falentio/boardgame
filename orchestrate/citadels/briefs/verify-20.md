# Unit: verify-20 (TWENTIETH adversarial pass, head 8c62749)

## GOAL
Re-verify the citadels game definition at the head the D19 fix lands. Passes 1-19 each
returned FAIL with a defect family. Your job has TWO halves:
1. Find what is STILL wrong, adversarially, as every prior pass did.
2. **Assess completeness of the Witch resume mechanism.** D16-D19 were all the resume;
   three aspects have now been fixed with teeth (identity `state.resume`, arming
   `armCharacterTurn`, resolution: no relocation on a resume). Decide whether the resume
   is now COMPLETELY specified, or whether a seventh family remains. State your verdict
   explicitly: SEAM CLOSED or SEAM OPEN (and name the under-specified rule).

## HEAD
`8c62749` on `feat/citadels-game-definitions`, worktree
`/home/kevin/.t3/worktrees/boardgame/t3-a32da114`. Confirm the full citadels suite is
green before you start (it should be 91 files / 749 tests). Do not trust the green suite.

## CONTEXT: what the D19 fix changed
verify-19 proved D19-1/D19-2: the D18 fix armed the resume with the plain GATHER shape
`[RESOLVE, turn, END_TURN, ...]`; `resolveTurn` visited that leading turn window with
`resumedWitch` true and took the `alreadyGathered` BUILD branch, so the resume built
BEFORE the bewitched ability (the reverse of gather -> abilities -> build). The fix:
`relocateEffectBelowThreat` takes a `resumed` flag and returns early when set;
`windows.ts` passes `state.resume != null`. A resumed turn has no gather, so its ability
windows stay above the resume turn window, giving abilities -> build. Read the ACTUAL
diff at the head, not this summary.

## THE RESUME COMPLETENESS AUDIT (the second half of your job)
Enumerate the resume's full lifecycle and check each transition against the rule
(`rules.json` witch: the resume plays the bewitched character's turn with the Witch's
hand, gold, and city):
- **Open**: `witchResolve` sets `state.resume` and arms the turn.
- **Turn window**: resolved as the BUILD (no gather); the ability windows drain above it.
- **Ability**: the bewitched effect runs with the Witch's seat (`seatHolding`/`buildLimit`
  read `state.resume`).
- **Build**: the bewitched character's build limit; the Alchemist's settle refund after
  the build; the Scholar/Architect re-seated windows; the Trader's non-counting builds.
- **Close**: `applyEndTurn` clears `state.resume`; the Museum offer; the onEndTurn
  district hooks fire once.
- **Codec**: a mid-resume snapshot round-trips; no hidden info leaks through `project`.
Also fold the resume for EVERY one of the 27 characters (and both 2-3 player two-character
seats) and compare to that character's own plain-turn end state.

## READ FIRST
- `orchestrate/citadels/verification-19.md` (the last pass) and `-18.md`, `-17.md`.
- `orchestrate/citadels/decisions.tsv` (the D13-D19 rulings and the escalation trigger).
- `orchestrate/citadels/design/resume-seam/GROUNDING-NOTE.md`.
- `docs/design/citadels-catalog.md` and `docs/design/citadels-full-game.md`.
- The whole module and test suite under `shared/core/lockstep/games/citadels/` and
  `shared/core/tests/lockstep/citadels/`.

## WHAT TO DO
1. Re-run every prior pass's counterexamples (verification-report through verification19).
2. The resume completeness audit above.
3. Attack the D19 fix itself: does skipping the relocation on a resume break the D15
   plain-turn order for any character? Does the `resumed` flag key correctly on the
   ACTING seat (two-character seats)?
4. New defects: a double gather, a lost payload, a conservation break, a window that
   re-offers forever, a turn that runs twice, a district hook that fires twice, dead code.
5. Coverage: for each of the 27 characters and 30 districts, name any with no test that
   would FAIL if the engine stopped invoking it. Note the standing gaps (no test compares
   the 27 character `summary` strings to rules.json; preset casts; scoring under two
   claims; terminal/winner under every stack shape; 2-7 seat convergence).

## SCOPE (the files you own)
- `shared/core/tests/lockstep/citadels/verification20.test.ts` (NEW)
- `orchestrate/citadels/verification-20.md` (your report)

Do not edit any source file, any other test file, or the shared registries. If a defect
needs a source fix, report it with the mechanism and stop; the coordinator routes it.

## STANDING ORDERS
Read `orchestrate/citadels/preferences.md` (all 16). One worktree, one branch; never
`git checkout`/`switch`/`stash`/`reset`/`rebase`/`branch`. Commit only through
`scripts/citadels-commit.sh "<message>" <path>...`. Your gate is
`scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification20.test.ts --own shared/core/tests/lockstep/citadels/verification20.test.ts`.
No repo-wide `vp test`/`vp check`.

## METHOD (the teeth audit)
For every guard you cite, prove it reddens when the behaviour is neutered. Copy the
worktree to `/tmp/citadels-v20` (`git archive HEAD | tar -x -C`), patch one source file in
the copy with a replace that ASSERTS the pattern is present, run the guard with `-t`,
record RED/GREEN, restore from the shared worktree by copy. Report any guard that stays
GREEN under a neuter as a finding. NEVER copy a neutered file into the shared worktree.

## REPORT
End with: status, files written, the exact verify command, its raw result, the commit SHA,
and any deviation or shared-file change you need. State explicitly: (a) whether any defect
is in the turn-ordering/resume seam or elsewhere, and (b) your SEAM CLOSED / SEAM OPEN
verdict on the resume mechanism.
