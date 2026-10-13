# Unit: verify-15 (FIFTEENTH adversarial pass, new head 536f78d)

## GOAL
Re-verify the citadels game definition at the current head. Passes 1-14 each
returned FAIL with a defect family; every fix has landed. Your job is to find
what is STILL wrong, including anything D14-1's fix introduced or papered over.

## HEAD
`536f78d` on `feat/citadels-game-definitions`, worktree
`/home/kevin/.t3/worktrees/boardgame/t3-a32da114`. Full citadels suite is green
at 87 files / 705 tests. Do not trust the green suite.

## CONTEXT: what 536f78d changed (this pass's target)
The D13 relocation moved a threatened seat's ability windows below the
Blackmailer threat, but `resolveTurn`'s threatened branch spliced the
post-threat build window directly under the threat, ABOVE the relocated ability
windows. A threatened seat therefore built on its pre-ability hand and only then
ran its ability. The Scholar lost its build (its ability is the draw-and-keep).

`helpers.ts` now builds the post-threat continuation as
`[threat, ...abilityWindows, rearm, buildWindow, ...close]`:
- the relocated ability windows drain first,
- a `turn-gathered` **arm step** is planted directly beneath the build window so
  it takes no second gather (the same marker an ordinary re-offered build window
  reads),
- then the build window, then the turn's own `END_TURN` (`close`).
- An effect resolve that must run AFTER the build (the Alchemist's settle refund)
  leads the continuation instead, so there the build window stays directly under
  the threat and that resolve keeps its place beneath it.
- The now-unused `POST_THREAT` step is deleted.

`verification14.test.ts` D14-1 now asserts the rule (the draw leads the
post-threat build) and is teeth-proven red on the pre-fix splice.

## READ FIRST
- `orchestrate/citadels/verification-14.md` (the last pass)
- `orchestrate/citadels/verification-13.md` and `-11.md` (the ordering contracts)
- `orchestrate/citadels/decisions.tsv` tail (the D14-1 ruling and rationale)
- `docs/design/citadels-catalog.md` and `docs/design/citadels-full-game.md`
- The whole module and test suite under `shared/core/lockstep/games/citadels/`
  and `shared/core/tests/lockstep/citadels/`

## WHAT TO DO
1. **Re-run every prior pass's counterexamples** (verification-report through
   verification14). Confirm they still pass and that each fix addresses its defect
   rather than its test.
2. **Sweep the threatened-seat ordering end to end.** The rule is
   gather -> threat -> abilities -> build. For EVERY character whose effect opens
   a window, fold a threatened seat with a buildable hand and assert the window
   order and the end state match the plain (unthreatened) turn. The D14 family is
   "the ability the turn or the build depends on no longer precedes it" - check
   each of the 26 characters, not just the Scholar. Pay attention to:
   - the **Trader** (its `trader-build` window and the turn's limit build),
   - the **Alchemist** (its settle refund must run AFTER its build),
   - the **Architect/Scholar** (their hoisted extra build windows),
   - the **Navigator** (its gain rides the resolve step, not a turn window),
   - a **two-character seat** (2-3 player games draft two; the relocation must key
     on the acting character, not the seat's first claim).
3. **Attack the new continuation shape.** Can the `rearm` arm step overwrite a
   pending a later window owns? Can the build window now run after the turn's
   `END_TURN` (`close` is everything from the first `end-turn` on)? Can a fold
   with no `end-turn` in the continuation (`endAt < 0`) strand a step or skip the
   close? Try to construct each.
4. **The probe artifact guard.** The verify-14 report flagged that the earlier
   coordinator probe built a fixed hand index without re-reading the hand after a
   draw, which made cardinal/school and architect/school look divergent. Confirm
   the adaptive form (re-read the hand at every build window) agrees, and encode
   the sweep so a future regression is caught.
5. **New defects.** Anything 536f78d introduced: a double count, a lost payload, a
   conservation break, a window that re-offers forever, a turn that runs twice.
6. **Coverage.** For each of the 27 characters and 30 districts, name any that
   still has no test that would FAIL if the engine stopped invoking it.

## SCOPE (the files you own)
- `shared/core/tests/lockstep/citadels/verification15.test.ts` (NEW) - a failing
  test per real defect, plus positive probes for the clauses you did not break
- `orchestrate/citadels/verification-15.md` - your report

Do not edit any source file, any other test file, or the shared registries. If a
defect needs a source fix, report it with the mechanism and stop; the coordinator
routes it.

## STANDING ORDERS
Read `orchestrate/citadels/preferences.md` (all 13). One worktree, one branch;
never `git checkout`/`switch`/`stash`/`reset`/`rebase`/`branch`. Commit only
through `scripts/citadels-commit.sh "<message>" <path>...`. Your gate is
`scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification15.test.ts --own shared/core/tests/lockstep/citadels/verification15.test.ts`.
No repo-wide `vp test`/`vp check`.

## METHOD (the teeth audit - every prior pass did this)
For every guard you cite, prove it reddens when the behaviour it protects is
neutered. Copy the worktree to `/tmp/citadels-v15` (never run git commands in the
shared worktree), patch one source file in the copy with a replace that ASSERTS
the pattern is present (a no-op patch cannot masquerade as a pass), run the guard
with `-t`, record RED/GREEN, restore from the shared worktree by copy. Report any
guard that stays GREEN under a neuter as a finding.

## REPORT
End with: status, files written, the exact verify command, its raw result, the
commit SHA, and any deviation or shared-file change you need.
