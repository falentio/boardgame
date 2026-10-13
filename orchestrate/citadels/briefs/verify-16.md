# Unit: verify-16 (SIXTEENTH adversarial pass, head <FIX15_SHA>)

## GOAL
Re-verify the citadels game definition at the head fix15-plain-order lands. Passes
1-15 each returned FAIL with a defect family; every fix has landed. Your job is to
find what is STILL wrong, including anything the D15 fix (the plain-turn relocation)
introduced or papered over.

## HEAD
`<FIX15_SHA>` on `feat/citadels-game-definitions`, worktree
`/home/kevin/.t3/worktrees/boardgame/t3-a32da114`. Confirm the full citadels suite is
green before you start. Do not trust the green suite.

## CONTEXT: what the D15 fix changed (this pass's target)
verify-15 proved D15-1..3: a refused threatened seat's gold-gated ability (Warlord
destroy, Marshal seize, Diplomat exchange, Abbot richest clause) ran on the POST-gather
purse while the plain turn ran it PRE-gather, so refused != plain. The ruling (see
`orchestrate/citadels/decisions.tsv` and `briefs/fix15-plain-order.md`):

- The plain turn order is **gather -> abilities -> build**, forced by rules.json
  blackmailer ("they must gather resources, then resolve the threat ... before using
  abilities or building") plus the pinned refused==plain contract. The threatened order
  is the same with the threat spliced after the gather.
- `relocateEffectBelowThreat` (helpers.ts, called from windows.ts) now relocates an
  effect's windows below the **gather turn window** when no threat stands (it used to
  return early), and `resolveTurn`'s gather path places the build window AFTER the
  relocated windows, above the turn's own END_TURN, mirroring the threatened branch.

## READ FIRST
- `orchestrate/citadels/verification-15.md` (the last pass) and the D15 ruling in
  `decisions.tsv`.
- `orchestrate/citadels/verification-13.md` and `-14.md` (the ordering contracts).
- `docs/design/citadels-catalog.md` and `docs/design/citadels-full-game.md`.
- The whole module and test suite under `shared/core/lockstep/games/citadels/` and
  `shared/core/tests/lockstep/citadels/`.

## WHAT TO DO
1. **Re-run every prior pass's counterexamples** (verification-report through
   verification15). Confirm they still pass and that each fix addresses its defect
   rather than its test.
2. **Attack the new plain-turn order.** The plain turn now runs gather -> abilities ->
   build. Check, for EVERY character whose effect opens a window:
   - Does the ability now see the post-gather purse, and does a refused turn still
     equal the plain turn (the D15 contract)?
   - Does the **build** still follow the ability (the D14-1 contract: the Scholar draws
     and keeps before it builds; the Architect/Marshal/Trader too)?
   - Does the **Alchemist's** settle refund still run AFTER its build, and its build
     limit still re-offer?
   - The **Navigator** (gain rides the resolve step) and the **Witch** (her naming
     window drives her resume pairing; she is exempt from the relocation): do their
     turns still reach the plain end state?
   - A **two-character seat** (2-3 player draft): the relocation must key on the acting
     character, not the seat's first claim.
3. **The arm/rearm seam.** The plain relocation reuses the `arm` step (as the
   threatened path does). Can a rearm overwrite a pending a later window owns? Can the
   build window run after the turn's END_TURN? Can a fold with no END_TURN strand a step
   or double-close the turn?
4. **The build-window re-frame audit.** fix15 re-framed fixtures that pinned the old
   ability-before-gather order. For every re-framed fixture, confirm the new assertion
   still has teeth (revert the fix in a /tmp copy and confirm it reddens) and encodes the
   rule, not merely the new implementation. A re-frame that only moves a number without a
   rules.json citation is a finding.
5. **New defects.** Anything the D15 fix introduced: a double count, a lost payload, a
   conservation break, a window that re-offers forever, a turn that runs twice, a
   district hook that fires twice.
6. **Coverage.** For each of the 27 characters and 30 districts, name any that still
   has no test that would FAIL if the engine stopped invoking it. Note the standing gap
   from passes 10-15: no data-driven test compares the 27 character `summary` strings
   to rules.json.

## SCOPE (the files you own)
- `shared/core/tests/lockstep/citadels/verification16.test.ts` (NEW) - a failing test
  per real defect, plus positive probes for the clauses you did not break
- `orchestrate/citadels/verification-16.md` - your report

Do not edit any source file, any other test file, or the shared registries. If a defect
needs a source fix, report it with the mechanism and stop; the coordinator routes it.

## STANDING ORDERS
Read `orchestrate/citadels/preferences.md` (all 13). One worktree, one branch; never
`git checkout`/`switch`/`stash`/`reset`/`rebase`/`branch`. Commit only through
`scripts/citadels-commit.sh "<message>" <path>...`. Your gate is
`scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification16.test.ts --own shared/core/tests/lockstep/citadels/verification16.test.ts`.
No repo-wide `vp test`/`vp check`.

## METHOD (the teeth audit - every prior pass did this)
For every guard you cite, prove it reddens when the behaviour it protects is neutered.
Copy the worktree to `/tmp/citadels-v16` (`git archive HEAD | tar -x -C`), patch one
source file in the copy with a replace that ASSERTS the pattern is present (a no-op patch
cannot masquerade as a pass), run the guard with `-t`, record RED/GREEN, restore from the
shared worktree by copy. Report any guard that stays GREEN under a neuter as a finding.

## REPORT
End with: status, files written, the exact verify command, its raw result, the commit
SHA, and any deviation or shared-file change you need.
