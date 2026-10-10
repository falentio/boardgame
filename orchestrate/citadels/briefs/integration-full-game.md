# Unit: integration-full-game

## GOAL
Prove the citadels definition plays complete games on the lockstep primitive:
every seat count 3-6 reaches terminal with one winner, the hidden information is
redacted, and two independent peers folding the same frames reach identical state.

## READ FIRST
- docs/design/citadels-full-game.md (the done predicate)
- docs/design/citadels-catalog.md (the rules of record)
- shared/core/tests/lockstep/citadels/driver.ts (the driver)
- shared/core/tests/lockstep/citadels/scaffold.test.ts (the test style)
- shared/core/tests/lockstep/g54/fullgame.test.ts and driver.ts (the model to mirror)
- shared/core/tests/lockstep/harness.ts (makeTable, at, fakeClock)
- shared/core/lockstep/games/citadels/index.ts (project, isTerminal, winnerOf)

## SCOPE (the files you own)
- shared/core/tests/lockstep/citadels/integration.test.ts (NEW)
- shared/core/tests/lockstep/citadels/driver.ts (extend only: add an autoAction policy and helpers; keep existing exports)

## ACCEPTANCE (tests in integration.test.ts)
1. A full game reaches terminal for 3, 4, 5, and 6 seats, driven by a
   deterministic always-legal policy, in under 5000 frames each, with exactly one
   winner (or a documented tie) from `winnerOf`.
2. The same for three distinct character casts, including one that uses a rank-9
   character and one drawn from the rulebook's preset lists in citadels-catalog.md.
3. **Redaction.** For a live mid-game state, `project(seat)` for each seat omits
   the deck order and every other seat's hand, and exposes only that seat's own
   hand and pick. Assert on the keys, not a comment.
4. **Convergence.** Two independent `makeTable` instances fold the same frames and
   reach byte-identical `stateDigest` at terminal. Build this by recording the
   sealed frames from one table and replaying them through a second, the way
   shared/core/tests/lockstep/convergence.test.ts does.
5. **Deck conservation.** Across a whole game, the total district count (hands,
   cities, deck, discard, in-flight draws) is constant at the deck size.
6. **Determinism.** Genesis with the same seed and cast yields identical state.
7. **Scoring reaches the terminal state.** At terminal, every seat has a score row
   and the winner is the top scorer under the documented tie-breaks.

## VERIFY
`scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/integration.test.ts --own shared/core/tests/lockstep/citadels/driver.ts`
Then run the whole citadels suite and report it.

## FORBIDDEN
Standing orders apply. Do not edit any file under shared/core/lockstep/games/citadels/
except driver-adjacent test helpers if truly needed; if you need a game-module
change, report it and stop. Do not weaken an assertion to make a game terminate.

## REPORT
status; files written; verify output including the whole suite; commit SHA; the
frame counts per seat count; any cast that failed to terminate and why.

## STANDING ORDERS
<paste preferences.md verbatim>
