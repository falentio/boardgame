# Terminal handoff: citadels program

**Written:** 2026-07-19, after the T3 server restarted twice and delegation began
failing with `parent_not_active` (14 consecutive spawn attempts over ~30 minutes,
both `delegate_task` and `t3_thread_launch`). The executor is down; the work below
is fully diagnosed and ready to resume.

## State

- Branch: `feat/citadels-game-definitions`, pushed to origin.
- Head: `9c28701` (fix: Trader/Emperor declared type, Diplomat Great Wall toll, Museum decline).
- Module: `shared/core/lockstep/games/citadels/` — 27 characters, 30 districts, full window machine.
- Tests: `shared/core/tests/lockstep/citadels/` — **540 pass, 7 fail**.
- All 7 failures are counterexamples from the two independent verification passes.
- Store: `orchestrate/citadels/` (this directory).

## What is done and verified

- 27/27 characters implemented, one file each, one test each.
- 30/30 districts implemented, one file each, one test each.
- Full games reach terminal for 3-6 seats across 3 casts (integration.test.ts).
- Redaction holds mid-game; two peers converge byte-identical (codec-redaction.test.ts).
- Two independent adversarial passes ran. Pass 1 found 14 defects, pass 2 found 15
  more (including that pass 1's fix was shallow). 23 of those are fixed and green.
- Full repo suite: 1263 pass, 5 pre-existing baseline failures unrelated to citadels.

## What remains: 3 real source defects + 3 flawed counterexamples

### Real defects (all in shared/core/lockstep/games/citadels/helpers.ts)

**V2-4 — Thieves' Den gold share never debited.**
In `tryBuild` (~line 425), the `payCards > 0` branch discards the cards and never
touches gold. A cost-4 Den with 2 gold + 2 cards builds for free, keeping the 2 gold.
Fix: in that branch, also debit the remainder — affordability becomes
`gold + payCards >= cost`, and `gold -= Math.max(0, cost - payCards)`; set
`paid = true` when any gold was paid. Verified by probe: gold after a 2-gold build
is 2, should be 0.

**V2-7 — Alchemist refund is dead.**
`alchemist` (characters/alchemist.ts) reads `pending.gold` for the turn's build
spend, but no build path writes it, and the effect runs from the top-of-turn
`resolve` step, before the build. Fix: have `tryBuild` record the gold a build paid
in the turn-local pending, and make the refund land at end of turn (e.g. a second
`resolve` after `END_TURN`, or a per-turn spend field the end-turn reads). Verified
by probe: an Alchemist that builds a Tavern ends at 9 gold, should be 10.

**V2-8 — Armory never fires.**
`armoryTriggers = ["onDestroy"]` (districts/armory.ts:149), but `runDistrictHooks` is
called only with `onBuild`, `onDraw`, `onIncome`, `onEndTurn`, `onRoundStart`
(helpers.ts:443, 473, 559, 681, 711). Nothing calls `onDestroy`, so the Armory's
window never opens in a real game. Fix: fire `onDestroy` for the acting seat when
its turn opens (in `resolveTurn`), so the offer appears. Verified by probe: no
`armory-destroy` window opens after a turn.

### Flawed counterexamples (do NOT "fix" the source for these; the tests are wrong)

**`a folded game that names characters records at least one kill, rob, or bewitch`**
(verification2.test.ts) — its policy only takes gold and never builds, so no city
ever completes and it never reaches terminal; the assertion on `isTerminal` fails.
Probed directly: `everNamed === true` (the naming fix works); only `terminal` is
false. Fix the test's policy to build, or drop the `isTerminal` assertion.

**`the Trader counts a School of Magic declared trade`** and **`the Emperor counts a
School of Magic declared noble`** (verification2.test.ts) — both call `advance` from
a draft-phase state (no `phase: "turn"`, no turn window), so the character effect
never runs and gold is unchanged. Probed the effect directly: both gain +1, correct.
Fix the tests to set up a turn-phase state (see `turnState` in
verification-report.test.ts).

**Note the conflict:** verification-report.test.ts's D10 counterexample
(`a card can be placed under the Museum during its owner's turn`) now fails because
the V2-9 fix correctly made a `pass` decline. The rulebook says "you may place", so
V2-9 is right and D10's assertion is stale. D10 must be updated to send a `keep`
action, not a `pass`.

## Exact command to resume

```
cd /home/kevin/.t3/worktrees/boardgame/t3-a32da114
# fix the three source defects in helpers.ts + alchemist.ts, then:
scripts/citadels-verify.sh \
  shared/core/tests/lockstep/citadels/verification2.test.ts \
  shared/core/tests/lockstep/citadels/verification-report.test.ts \
  --own shared/core/lockstep/games/citadels/helpers.ts \
  --own shared/core/lockstep/games/citadels/characters/alchemist.ts \
  --own shared/core/lockstep/games/citadels/districts/armory.ts
vp test shared/core/tests/lockstep/citadels/
```

The module is otherwise complete. The remaining work is three small fixes and three
counterexample corrections, then a third independent verification pass.
