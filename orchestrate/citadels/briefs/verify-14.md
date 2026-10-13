# Unit: verify-14 (FOURTEENTH adversarial pass, new head aa6f553)

## GOAL
Re-verify the citadels game definition at the current head. Passes 1-13 each
returned FAIL with a defect family; every fix has landed. Your job is to find
what is STILL wrong, including anything fix13c introduced or papered over.

## HEAD
`aa6f553` on `feat/citadels-game-definitions`, worktree
`/home/kevin/.t3/worktrees/boardgame/t3-a32da114`. Full citadels suite is green
at 86 files / 700 tests. Do not trust the green suite.

## CONTEXT: what fix13c changed (this pass's target)
`5305109` (D13) relocated a threatened seat's ability windows below the
Blackmailer threat. `aa6f553` fixed the two things that relocation dropped:

1. A new **`arm` step kind** (`state.ts`, codec round-tripped) carries the
   effect's `pending` payload down to where the relocated windows drain.
   `relocateEffectBelowThreat` (helpers.ts) re-arms `produced.pending` directly
   above the relocated windows when the effect pushed a window above the turn
   window and the pending names the acting character. `applyImmediate`
   (windows.ts) runs the arm step.
2. **`endTurnThen`** (helpers.ts) now reuses the turn's own `END_TURN` wherever
   it sits (`rest.some((step) => step.kind === "end-turn")`) instead of
   prepending a second one. The relocated windows stand between the post-threat
   build window and that `END_TURN`; the old form only looked directly under a
   bare resolve or the threat window, so it closed the turn twice and double-fired
   every `onEndTurn` district hook (measured: a refused threatened Smithy paid 4
   gold for 6 cards instead of 2 for 3).

`verification11.test.ts` P1 is green, plus a new **P3** guard pinning the single
close. `verification13.test.ts` D13-9 was corrected (its `thief-rob` assertion
was vacuous - the robbery follows the threat even with the defect standing - and
now pins the NAMING window's position plus that the robbery still lands).

## READ FIRST
- `orchestrate/citadels/verification-13.md` (the last pass, so you do not repeat it)
- `orchestrate/citadels/verification-11.md` (the P1/P2 contract fix13c completes)
- `orchestrate/citadels/decisions.tsv` tail (the fix13c ruling and its rationale)
- `docs/design/citadels-catalog.md` and `docs/design/citadels-full-game.md`
- The whole module and test suite under `shared/core/lockstep/games/citadels/`
  and `shared/core/tests/lockstep/citadels/`

## WHAT TO DO
1. **Re-run every prior pass's counterexamples** (verification-report through
   verification13). Confirm they still pass and that each fix addresses its defect
   rather than its test.
2. **Attack the fix13c seam specifically.**
   - The `arm` step: is it reachable only where intended? Does a stale arm step
     ever overwrite a pending a later window owns? Does it survive a codec
     round-trip mid-flight (the engine encodes/decodes between frames)?
   - `endTurnThen`: does reusing the turn's own `END_TURN` ever let a turn close
     at the WRONG `END_TURN` - one that belongs to a nested continuation, a
     district window, or the next seat's turn? Try to construct a fold where the
     turn ends early or late, or where an `onEndTurn` hook fires zero times.
   - A **threatened Witch**: the relocation exempts her (`character === "witch"`
     returns early). Does a threatened Witch bewitch before her threat resolves?
     If yes it is D13-12 and the exemption is wrong. Measure the bewitch timing,
     not just the board.
   - A **two-character seat** (2-3 player games draft two): does the relocation
     and the arm step key on the acting character, not the seat's first claim?
3. **The four remaining plain-vs-refuse divergences on the BUILD path.** A probe
   folding 26 characters x 2 boards with a buildable hand finds four cases where a
   refused threatened turn does not equal the plain turn: `cardinal/school`,
   `architect/school`, `scholar/museum`, `scholar/school`. These predate
   fix13c. Determine for each whether it is a real defect (a lost or extra build,
   draw, or card) or a policy artifact of the probe's fixed answer function, and
   write a counterexample for every real one.
4. **New defects.** Anything fix13c introduced: a double count, a lost payload, a
   conservation break, a window that re-offers forever, a turn that runs twice.
5. **Coverage.** For each of the 27 characters and 30 districts, name any that
   still has no test that would FAIL if the engine stopped invoking it.

## SCOPE (the files you own)
- `shared/core/tests/lockstep/citadels/verification14.test.ts` (NEW) - a failing
  test per real defect, plus positive probes for the clauses you did not break
- `orchestrate/citadels/verification-14.md` - your report

Do not edit any source file, any other test file, or the shared registries. If a
defect needs a source fix, report it with the mechanism and stop; the coordinator
routes it.

## STANDING ORDERS
Read `orchestrate/citadels/preferences.md` (all 13). One worktree, one branch;
never `git checkout`/`switch`/`stash`/`reset`/`rebase`/`branch`. Commit only
through `scripts/citadels-commit.sh "<message>" <path>...`. Your gate is
`scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification14.test.ts --own shared/core/tests/lockstep/citadels/verification14.test.ts`.
No repo-wide `vp test`/`vp check`.

## METHOD (the teeth audit - every prior pass did this)
For every guard you cite, prove it reddens when the behaviour it protects is
neutered. Copy the worktree to `/tmp/citadels-v14` (never run git commands in the
shared worktree), patch one source file in the copy with a replace that ASSERTS
the pattern is present (a no-op patch cannot masquerade as a pass), run the guard
with `-t`, record RED/GREEN, restore from the shared worktree by copy. Report any
guard that stays GREEN under a neuter as a finding.

## REPORT
End with: status, files written, the exact verify command, its raw result, the
commit SHA, and any deviation or shared-file change you need.
