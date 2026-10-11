# Unit: fix-engine (D1 blocking, D7, D8, D10, D13, D14)

## GOAL
Fix the blocking defect D1 and five engine-level defects, so a real game actually
runs character abilities, enforces the duplicate rule, records finish order,
lets the Museum place a card, coerces instead of throwing, and never leaks a
hidden card through the discard pile.

## THE DEFECTS (read each counterexample in verification-report.test.ts)
- **D1 (blocking).** `applyCall` (helpers.ts) pushes only `[turn, end-turn, call]`.
  The `{kind:"resolve"}` step is the only thing that runs `CHARACTER_EFFECTS[id]`,
  and nothing ever pushes it. So no character ability ever runs in a real game.
  Your own probe should confirm: fold a base-cast game and observe that no
  character window ever opens and the crown never moves.
- **D7.** `tryBuild` permits a duplicate district in a city with no Quarry. The
  base rule forbids a duplicate; the Quarry is what permits one.
- **D8.** `applyEndRound` builds `completed` in roster order, so the +4 goes to
  roster index 0 rather than the seat that finished first.
- **D10.** The Museum has no placement seam, so it can never accumulate cards.
- **D13.** `stepState` throws "no open window" on a bare-step stack while
  `seatsOwed` still names the seats; the action union promises totality.
- **D14.** `resolveKeep` moves the unkept gather cards into `state.discard`, which
  `project` publishes to every seat, revealing a hidden deck card.

## THE D1 CONTRACT (the load-bearing fix; derive it from the effects, not from me)
The character effects were written to run from a `{kind:"resolve"}` step whose
`rest` is the steps that follow it. Read at least these before you design:
- characters/architect.ts (`withBuildLimit(ctx.rest, ...)` replaces the turn windows in `rest`)
- characters/navigator.ts (`withoutBuild(ctx.rest, ...)` removes them)
- characters/warlord.ts, assassin.ts (open windows, then continue into `ctx.rest`)
- characters/king.ts, merchant.ts (add income, return `ctx.rest` unchanged)
That fixes the shape: `applyCall`, for the called character's owner, must arm
`pending = emptyPending(seat, character)` and push a `resolve` step ABOVE the turn
window, so the effect runs first and its returned steps become the turn. A window
a character opens must sit above the turn window so it resolves before the gather.
Verify the Witch-takeover and Thief-rob paths still behave (read witch.ts and
thief.ts), and that `end-turn` still clears pending.
Prove D1 with a real fold: after your fix, a base-cast game must open at least one
character window and the crown must leave its opening holder.

## SCOPE (the files you own)
- shared/core/lockstep/games/citadels/helpers.ts
- shared/core/lockstep/games/citadels/windows.ts
- shared/core/lockstep/games/citadels/state.ts
- shared/core/lockstep/games/citadels/museum.ts
- shared/core/tests/lockstep/citadels/fix-engine.test.ts (NEW, if you need a test
  the counterexamples do not cover)

## ACCEPTANCE
The counterexamples named D1, D7, D8, D10, D13, D14 in
verification-report.test.ts all pass. The whole citadels suite is green.

## VERIFY
`scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification-report.test.ts --own shared/core/lockstep/games/citadels/helpers.ts --own shared/core/lockstep/games/citadels/windows.ts --own shared/core/lockstep/games/citadels/state.ts --own shared/core/lockstep/games/citadels/museum.ts`
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
exact D1 change (the new step sequence and where pending is armed); any
counterexample that encodes a wrong rule; any test that had to change because D1
made characters actually run.

## STANDING ORDERS
1. WORKTREE. All agents share ONE worktree and ONE branch: /home/kevin/.t3/worktrees/boardgame/t3-a32da114 on feat/citadels-game-definitions. There is no per-agent worktree. Never run `git checkout`, `git switch`, `git stash`, `git reset`, `git rebase`, or `git branch`.
2. COMMITS. Commit ONLY through `scripts/citadels-commit.sh "<message>" <path> [<path>...]`, which takes a lock on the shared git index. Never run bare `git commit` or `git add`. Stage only the paths you own; the script refuses a path that does not exist.
3. VERIFY. Your gate is `scripts/citadels-verify.sh <your test file> --own <each source file you edited>`. Pass `--own` for every source file you edit; without it the script derives only from existing test names. Do not run repo-wide `vp test` or `vp check`: both are red at baseline for unrelated reasons.
4. SCOPE. Write only the files named in your brief. Never edit a sibling's file, and never edit a shared file (state.ts, actions.ts, windows.ts, helpers.ts, setup.ts, scoring.ts, index.ts, characters.ts, districts.ts, characters/index.ts, districts/effects.ts). If you need a shared-file change, report it and stop; the coordinator serializes it.
... 8 more; narrow with state/track filters or limit
