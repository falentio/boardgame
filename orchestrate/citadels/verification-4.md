# Citadels game definition: fourth independent verification

Verifier: review sub-agent (adversarial, fourth pass). I did not write this
module. Source head under review: `feat/citadels-game-definitions`, worktree
`/home/kevin/.t3/worktrees/boardgame/t3-a32da114`. The module head is `69aae2e`
(the fix3-guards wave); the worktree tip is `46a84aa`, which touches only
`orchestrate/citadels/**` and no source file, so both are the same module.

Product: this report plus
`shared/core/tests/lockstep/citadels/verification4.test.ts` — 9 tests, every one
of which fails against this head and names a defect.

## Verdict

**FAIL.** The three prior passes were right, and their fixes hold: all 14
first-pass, 15 second-pass, and 10 third-pass counterexamples pass against this
head (39 green, re-run below). The guard wave’s teeth are real where the third
pass strengthened them (see the teeth audit: six sampled guards all turn RED).

But the module still has seven real defects a fourth pass reaches, and they
cluster where the three prior passes did not look: **the Witch’s held turn still
carries the round’s build window and a second gather**, **the Tax Collector’s
exemption is per-seat rather than per-character in 2-3 player games**, **a
destroyed Museum’s tucked cards vanish**, **the Blackmailer’s threat resolves
before the threatened player gathers**, **the Bishop’s rank-8 shield is
consulted only by the Warlord**, **the Ivory Tower disagrees with the module’s
own `typeOfPlaced` about an undeclared Haunted Quarter**, and **the Magistrate
cannot confiscate a card-paid Thieves’ Den**. None repeats D1..D14, V2-1..V2-9,
or D3-1..D3-7; each is a clause one step to the side of a fix that landed.

## How to reproduce

```
scripts/citadels-verify.sh \
  shared/core/tests/lockstep/citadels/verification4.test.ts \
  --own shared/core/tests/lockstep/citadels/verification4.test.ts
# => VERIFY FAILED: vitest   (Tests 9 failed (9))
```

Whole citadels suite with this file added:

```
vp test shared/core/tests/lockstep/citadels/
# => Test Files  1 failed | 76 passed (77)
#    Tests  9 failed | 616 passed (625)
```

`tsc -p tsconfig.citadels.json` is green (the verify script’s tsc stage passes;
the gate fails only on the vitest counterexamples).

## Re-running the prior passes

```
vp test shared/core/tests/lockstep/citadels/verification3.test.ts \
  shared/core/tests/lockstep/citadels/verification2.test.ts \
  shared/core/tests/lockstep/citadels/verification-report.test.ts
# => Test Files  3 passed (3);  Tests  39 passed (39)
```

Every prior counterexample passes against this head. This pass adds no duplicate
of a prior finding.

## Defects (each has a failing test in verification4.test.ts)

### D4-1 — the Witch can build on her held turn (blocking)

`rules.json` (witch): “your turn is put on hold and you cannot build.”
`characters/witch.ts`’s own comment says the effect “opens the naming window but
no build-capable turn window of its own, so the Witch cannot build.” That is
false: `applyCall` (helpers.ts) builds the round’s stack as
`[RESOLVE, winStep(“turn”), END_TURN, CALL, …]` for every non-Navigator
character, and the Witch’s effect splices its naming window above that same
`ctx.rest`, so the turn window survives below the naming window. A Witch who
names a character and then answers that window with a build adds the district to
her city. The resume then opens a second turn window, so she can build twice.

Counterexample: *“D4-1 the Witch’s held turn carries no build window”*. Measured:
a folded Witch turn with a tavern in hand builds `tavern` at her own rank
(`built === true`). Through a real dealt-and-drafted game (a `foldGame` that
drafts the Witch to ANN), ANN ends the round with three districts — one per turn
window — and 4 gold.

### D4-1b — the Witch gathers three times, not once

The same stack gives the Witch a fixed `+2` in her effect, a second `+2` at the
held turn window, and a third `+2` at the resume window. The rules give one
gather for the Witch and one for the bewitched owner, never three for the Witch.

Counterexample: *“D4-1b the Witch gathers once, not twice, on her held turn”*.
Measured: a Witch starting at 10 gold ends at 16 (+6) after one held turn.

### D4-2 — the Tax Collector’s exemption is per-seat, not per-character

`rules.json` (tax-collector): “In 2-3 player games a player holding the Tax
Collector still pays tax for their other character.” `chargeBuildTax`
(helpers.ts) returns early on `seatHolding(state, “tax-collector”) === seat`,
exempting the whole seat. In a 3-player game a seat drafts two characters, so a
seat holding the Tax Collector and building with its other character pays
nothing where it must pay one gold.

Counterexample: *“D4-2 a 2-3 player seat pays tax for its other character”*.
Measured: `taxPot` is 0 when ANN holds the merchant and the Tax Collector and
builds; the control (BOB holds the Tax Collector) is 1.

### D4-3 — a destroyed Museum’s tucked cards vanish (card conservation)

`rules.json` (museum): “if destroyed the cards are discarded to the bottom of
the deck.” Every destroy path (`warlordResolve`, `armoryResolve`, and the
Framework/Necropolis self-destroy in `tryBuild`) pushes only the district’s `id`
to the deck, dropping `PlacedDistrict.cards`. A Warlord destroy of a Museum with
three tucked cards loses all three.

Counterexample: *“D4-3 a destroyed Museum’s tucked cards sink to the deck”*.
Measured: `totalCards` falls from 73 to 70 through the destroy; the Museum’s
three cards are gone.

### D4-4 — the Blackmailer’s threat resolves before the gather

`rules.json` (blackmailer): “When a threatened player is called, they must
gather resources, then resolve the threat.” `applyCall`’s `withThreat` prepends
the `blackmailer-threat` window above the turn window, so the bribe — half the
threatened player’s gold, rounded down — is computed before the gather lands. A
threatened player with 1 gold has 3 after gathering, so the bribe is 1; the
module takes half of the pre-gather 1 = 0.

Counterexample: *“D4-4 the Blackmailer’s threat resolves after the gather”*.
Measured: the bribe paid is 0; the post-gather half is 1.

### D4-5 — the Bishop’s rank-8 shield is consulted only by the Warlord

`rules.json` (bishop): “During this round the rank 8 character cannot use its
ability on your districts.” `bishopShield` exists and is correct, but
`warlord.ts` is its only consumer. The Marshal and the Diplomat are rank 8 too
and never read it, so they seize from / exchange out of a shielded seat’s city.

Counterexamples: *“D4-5 the Bishop’s shield stops the Marshal”* and *“…the
Diplomat”*. Measured: with BOB holding the Bishop, ANN’s Marshal seizes the
shielded `tavern` (ANN’s city becomes `[watchtower, tavern]`), and ANN’s Diplomat
exchanges it out (ANN’s city becomes `[tavern]`). The Warlord half is correct and
still shielded.

### D4-6 — the Ivory Tower disagrees with `typeOfPlaced` about an undeclared Haunted Quarter

`districts.ts`’s `typeOfPlaced` reports the catalog type `unique` for a Haunted
Quarter whose owner has not named a type, and `wishingWell.ts` counts it as a
unique on that basis. `ivoryTower.ts` special-cases the Haunted Quarter to
`declaredType === “unique”`, so an undeclared Haunted Quarter beside the Ivory
Tower no longer stops the tower from scoring. The catalog makes the Ivory Tower
score only when it is the city’s only unique district, so two of the module’s own
type readers disagree about the same card in the same state.

Counterexample: *“D4-6 an undeclared Haunted Quarter still blocks the Ivory
Tower”*. Measured: the Ivory Tower scores 5 with an undeclared Haunted Quarter
beside it; expected 0.

### D4-7 — the Magistrate cannot confiscate a card-paid Thieves’ Den

`rules.json` (thieves-den): “If confiscated by the Magistrate, you receive back
only gold spent, not cards.” The rule contemplates confiscating a Den paid for
with cards. `tryBuild` (helpers.ts) opens the `magistrate-confiscate` window only
when `paid` is true, and the Thieves’ Den’s card branch sets `paid = false`, so a
card-paid Den is never confiscatable.

Counterexample: *“D4-7 a card-paid Thieves’ Den can be confiscated”*. Measured:
the `magistrate-confiscate` window never opens for a Den paid with four cards.

## The teeth audit

I copied the worktree to `/tmp/citadels-v4` (the copy’s `.git` points at the
shared gitdir, so I never ran git there), edited each source directly in the copy,
re-ran the guard, and restored. Six sampled guards, including all three rows the
third pass strengthened (Keep, Great Wall, Trader):

| # | Guard under test | Reverted | Guard result |
|---|------------------|----------|--------------|
| P1 | Keep protected-vs-unprotected (fix3-guards row) | `keepProtects` forced to `false` | **RED** — `the engine reaches keep` (1 failed) |
| P2 | Great Wall toll difference (fix3-guards row) | `greatWallExchangeToll` forced to `0` | **RED** — `the engine reaches great-wall` (1 failed) |
| P3 | Trader declared-type +1 (fix3-guards row) | `tradeIn` reverted to `specOfDistrict(...).type` | **RED** — `the engine reaches trader` (1 failed) |
| P4 | Assassin kill | `drain` back to `owedFor` (cb626cf) | **RED** — `the engine reaches assassin` (1 failed) |
| P5 | Armory destroy window | `applyEndTurn` no longer fires `onDestroy` (d649c7f) | **RED** — `the engine reaches armory` (1 failed) |
| P6 | once-per-turn (Laboratory) | `endTurnThen` always prepends `END_TURN` (cb626cf) | **RED** — 4 failed (Laboratory, Smithy, Park, Poor House) |

All six required probes turn RED. The two fix3-guards rows the third pass found
green (Keep, Trader) are now genuinely behavioral, and the Great Wall row is too.

### Reverse direction (non-tautology)

I removed the *behaviour* behind five more guards and watched the guard:

| Guard | Behaviour removed | Guard result |
|-------|-------------------|--------------|
| Navigator | `navigatorChoice` forced to `"gold"` (the D3-1 card branch dead) | **GREEN — theater** |
| Spy | the gold-take `transferGold` removed (draw kept) | **GREEN — theater** |
| Thief | `loot` forced to `0` (no gold actually moves) | **GREEN — theater** |
| Assassin | the `skipped` write removed | RED (behavioural) |
| Magician | the effect stubbed to a no-op | RED (behavioural) |

So three guards still assert reachability/wiring rather than the move: the
Navigator guard passes with its card branch dead, the Spy guard passes with its
gold clause dead, and the Thief guard passes with no gold moved (it asserts only
that `robbed` was set). None of the three is a new defect, but each is a hole a
regression could slip through — and the Navigator one is exactly the D3-1 clause
`verification3.test.ts` pins, so the guard suite alone would not catch a
re-regression of it.

## Done-predicate clause-by-clause

| # | Clause | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | Full game reaches terminal (one winner) for 3-6 seats | **PASS (weak)** | The integration suite folds 3/4/5/6 seats and three casts to `phase: “over”`; all six rulebook preset casts also fold to terminal for 4/5/6 seats (my probe, no throw, no non-terminal). But D4-1/D4-1b, D4-2, and D4-4 corrupt a real game’s gold and cities, so the *winner* is not always the rulebook’s. |
| 2 | Every character implemented with a behavioral test | **FAIL** | 27 files and 27 tests exist, but the Witch builds and gathers extra through the engine (D4-1, D4-1b); the Blackmailer’s threat order is wrong (D4-4); the Bishop’s shield does not cover the Marshal or Diplomat (D4-5); the Tax Collector’s 2-3 player clause is missing (D4-2). |
| 3 | Every district implemented with a test per unique effect | **FAIL** | 30 files and 30 tests, but a destroyed Museum loses its cards (D4-3); the Ivory Tower mis-reads an undeclared Haunted Quarter (D4-6); the Magistrate cannot confiscate a card-paid Thieves’ Den (D4-7). |
| 4 | Exact scoring: cost sum, five-type bonus, 4 first / 2 other, unique points, tie-breaks | **FAIL (weak)** | Cost sum, colour bonus, completion split, and the D3-6 tie-break hold; the Ivory Tower’s unique count is wrong for an undeclared Haunted Quarter (D4-6). |
| 5 | Hidden information never crosses `project`; two peers converge | **PASS** | The redaction and convergence tests are green; `project` still omits deck, draft, pool, facedown, and other hands. Card *conservation* is broken by D4-3, which is a state-integrity defect rather than a redaction one. |
| 6 | No unverified file; `vp test` and `vp typecheck` green | **FAIL** | `tsc` is green, but the suite goes red the moment `verification4.test.ts` is added (9 failed | 616 passed). |

## What is verified vs unverified

**Verified:** the deck catalog; the registries are total; genesis deals and
conserves; the draft is hidden and its face-up count matches the catalog at every
seat count (3/4/5/6 seats, 8- and 9-character casts); the phase machine reaches
terminal for 3-6 seats, three casts, and all six rulebook preset casts; the drain
reaches every “any” window (V2-1); the naming sub-machine records through the
engine; the colour bonus, the cost sum including beautify, and the 4/2 completion
split; the D3-6 tie-break (highest revealed rank, then district points, then
gold); codec round-trip; convergence; `tsc` green; the D1..D14, V2-1..V2-9, and
D3-1..D3-7 fixes hold; six sampled guards turn RED when their behaviour is
removed.

**Unverified / broken:** the Witch’s held turn (D4-1, D4-1b); the Tax Collector’s
2-3 player clause (D4-2); the Museum’s cards on destroy (D4-3); the Blackmailer’s
threat ordering (D4-4); the Bishop’s shield against the Marshal and Diplomat
(D4-5); the Ivory Tower’s Haunted Quarter reading (D4-6); the Magistrate against a
card-paid Thieves’ Den (D4-7). Three guards remain theater (Navigator card branch,
Spy gold clause, Thief loot).

## Verdict on the done predicate

The module does not meet the done predicate. Clauses 2, 3, and 4 are false, and
clause 6 is green only because the suite does not fold a game that exercises the
uncovered clauses. The three prior passes closed “does the engine reach it?” for
windows, scorers, and one windowless branch; this pass shows the same gap persists
for the Witch’s *held* turn (a stack-order defect, not a missing window), for the
rank-8 characters other than the Warlord, for the 2-3 player tax clause, for the
destroy path’s card handling, and for the Blackmailer’s gather ordering.

## What a human should still scrutinize

1. **The held-turn stack (D4-1, D4-1b).** `applyCall` gives every character the
   round’s turn window below the resolve step. A character whose ability must
   *suppress* its own build (the Witch) or replace its turn must strip that
   window, as `navigator.ts`’s `withoutBuild` does. The Witch does not. Fixing it
   means reconciling the Witch’s fixed gather with the turn window’s gather so the
   Witch gathers exactly once.
2. **The rank-8 shield (D4-5).** `bishopShield` is one query read by one
   character. Every rank-8 effect (Warlord, Marshal, Diplomat) must consult it;
   sweep `characters/*.ts` for abilities the Bishop’s clause names.
3. **The gather/threat order (D4-4).** `applyCall`’s `withThreat` and the
   Blackmailer’s bribe both read gold at the wrong moment. The rule is “gather,
   then resolve the threat.”
4. **Per-character vs per-seat state (D4-2).** `chargeBuildTax` and any other
   “holder is exempt” clause must key on the *character* in play, not the seat, in
   2-3 player games where a seat holds two characters.
5. **Destroy-path card handling (D4-3).** Every path that removes a city card
   (`warlordResolve`, `armoryResolve`, Framework/Necropolis destroy) must carry
   the card’s `cards` array to the deck. A single helper would encode this.
6. **The declared-type readers (D4-6).** `typeOfPlaced` is the module’s one type
   reader; the Ivory Tower’s Haunted Quarter special-case disagrees with it and
   with the Wishing Well. Decide the undeclared-Haunted-Quarter case once and make
   every scorer agree.
7. **Guard honesty (theater rows).** The Navigator, Spy, and Thief guards assert
   reachability or a single field, not the move. Add an assertion per clause the
   guard claims to pin.

## Appendix: exact verify output

```
$ scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification4.test.ts --own shared/core/tests/lockstep/citadels/verification4.test.ts
== vitest (the gate) ==
…
 Test Files  1 failed (1)
      Tests  9 failed (9)
VERIFY FAILED: vitest
```

```
$ vp test shared/core/tests/lockstep/citadels/
 Test Files  1 failed | 76 passed (77)
      Tests  9 failed | 616 passed (625)
```

The 9 red tests, in file order: D4-1 (Witch build), D4-1b (Witch gather), D4-2
(Tax Collector), D4-3 (Museum cards), D4-4 (Blackmailer order), D4-5 (Marshal),
D4-5 (Diplomat), D4-6 (Ivory Tower), D4-7 (Thieves’ Den).
