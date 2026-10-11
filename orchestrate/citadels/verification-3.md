# Citadels game definition: third independent verification

Verifier: review sub-agent (adversarial, third pass). I did not write this
module. Source head under review: `feat/citadels-game-definitions`, worktree
`/home/kevin/.t3/worktrees/boardgame/t3-a32da114`. The source head is
`e0ab5a4` (the guard wave); the worktree tip when I wrote this is `d3138b8`,
which touches only `orchestrate/citadels/**` and no source file, so both are the
same module.

Product: this report plus
`shared/core/tests/lockstep/citadels/verification3.test.ts` — 10 tests, 8 of
which fail against this head and name a defect; the other 2 are positive probes
that pass here but turn red when the behaviour they pin is broken.

## Verdict

**FAIL.** Both prior passes were right, and their fixes are real: the drain now
uses `windowOwed` (V2-1 fixed), the Blackmailer assigns threats (V2-2), the
double end-turn is gone (V2-3), the Thieves' Den debits its gold share (V2-4),
the Trader and Emperor honour `declaredType` (V2-5), the Diplomat pays the Great
Wall toll (V2-6), the Alchemist refunds its build spend (V2-7), the Armory opens
its window (V2-8), the Museum decline places nothing (V2-9). All 15 second-pass
counterexamples pass. The 606-test suite is green.

But the module still has eight real defects a third pass can reach, and they
cluster where the two prior passes did not look: the **end-game scorers that
read the catalog flag instead of the declared type**, one **character branch that
is unreachable through the engine**, one **setup clause that removes a character
too many**, and the **tie-break**. None is a repeat of D1..D14 or V2-1..V2-9; each
is a clause one step to the side of a fix that landed.

## How to reproduce

```
scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification3.test.ts --own shared/core/tests/lockstep/citadels/verification3.test.ts
# => VERIFY FAILED: vitest   (Tests 8 failed | 2 passed (10))
```

Whole citadels suite with this file added:

```
vp test shared/core/tests/lockstep/citadels/
# => Test Files  1 failed | 75 passed (76)
#    Tests  8 failed | 608 passed (616)
```

`tsc -p tsconfig.citadels.json` is green (rc 0).

## Re-running the prior passes

The first pass's 14 counterexamples and the second pass's 15 all pass against
this head. The V2 fixes hold where the guard wave covers them (see the teeth
audit). This pass adds no duplicate of a prior finding.

## Defects (each has a failing test in verification3.test.ts)

### D3-1 — the Navigator's four-card branch is unreachable through the engine (blocking)

`characters/navigator.ts` selects its card branch from
`pending.note === NAVIGATOR_CARDS_NOTE`, but `applyCall` arms pending with
`note: null`, and nothing in the engine ever writes that note: there is no
`navigator-*` member of `WINDOW_PURPOSES`, no resolver, and no action that
sets it. So a real game always takes the four-gold branch and the rulebook's "or
draw four cards" is dead. The unit test hand-writes the note
(`withPending(..., note: NAVIGATOR_CARDS_NOTE)`), so it stays green, and the
folded guard's Navigator row (`goldDelta === 4`) is satisfied by the gold branch.

Counterexample: *"D3-1 the Navigator's four-card branch is reachable through the
engine"*. Measured: a folded Navigator turn with a card gather yields hand delta
0 and gold delta 4 (fold purposes `[null, draft-pick]` — no choice window ever
opens).

Note: the catalog summary (`characters.ts`) says "draw 4 cards and keep 1" while
`rules.json` says "four cards"; the effect draws four into hand. The reachability
defect holds under either reading; the summary text should be reconciled.

### D3-2 — the Capitol counts the catalog type, not the declared type

`districts/capitol.ts` counts `specOfDistrict(id).type`. The colour bonus in
`scoring.ts` deliberately reads `typeOfPlaced` so a declared type counts. The
Capitol disagrees with the module's own type reader: a School of Magic declared
trade alongside a Tavern and a Market is three trade districts and must earn the
Capitol's +3.

Counterexample: *"D3-2 the Capitol counts a district of a declared type"*.
Measured: unique points 0 (expected 3).

### D3-3 — the Basilica ignores the Artist's beautify marker

`districts/basilica.ts` tests `specOfDistrict(id).cost % 2`, while
`scoring.ts`'s `costSum` counts a beautified district at `cost + gold` ("a
beautified district counts +1"). A Market (cost 2) carrying one beautify gold is
a cost-3 (odd) district and must earn the Basilica a point. The module is
internally inconsistent: the cost sum raises the district's value, the Basilica
does not see the raise.

Counterexample: *"D3-3 the Basilica counts a beautified district's raised cost"*.
Measured: unique points 0 (expected 1).

### D3-4 — the Wishing Well and the Ivory Tower count the catalog flag, not the declared type

Both `districts/wishing-well.ts` and `districts/ivory-tower.ts` ask whether a
district is unique via `specOfDistrict(id).unique`. Once a Haunted Quarter or
School of Magic declares a non-unique type, `typeOfPlaced` reports that type, so
it is no longer a unique — and the Ivory Tower already special-cases the Haunted
Quarter for exactly this reason, but neither handles the School of Magic, and the
Wishing Well handles neither.

Counterexamples: *"D3-4 the Wishing Well does not count a re-typed unique as
unique"* (measured 2, expected 1) and *"D3-4 the Ivory Tower scores when a
re-typed unique stands beside it"* (measured 0, expected 5).

### D3-5 — the draft removes one character too many

`setup.ts`'s `buildDraft` sets the passing pool to exactly the number of picks
(`remaining = pool.length - seats * perSeat`), so the last picker is forced.
The catalog's setup numbers leave `seats + 1` characters in the pool for 4-7
players ("4 players: 2 faceup, 1 facedown" = 3 removed from 8 = 5 left for 4
players; "5 players: 1 faceup, 1 facedown" = 6 left; "6 players: 0 faceup, 1
facedown" = 7 left), so the last drafter has a choice of two. The module removes
one extra and, with a rank-9 character in play, shows one face-up discard too
many.

Counterexample: *"D3-5 the draft discards no more face-up characters than the
catalog allows"*. Measured: 4-player base cast 3 face-up (catalog 2); 4-player
rank-9 cast 4 face-up (catalog 3). The passing pool is 4 where the catalog
implies 5.

### D3-6 — winnerOf uses the wrong tie-break

`scoring.ts`'s `winnerOf` breaks ties on district points, then gold, and returns
`null` on a full tie. The catalog's rule is "the tied player who revealed the
highest-numbered rank in the last round wins" — information the state already
carries in `claimed`. The module's own integration test
(`documentedWinner`) encodes the wrong rule, so it cannot catch this.

Counterexample: *"D3-6 winnerOf breaks a tie by the highest revealed rank, not
gold"*. Two seats tie on total (8), district points (6), and gold (2); the
catalog awards the win to the seat that revealed the rank-8 Warlord over the
rank-4 King. Measured: `null` (expected the rank-8 holder).

### D3-7 — the Haunted Quarter's type choice is dead through the engine

`districts/haunted-quarter.ts` reads its chosen type from `pending.namedType`,
but the district declares no trigger (`hauntedQuarterTriggers === []`) and no
window purpose lets its owner name a type. A Haunted Quarter in a real game
always scores as its catalog type, unique, so the colour it is meant to supply
can never be chosen. Its unit test hand-writes the `Pending` record with a
`namedType`.

Counterexample: *"D3-7 a seat owning the Haunted Quarter can choose its counted
type"*. Measured: a folded turn with a Haunted Quarter in the city never opens a
`choose-type` window and the card's `declaredType` stays `undefined`.

## The teeth audit

The guard wave added `engine-coverage.test.ts` (59 tests). I copied the worktree
to `/tmp/citadels-v3`, reverted each named fix in the copy by editing the source
directly (the copy's `.git` points at the shared gitdir, so I never ran git
there), re-ran the guard, and restored. Seven probes; six required by the brief
plus one extra:

| # | Guard under test | Reverted | Guard result |
|---|------------------|----------|--------------|
| P1 | Assassin kill (character guard + folded naming guard) | `cb626cf` — `windowOwed` back to `owedFor` in `drain` | **RED** — 9 failed (assassin, thief, witch, magistrate, spy + 4 naming folds) |
| P2 | Armory destroy window | `d649c7f` — `applyEndTurn` no longer fires `onDestroy` | **RED** — 3 failed (armory, great-wall, keep) |
| P3 | Alchemist refund | `d649c7f` — `recordAlchemistSpend` forced to a no-op | **RED** — 1 failed (alchemist) |
| P4 | end-of-turn once-per-turn (Laboratory) | `cb626cf` — `endTurnThen` always prepends `END_TURN` | **RED** — 11 failed (alchemist + laboratory, smithy, park, poor-house, great-wall, keep) |
| P5 | Thieves' Den gold share | `d649c7f` — `gold -= goldShare` removed | **RED** — 1 failed (thieves-den) |
| P6 | Keep protection | `keepProtects` forced to `false` in the Warlord | **GREEN** — the Keep guard only asserts the `onDestroy` hook was *called*, not that it protects; behavior removal is invisible |
| P7 | Trader declared-type income | `trader.ts` reverted to `specOfDistrict(...).type` | **GREEN** — the Trader guard's board uses a catalog Tavern, not a declared School of Magic, so the clause is uncovered |

Reverse direction (non-tautology): the character and district guards assert
behaviour (gold deltas, city contents, window purposes, card counts), not wiring,
and P1-P5 show they turn red when the behaviour is removed. Two guards do not:
the **Keep** and **Great Wall** rows assert only `calls === 1` — that the
`onDestroy` effect function ran, which is wiring, and P6 shows it cannot fail on
the behaviour. The **Trader** row is behavioural but does not cover the
`declaredType` clause (P7).

Both blind-spot behaviours are pinned by the two passing positive probes at the
end of `verification3.test.ts`; I confirmed each turns red when its behaviour is
removed (Keep: 1 failed; Trader: 1 failed).

## Done-predicate clause-by-clause

| # | Clause | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | Full game reaches terminal (one winner) for 3-6 seats | **PASS (weak)** | Folds to `phase: "over"` for 3/4/5/6 seats and three casts; the integration suite is green. The tie-break is wrong (D3-6), so the *winner* is not always the rulebook's. |
| 2 | Every character implemented with a behavioral test | **FAIL** | 27 files and 27 tests exist, but the Navigator's four-card branch never runs through the engine (D3-1); the unit test hand-writes the pending note. |
| 3 | Every district implemented with a test per unique effect | **FAIL** | 30 files and 30 tests, but the Haunted Quarter's type choice is dead through the engine (D3-7); the Capitol, Basilica, Wishing Well, and Ivory Tower scorers mis-read the declared type or the beautify marker (D3-2..D3-4). |
| 4 | Exact scoring: cost sum, five-type bonus, 4 first / 2 other, unique points, tie-breaks | **FAIL** | Cost sum, colour bonus, and completion split are right; the unique scorers do not honour the declared type or the beautify marker (D3-2..D3-4), and the tie-break is the wrong rule (D3-6). |
| 5 | Hidden information never crosses `project`; two peers converge | **PASS** | `project` omits deck, draft, pool, facedown, and other hands; the convergence and redaction tests are green. The draft leak is a *setup* excess (D3-5), not a redaction failure. |
| 6 | No unverified file; `vp test` and `vp typecheck` green | **FAIL (weak)** | `tsc` is green and the suite is green only because no test folds a real game and asserts the Navigator's card branch, the declared-type scorers, or the Haunted Quarter's choice. `vp test` goes red the moment `verification3.test.ts` is added. |

## What is verified vs unverified

**Verified:** the deck catalog; the registries are total; genesis deals and
conserves; the draft is hidden (though over-discards, D3-5); the phase machine
reaches terminal for 3-6 seats and 3 casts; the drain now reaches every "any"
window (V2-1); the Blackmailer, Thief, Assassin, Witch, Spy, and Magistrate name
through the engine; the colour bonus and 4/2 completion split; the cost sum
including beautify; codec round-trip; convergence; `tsc` green; the D1..D14 and
V2-1..V2-9 fixes hold.

**Unverified / broken:** the Navigator's card branch (D3-1); the Capitol,
Basilica, Wishing Well, and Ivory Tower scorers' declared-type and beautify
handling (D3-2..D3-4); the draft discard count and last-picker choice (D3-5); the
tie-break (D3-6); the Haunted Quarter's type choice (D3-7); the Keep and Great
Wall guards as *behavioral* guards (theater, P6).

## Verdict on the done predicate

The module does not meet the done predicate. Clauses 2, 3, and 4 are false, and
clause 6 is green only because the suite does not fold a game that exercises the
uncovered clauses. The prior passes closed the "does the engine reach it?" gap
for windows; this pass shows the same gap persists for a windowless character
branch, for the type-aware scorers, and for a district whose choice rides a
window that no purpose provides.

## What a human should still scrutinize

1. **The declared-type readers (D3-2..D3-4).** `typeOfPlaced` is the module's one
   type reader; the colour bonus uses it, four unique scorers do not. Any
   "counts as" clause (Capitol "three of one type", Wishing Well and Ivory Tower
   "unique district", Basilica "odd cost") must agree with `typeOfPlaced` and
   with the beautified cost. Sweep every `specOfDistrict(...).type/.unique/.cost`
   reader in `districts/` and `characters/` and decide each one.
2. **Windowless abilities (D3-1, D3-7).** The engine's only channel for a
   character's choice with no window is a hand-written `pending.note`. Two
   abilities ride that channel and neither is reachable through a real fold: the
   Navigator's card branch and the Haunted Quarter's type choice. A folded-game
   assertion per branch (not per character) is the fix.
3. **The draft count (D3-5).** `remaining = pool.length - seats * perSeat` removes
   one character too many for 4-7 players; the catalog leaves `seats + 1`. This
   changes the last picker's choice and the public discard pile, and no test
   asserts the count.
4. **The tie-break (D3-6).** The catalog rule (highest revealed rank) and the
   module rule (district points, then gold) are different; the module's own test
   encodes the wrong one. Fixing it means changing a shared test
   (`integration.test.ts`), so the coordinator must serialize it.
5. **Guard honesty (P6, P7).** Two of the new guards assert wiring, not behaviour.
   A guard that only counts effect calls is theater; count the guards that assert
   a move.
