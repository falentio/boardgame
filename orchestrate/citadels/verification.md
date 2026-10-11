# Citadels game definition: independent verification

Verifier: review sub-agent (adversarial). I did not write this module.
Head under review: `feat/citadels-game-definitions`, worktree
`/home/kevin/.t3/worktrees/boardgame/t3-a32da114`.
Product: this report plus `shared/core/tests/lockstep/citadels/verification-report.test.ts`,
14 counterexample tests, every one of which fails against this head.

## Verdict

**FAIL.** The module is a large, well-factored surface of per-character and
per-district files, and its own 496 tests are green — but the engine does not
call any of them. A real game runs the draft, the gather, and the build only.
No character ability ever executes, and three of the six done-predicate clauses
fail outright. This is not "a few edge cases"; the load-bearing seam between the
rank cursor and the character registry is missing.

## How to reproduce

```
scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification-report.test.ts \
  --own shared/core/tests/lockstep/citadels/verification-report.test.ts
# => VERIFY FAILED: vitest  (14 failed)
```

Whole citadels suite: `vp test shared/core/tests/lockstep/citadels`
=> **1 failed | 67 passed (68 files)**, **14 failed | 496 passed (510 tests)**.
The 496 are the module's own suite; the 14 are these counterexamples.

## Done-predicate clause-by-clause

| # | Clause | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | Full game reaches terminal (one winner) for 3-6 seats and 3+ casts | **PASS (weak)** | Folding the always-legal policy reaches `phase: "over"` for 3/4/5/6 seats and 3 casts. But terminal is reached *without a single character ability firing*, so it terminates a game that is not Citadels. |
| 2 | All 27 characters implemented with a named test | **FAIL** | 27 files exist and 27 tests exist, but no character ability is reachable from `step` (D1). The tests call the effect functions directly and never assert the engine invokes them. |
| 3 | Every district with a test per unique effect | **PARTIAL/FAIL** | 30 unique files, 30 tests. But the Warlord's destroy ignores Keep and Great Wall (D4, D5), the Bishop shield is never enforced (D6), the Museum has no placement seam (D10), the Thieves' Den mixed payment is refused (D11), and the Quarry's one-duplicate rule is absent (D7). |
| 4 | Exact scoring: cost sum, 3 for five types, 4 first / 2 other, unique points, tie-breaks | **FAIL** | Beautified district marker ignored (D2); Secret Vault unreachable (D3); completion order wrong (D8); Ivory Tower/Haunted Quarter interaction wrong (D12). Colour bonus and 4/2 base bonus are correct. |
| 5 | Hidden information never crosses `project`; two peers converge | **FAIL** | The gather's unkept card is published in the public `discard` (D14); convergence itself holds. |
| 6 | No unverified file; `vp test` and `vp typecheck` green | **FAIL** | The suite is green only because the character engine path is dead. `tsc -p tsconfig.citadels.json` is green. |

## Defects (each has a failing test in verification-report.test.ts)

### D1 — No character ability is ever invoked by the engine (blocking)
`applyCall` (helpers.ts:544) pushes only `winStep("turn")`, `END_TURN`, `CALL`.
The only code that runs `CHARACTER_EFFECTS[id]` is the `{kind:"resolve"}` branch in
`windows.ts:37-46`, and the only steps that push a `resolve` step are the character
effects themselves (assassin/thief/spy/magician/blackmailer/magistrate/witch). Since
no effect is ever invoked, no `resolve` step is ever pushed, so the whole character
sub-machine is unreachable. Confirmed by folding a full base-cast game: the set of
window purposes seen is exactly {draft-pick, keep, turn}; `pending.character` is
never set; `crown` stays with the opening holder for the whole game (the King never
runs). Counterexample: *"a full game exercises at least one character ability through
the engine"*. This single defect makes clause 2 false and drains the meaning from
clauses 1, 3, and 4.

### D2 — Beautified district marker is not in the cost sum (scoring)
`scoreGame`'s `costSum` (scoring.ts:16-17) sums `specOfDistrict(id).cost` and ignores
`PlacedDistrict.gold`. The catalog says "a beautified district counts +1" and the
Artist's own file documents the marker as "the permanent +1 cost". A Manor with one
gold marker scores 3, not 4. Counterexample: *"a beautified district scores one more
than its catalog cost"*.

### D3 — Secret Vault's held-card bonus is unreachable (scoring)
`scoreGame`'s `uniquePoints` folds only the uniques **standing in a city**
(scoring.ts:40-49). The Secret Vault cannot be built (`secretVaultBuild` refuses it),
so it can only ever be in hand, and the scorer never scans a hand. The vault's own
test says so in a comment and seats the vault in a city to force the pass. A hand
holding a Secret Vault scores 0. Counterexample: *"a Secret Vault still in hand at
end of game scores three"*.

### D4 — Great Wall toll never charged (Warlord / district fidelity)
`greatWallToll` exists but no code calls it. `warlordResolve` (warlord.ts:97) uses
`destroyPrice(id, beautifyGold)` alone. Destroying a Palace (5) behind a Great Wall
costs the Warlord 4, not 5. Counterexample: *"the Warlord pays one extra gold to
destroy a district behind a Great Wall"*.

### D5 — Keep is not protected (district fidelity)
`keepProtects` exists but no code calls it. `warlordResolve` lets the Warlord destroy
the Keep. Counterexample: *"the Warlord cannot destroy the Keep"*.

### D6 — Bishop shield never enforced (character fidelity)
`bishopShield` is computed correctly and is the only shield helper, but nothing
consults it. The rank-8 Warlord freely destroys a district in the Bishop's city.
Counterexample: *"the rank-8 Warlord cannot destroy a district in the Bishop's city"*.

### D7 — The Quarry's one-duplicate rule is absent (district fidelity)
The catalog: "Quarry: you may build a district already in your city; only one
duplicate per city at a time." Without a Quarry, `tryBuild` happily builds a second
copy of a district already in the city. The Quarry's own test asserts this as
intended ("the one-duplicate cap is the Quarry's own doing, not a base rule"), which
inverts the rule: the base game forbids duplicates and only the Quarry permits one.
Counterexample: *"a district already in your city cannot be built again without a
Quarry"*.

### D8 — Completion bonus uses roster order, not finish order (scoring)
`applyEndRound` builds `completed` as `state.players.filter(...)` — roster order.
`completionBonus` gives +4 to `completed[0]`. If seat 1 finished first and seat 0
finished later in the same round, seat 0 wrongly receives +4. Counterexample:
*"the first city to reach eight districts takes the four-point bonus"*.

### D9 — Declared type never reaches income counting (character/district fidelity)
`schoolOfMagic` writes `PlacedDistrict.declaredType`, and `typeOfPlaced` reports it to
the colour bonus, but the income counters (king, bishop, merchant, warlord, diplomat,
marshal, patrician, cardinal, abbot) read `specOfDistrict(id).type` directly, ignoring
`declaredType`. A King with a School of Magic declared noble gains 0, not 1. The same
applies to a Haunted Quarter declared noble. Counterexample: *"a School of Magic
declared noble counts as a noble for the King's income"*.

### D10 — Museum has no placement seam (district fidelity)
The catalog: "Museum: once per turn, place a card from your hand under the Museum."
`museum` is a no-op, `museumTriggers` is empty, and there is no window purpose for
placement. The Museum can never accumulate cards in a real game. Counterexample:
*"a card can be placed under the Museum during its owner's turn"*.

### D11 — Thieves' Den mixed payment refused (district fidelity)
The catalog: "you may pay for the Thieves' Den with cards from your hand at 1 card =
1 gold." `thievesDenBuild` only offers card payment when gold is *entirely*
insufficient; with 2 gold and 3 spare cards on a cost-4 Den, the build is refused.
The file itself names this gap in a comment. Counterexample: *"the Thieves' Den may
be paid partly in gold and partly in cards"*.

### D12 — Ivory Tower / Haunted Quarter interaction wrong (scoring)
`ivoryTowerScoring` hard-codes "a Haunted Quarter is non-unique". But the Haunted
Quarter's owner chooses its type; if they declare *unique*, the Haunted Quarter is a
second unique and the Ivory Tower must score 0. The implementation scores 5.
Counterexample: *"an Ivory Tower beside a Haunted Quarter declared unique scores
nothing"*.

### D13 — step throws instead of coercing on a bare-step stack (totality)
`stepState` throws `citadels step called with no open window` when the top step is
not a window, even though `seatsOwed` still names every live seat for that state.
The action union's doc promises the machine is total ("a hostile or buggy report can
never throw out of `step`"). Counterexample: *"step coerces a non-terminal state
whose stack has no window"*. Note: a 4000-frame hostile-input fuzz found no throw
from inputs alone; this throw needs a malformed stack, which the engine can reach
after a resignation mid-draft (see the note under Hidden information).

### D14 — The gather's unkept card leaks through the public discard (hidden info)
`resolveKeep` (helpers.ts:497-502) moves the cards not kept into `state.discard`,
which `project` publishes verbatim as `view.discard` for every seat. So when a seat
draws 2 and keeps 1, the other seat learns the exact identity of one hidden-deck
card. Counterexample: *"a hidden deck card is not revealed to other seats through the
discard pile"*. Deck order and other seats' hands do not leak; this is the one leak.

## Coverage audit: what has no real test

- **Every character (27/27) has a test file, but none tests the engine invocation
  path.** Each character test calls the effect function directly with a hand-built
  state and asserts the return value. That is why the suite is green while the engine
  never calls a single effect. A test that would catch D1 must fold a real game and
  assert a character window opens — none does. The closest, `scaffold.test.ts`, only
  checks `typeof CHARACTER_EFFECTS[id] === "function"`, which a stub satisfies.
- **Every unique district (30/30) has a test file**, plus a redundant
  `districts/theatre.test.ts` (a near-duplicate of the first half of
  `districts/theater.test.ts`; the misspelling also appears in the window purpose
  `theatre-swap`). Many district tests assert only a pure helper's return value
  (`keepProtects("keep")`, `greatWallToll(...)`, `armoryTriggers`) without ever
  proving the engine consults it — exactly the shape that hides D4, D5, D6.
- **Tests that would pass with the implementation deleted (assert nothing real):**
  - `scaffold.test.ts` "every character in the catalog has its own file, an effect,
    and a resolver wiring" — `typeof ... === "function"`, satisfied by any stub.
  - `district-triggers.test.ts` — asserts `UNIQUE_TRIGGERS[id]` *is the same array*
    the file exports; a tautology over the registry.
  - `district-windows.test.ts` "stepState tries the district registry before the
    character registry" — `indexOf` over `windows.ts` source text; passes regardless
    of behavior.
  - Every "the ability is not a no-op" test calls the effect directly, so it proves
    the function is non-trivial but not that the engine reaches it.

## Hidden-information audit

- `project` correctly omits `deck`, `draft`, `pool`, `facedown`, and other seats'
  hands; `myHand` and `myPick` are the viewer's own. Two peers folding the same
  frames converge (verified in the module's own integration test and re-checked
  here).
- **Leak found:** `view.discard` for every seat includes cards that were never
  public before this rule — specifically the unkept card of a gather draw (D14).
  Seat: every seat except the drawer; field: `CitadelsView.discard`.

## What is verified vs unverified

**Verified:** the deck catalog (54 basics, 30 uniques, costs/types/copies match
`citadels-catalog.md`); the character/unique registries are total over the catalog;
genesis deals correctly and conserves the deck; the draft is hidden; the gather and
single build work; the phase machine reaches terminal for 3-6 seats; the colour
bonus and the base 4/2 completion split compute correctly when `completed` is
supplied; `stateCodec`/`actionCodec` round-trip; `tsc -p tsconfig.citadels.json` is
green.

**Unverified / broken:** the entire character ability sub-machine (unreachable);
the Warlord's Keep and Great Wall clauses; the Bishop shield; the Quarry duplicate
rule; the Artist beautify scoring; the Secret Vault held-card scoring; the completion
order; the Museum placement; the Thieves' Den payment; the Haunted Quarter's
declared type in income counting; `step` totality on a malformed stack; the discard
leak.

## Suggested next step (not performed — this unit does not fix)

The coordinator should own the shared-file change: `applyCall` must push a
`{kind:"resolve"}` step (with `pending.character` set) before each character's turn
window so the effect registry runs, and `applyEndRound` must record finish order
rather than roster order. Every other defect is inside a file this unit does not own
(the character/district files and `scoring.ts`), and D2/D3/D14 touch shared files.
