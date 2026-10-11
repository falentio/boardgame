# Citadels game definition: ninth independent verification

Verifier: review sub-agent (adversarial, ninth pass). I did not write this
module. Source head under review: `feat/citadels-game-definitions`, worktree
`/home/kevin/.t3/worktrees/boardgame/t3-a32da114`. Head `f0b5725` (the brief
names `773ad39`; HEAD has moved two commits past it — both are the fix8 guard
rows, and the tree I reviewed is the current HEAD). The citadels suite is green
at 81 files / 653 tests before my file lands.

Product: this report plus
`shared/core/tests/lockstep/citadels/verification9.test.ts` — 2 counterexamples,
each failing against this head, plus 3 positive probes.

## Verdict

**FAIL.** The eighth-pass fix is real and its two clauses hold — I re-proved the
D8-1 resume declaration across all 27 bewitched characters (below) and the D8-2
give-choice is red on revert (teeth audit). But the sixth-pass turn-model rewrite
(gather-then-build, D6-2) reshaped the Museum's once-per-turn placement offer, and
two turn shapes break the contract the offer relies on:

1. **D9-1** — the Alchemist's two-pass settle (the V2-7 refund) deliberately
   leaves a **non-null** pending standing when the turn closes. The Museum's
   placement offer then opens a `keep` window on top of that pending, and
   `resolveKeep` routes it to the *gather-keep* branch (it tells the two apart by
   a bare pending). The Alchemist's spend pending is overwritten, so **the refund
   never lands AND the card is never tucked** — two clauses lost to one misroute.
2. **D9-2** — the Navigator's turn returns early from `resolveTurn` (its gain
   choice, no build) without ever reaching `closeTurn`/`withMuseumOffer`, so a
   Navigator owning a Museum **never gets its once-per-turn placement offer**.

Both are the "one clause beside a fix that just landed" pattern: D9-1 sits beside
the V2-7 Alchemist settle and the D6-2 Museum offer; D9-2 sits beside the
Navigator early-return the D7-1 fix reshaped. Neither is caught by any guard.

## How to reproduce

```
scripts/citadels-verify.sh \
  shared/core/tests/lockstep/citadels/verification9.test.ts \
  --own shared/core/tests/lockstep/citadels/verification9.test.ts
# => VERIFY FAILED: vitest   (Tests 2 failed | 3 passed (5))
```

Whole citadels suite with this file added:

```
vp test shared/core/tests/lockstep/citadels/
# => Test Files  1 failed | 81 passed (82)
#    Tests  2 failed | 656 passed (658)
```

`npx tsc -p tsconfig.citadels.json` is green (rc=0).

## Defects (each has a failing test in verification9.test.ts)

### D9-1 — an Alchemist that builds loses its refund when it owns a Museum

`tryBuild` records the gold a build paid on the turn-local pending
(`recordAlchemistSpend`, helpers.ts:485) so the Alchemist's end-of-turn resolve
can refund it. The Alchemist's effect arms that pending with `character:
"alchemist"`, `note: null`, `gold: <spend>` and runs its end pass from a
`resolve` step (characters/alchemist.ts). `resolveTurn`'s `closeTurn` then
calls `withMuseumOffer` (helpers.ts:~775), which appends a `keep` window for the
owner when their city holds a Museum. `resolveKeep` distinguishes the Museum's
offer from the gather keep by a **bare pending**:

```ts
// helpers.ts resolveKeep
if (pending === null) {
  return withSteps(museumPlace(ctx.state, seat, action), rest);
}
```

The Alchemist's build leaves pending **non-null**, so the Museum's `keep` window
falls into the gather-keep branch: it reads `pending.cards` (empty), computes a
keep count, and **replaces** the pending with `turnGatheredPending(seat)`. The
Alchemist's `gold: <spend>` is gone, so the end-of-turn `resolve` (which reads
`pending.gold`) refunds 0; and because `museumPlace` is never called, the tuck
never happens.

Counterexample: *"D9-1 an Alchemist that builds still gets its refund and its
Museum tuck"*. Control (no Museum): ANN holds the Alchemist, city empty, gold 0,
hand `[market]`; the turn gathers 2, builds the cost-1 Market (2 -> 1), and the
V2-7 settle refunds the 1 — **gold 2** (the control passes, so the V2-7 clause
holds). With a Museum and hand `[market, tavern]`: measured **gold 0** (the
refund lost) and **`museum.cards === undefined`** (the tuck lost). Expected:
gold 2 and one tucked card.

Mechanism trace (measured): after the build, `pending = {character:"alchemist",
note:null, gold:2}`; the next window is `keep`; after it resolves the pending is
`turn-gathered` and the purse is still 0.

Root-cause probe (in a `/tmp` copy): route a non-null Alchemist settle pending to
`museumPlace` in `resolveKeep` (`pending === null || (pending.note === null &&
pending.character === 'alchemist' && pending.cards.length === 0)`) and D9-1 flips
green (2 failed -> 1 failed), control still green; restoring the copy returns it
to red. No source file in the shared worktree was touched.

### D9-2 — a Navigator owning a Museum is never offered its placement

`resolveTurn` handles the Navigator before the build-window machinery:

```ts
// helpers.ts resolveTurn
if (playedCharacter === "navigator") {
  const note = action?.t === "draw" ? NAVIGATOR_CARDS_NOTE : null;
  return withSteps(withPending(state, { ...emptyPending(seat, "navigator"), note }), rest);
}
```

This early return never reaches `closeTurn`/`withMuseumOffer`, so a Navigator's
turn opens no `keep` window for a Museum in its city. rules.json (museum): "Once
per turn, place a card from your hand under the Museum." The Navigator's turn is a
turn; the offer must fire.

Counterexample: *"D9-2 a Navigator owning a Museum is offered its once-per-turn
placement"*. Setup: ANN holds the Navigator, city `[museum]`, hand `[market,
tavern]`; the turn is folded and every `keep` window answered. Measured: **no
`keep` window ever opened** (measured purposes `["turn","warlord-destroy",
"turn","turn"]`) and `museum.cards === undefined`. Expected: a `keep` offer and
one tucked card. The positive probe P2 shows a King owning a Museum does tuck —
only the Navigator's early-return path misses it.

Root-cause probe (in a `/tmp` copy): (a) give the Navigator branch a
`[RESOLVE, ...withMuseumOffer(...)]` continuation and (b) route the Navigator
pending in `resolveKeep` to `museumPlace`. With both edits D9-2 flips green
(2 failed -> 1 failed); with neither it stays red. The two edits together are the
fix shape: the offer must be *opened* and the offer's pending must be
*distinguished*.

## The teeth audit

Method: `cp -r` the worktree to `/tmp/citadels-v9`, patch one source file in the
copy, re-run the named guard with `-t`, record RED/GREEN, restore. No git command
ran in the shared worktree. 17 probes: 11 forward (revert the fix, the guard must
redden) and 7 reverse (remove the behaviour, the guard must redden). Every probe
that changed a file turned RED; four patches that matched no source text are
reported as PATCH-NOOP and were re-aimed.

### Forward (revert/neuter the fix, the guard must redden)

| # | Guard | Reverted | Result |
|---|-------|----------|--------|
| F1 | engine-coverage "the Witch's resume declares the School of Magic of a two-character seat" (the D8-1 guard row) | witch.ts resume `declareSchoolOfMagic` removed | **RED** |
| F2 | engine-coverage "the Theater owner gives the claim it chooses from a two-character seat" (the D8-2 guard row) | theater.ts `giveIndex` forced to 0 | **RED** |
| F3 | engine-coverage "the engine reaches navigator" | `NAVIGATOR_GOLD` 4 -> 2 | **RED** |
| F4 | engine-coverage "the engine reaches spy" | `transferGold` -> no-op | **RED** |
| F5 | engine-coverage "the engine reaches thief" | `loot` -> 0 | **RED** |
| F6 | engine-coverage "the engine reaches keep" | `keepProtects` -> false | **RED** |
| F7 | engine-coverage "the engine reaches great-wall" | toll -> 0 | **RED** |
| F8 | engine-coverage "the engine reaches trader" | income -> no-op | **RED** |
| F9 | engine-coverage "the Laboratory discards one card for two gold, once" | `REWARD` 2 -> 0 | **RED** |
| F10 | engine-coverage "the engine reaches cardinal" | `coverShortfall` -> no-op | **RED** |
| F11 | engine-coverage "the engine reaches magistrate" | decoys emptied | **RED** |

All eleven forward probes turn RED. In particular the two new two-character-seat
rows (F1, F2) are sharp: each reddens on revert, so the pass-8 guard gap is
genuinely closed for those two clauses.

### Reverse (remove the behaviour, the guard must redden)

| Guard | Behaviour removed | Result |
|-------|-------------------|--------|
| engine-coverage "the engine reaches observatory" | draw-three -> draw-two | **RED** |
| engine-coverage "the engine reaches secret-vault" | `legal:false` -> `{}` | **RED** |
| engine-coverage "the engine reaches wizard" | `moveCard` -> null | **RED** |
| engine-coverage "the engine reaches monument" | five-district gate -> open | **RED** |
| engine-coverage "the engine reaches alchemist" | refund -> no-op | **RED** |
| engine-coverage "the engine reaches blackmailer" | first threat -> none | **RED** |
| engine-coverage "the Poor House pays one gold to an empty purse, once" | `POOR_HOUSE_GOLD` 1 -> 0 | **RED** |

Every sampled guard that pins behaviour turns RED in both directions.

### No guard stayed green

Unlike pass 8, this pass found no redundant-mirror probe. The one PATCH-NOOP set
(F6/F7/F9/F10/R1/R2/R4/R5/R6) was a string-matching artifact of my sed anchors
(the real source text differs), not a guard weakness: each re-aimed probe reddens.

### The guard-file gap (does any policy avoid the ability it pins?)

The two new two-character rows fold a two-character seat and are sharp (F1, F2).
But the Museum dimension is unguarded: no guard row folds a *character turn that
owns a Museum*, and no `DISTRICT_GUARDS` row exists for the Museum (it declares no
trigger; its placement rides the `keep` window). So neither D9-1 nor D9-2 is
reachable by the guard suite — the same structural gap the last four passes each
named, now one dimension further out (character-turn × district-offer, not just
character × two claims).

## Done-predicate clause-by-clause

| # | Clause | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | Full game reaches terminal (one winner) for 3-6 seats | **PASS** | Integration folds 3/4/5/6 seats and the three casts; my fold sweep also reaches terminal for 2-7 seats with the deck conserved at 68. |
| 2 | Every character implemented with a behavioral test | **FAIL** | D9-1: an Alchemist that builds loses its refund whenever its city holds a Museum. D9-2: a Navigator owning a Museum never gets its placement. |
| 3 | Every district implemented with a test per unique effect | **FAIL** | D9-1/D9-2: the Museum's once-per-turn offer is dead for two turn shapes; the Museum unit test calls `museumPlace` directly and never folds a real turn that also builds or plays the Navigator. |
| 4 | Exact scoring: cost sum, five-type bonus, 4 first / 2 other, unique points, tie-breaks | **PASS** | The prior scorers hold; the colour bonus, declared-type scorers, completion split, and revealed-rank tie-break are green; the D9-1 lost refund is an income defect, not a scoring one. |
| 5 | Hidden information never crosses `project`; two peers converge | **PASS** | Integration covers 3-6 seats; convergence and redaction re-proved at 2 and 7 seats by the prior passes and re-read here. |
| 6 | No unverified file; `vp test` and `vp typecheck` green | **FAIL** | `tsc -p tsconfig.citadels.json` is green, but the suite goes red the moment `verification9.test.ts` is added (2 failed | 656 passed). |

## What is verified vs unverified

**Verified:** the deck catalog and character summaries (all 27 re-read against
rules.json — faithful paraphrases, no prose defect surfaced); genesis deals and
conserves (68 cards, terminal at 2-7 seats); the draft spare at 2/3/4/5/6/7 seats
(`perSeat` = 2 for <=3 seats; discards 4/2/3/2/1/1 as the catalog says); the
two-character differential across all 27 characters (gold/hand/city match sole vs
second claim, including a School of Magic and a Museum in the city, save the two
defects below); the School-of-Magic declaration at turn open, on the threatened
seat's gather, and on the Witch's resume as each of the 27 bewitched characters
(declared type correct for all 11 income characters); the Tax Collector's
per-character exemption across two claims (a Tax Collector acting pays no tax, the
same seat building with its other character pays); the D8-1 and D8-2 clauses (their
guard rows redden on revert); `tsc` green; the D1..D8 families hold.

**Unverified / broken:** the Museum's placement offer whenever the owner's turn
leaves a non-null pending (D9-1, the Alchemist) or returns early (D9-2, the
Navigator). Neither is reachable from any guard.

## What a human should still scrutinize

1. **The D9-1 fix shape.** The Museum's offer must be told apart from the gather
   keep by something other than "pending is null". Options: give the offer its own
   `WindowPurpose` (a shared-file change in `state.ts`), or have `withMuseumOffer`
   carry a marker the `keep` resolver reads. The Alchemist's settle pending is the
   only character path that leaves a non-null pending at turn close *after a build*,
   so a narrow fix is possible, but the bare-pending sentinel is fragile.
2. **The D9-2 fix shape.** The Navigator's early return needs the same
   `withMuseumOffer` continuation `closeTurn` builds, and `resolveKeep` must route
   the Navigator's own pending to `museumPlace`. The Navigator cannot build, so
   this is purely the offer's own window.
3. **The Witch's held turn.** When the Witch's city holds a Museum, her *held* turn
   (her own rank) skips the offer entirely; she only gets it on the resume. If the
   bewitched character is not in play she never resumes, so she gets no Museum
   placement that round. rules.json (witch) says her turn is "put on hold", which
   arguably justifies one offer at the resume — but a human should rule on whether
   the held turn owes a placement when no resume follows.
4. **The guard-file gap.** `engine-coverage.test.ts` should fold at least one
   character turn that owns a Museum (and a build on the Alchemist's turn) so this
   family cannot regress silently. The two-character rows closed the pass-8 gap;
   the district-offer dimension is still open.

## Appendix: exact verify output

```
$ scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification9.test.ts \
    --own shared/core/tests/lockstep/citadels/verification9.test.ts
== vitest (the gate) ==
 ❯ shared/core/tests/lockstep/citadels/verification9.test.ts (5 tests | 2 failed)
   × D9-1 an Alchemist that builds still gets its refund and its Museum tuck
   × D9-2 a Navigator owning a Museum is offered its once-per-turn placement
 Test Files  1 failed (1)
      Tests  2 failed | 3 passed (5)
VERIFY FAILED: vitest
```

```
$ vp test shared/core/tests/lockstep/citadels/
 Test Files  1 failed | 81 passed (82)
      Tests  2 failed | 656 passed (658)
```

The 2 red tests, in file order: D9-1, D9-2. The 3 green: P1, P2, P3.
