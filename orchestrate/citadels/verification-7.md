# Citadels game definition: seventh independent verification

Verifier: review sub-agent (adversarial, seventh pass). I did not write this
module. Source head under review: `feat/citadels-game-definitions`, worktree
`/home/kevin/.t3/worktrees/boardgame/t3-a32da114`. Module head `fbf19a6`;
worktree tip `b12869b`, which touches only `orchestrate/citadels/**`, so both
are the same module. The citadels suite is green at 79 files / 639 tests before
my file lands.

Product: this report plus
`shared/core/tests/lockstep/citadels/verification7.test.ts` — 7 counterexamples,
each failing against this head.

## Verdict

**FAIL.** The six prior passes were right and their fixes hold: all 14 first-pass,
15 second-pass, 10 third-pass, 9 fourth-pass, 8 fifth-pass, and the sixth-pass
counterexamples pass against this head, and the D6-1 (Cardinal duplicate-card
gift) and D6-2 (gather-then-build) fixes are real and reachable. The teeth audit
also confirms the four rows the sixth pass found weak are now sharp: each reddens
on revert.

But the gather-then-build turn model — the largest change yet — exposed a latent
defect family that every prior pass missed, because every prior pass folded
one-character-per-seat games. **In a 2- or 3-player game each seat drafts TWO
characters** (catalog "Setup numbers"; `setup.ts` `buildDraft` sets
`perSeat = 2` for three or fewer seats). The engine's rank cursor calls the
correct character, but seven per-character clauses read the seat's **first claim**
(`claimOf`) instead of the character actually in play. Whenever the acting
character is not the seat's lowest-rank claim, the clause misfires. The engine
already computes the correct value as `activeCharacterOf`; these clauses do not
use it.

Seven counterexamples, one per clause, all measured red on head and all measured
green when the clauses are switched to the acting character (the root-cause
probe in "How to reproduce"). This is a whole-family defect, not seven
independent bugs.

## How to reproduce

```
scripts/citadels-verify.sh \
  shared/core/tests/lockstep/citadels/verification7.test.ts \
  --own shared/core/tests/lockstep/citadels/verification7.test.ts
# => VERIFY FAILED: vitest   (Tests 7 failed (7))
```

Whole citadels suite with this file added:

```
vp test shared/core/tests/lockstep/citadels/
# => Test Files  1 failed | 79 passed (80)
#    Tests  7 failed | 639 passed (646)
```

Root-cause probe: in a `/tmp` copy I replaced each `claimOf(state, seat)`
read listed below with an `activeCharacterOf(state, seat)` read (the same
`callRank - 1` / `characterAtRank` / `seatHolding` derivation `helpers.ts`
already uses). All 7 counterexamples flip green; restoring the copy returns all 7
to red. No source file in the shared worktree was touched.

## Defects (each has a failing test in verification7.test.ts)

The turn model is correct for one-character seats and every guard is green there.
Each defect below is the two-character case of the same rule.

### D7-1 / D7-1b — the Navigator's whole ability is skipped when it is the seat's second character

`helpers.ts resolveTurn` tests `claimOf(state, seat)?.character === "navigator"`
(helpers.ts:719) — the seat's first claim. When the Navigator is the seat's
higher-rank character the branch is skipped, so the turn takes the ordinary
two-gold gather and leaves a build window open. The Navigator gains 2 instead of
4 and may build, which `rules.json` (navigator) forbids: "Gain either four gold
or four cards ... You cannot build any districts this turn, not even districts
that would not count toward your building limit."

Counterexamples: *"D7-1 a Navigator that is the seat's second character still
gains four gold"* and *"D7-1b ... cannot build"*. Measured on head: gold 0 -> 2
(expected 4); the tavern build lands (expected the city empty). A real 3-player
deal reproduces it: a seat holding bishop+navigator gains 2 on the navigator turn.
Control (Navigator as the sole/lowest-rank claim): gold 0 -> 4 and no build.

### D7-2 — the Architect's three-build limit collapses to one

`helpers.ts buildLimit` reads `claimOf(state, seat)?.character` (helpers.ts:430).
An Architect that is the seat's higher-rank character gets the default limit of
one. `rules.json` (architect): "Your building limit this turn is three."

Counterexample: *"D7-2 an Architect that is the seat's second character may build
three"*. Measured on head: one district built (expected 3). Control (Architect as
the lowest-rank claim): three districts.

### D7-3 — the Wizard's duplicate-build permission is refused

`helpers.ts duplicateBlocked` reads `claimOf(state, seat)?.character`
(helpers.ts:446). A Wizard that is the seat's higher-rank character is denied the
duplicate build. `rules.json` (wizard): "During this turn you may build
districts identical to districts already in your city."

Counterexample: *"D7-3 a Wizard that is the seat's second character may build a
duplicate"*. Measured on head: one tavern (the duplicate was refused; expected
two). Control (Wizard as the lowest-rank claim): two taverns.

### D7-4 — the Alchemist's end-of-turn refund never records the build

`helpers.ts recordAlchemistSpend` tests `claimOf(state, seat)?.character !==
'alchemist'` (helpers.ts:488). An Alchemist that is the seat's higher-rank
character never records its build spend, so no refund lands. `rules.json`
(alchemist): "At the end of your turn, take back all the gold you paid to build
districts this turn."

Counterexample: *"D7-4 an Alchemist that is the seat's second character gets its
build spend back"*. Measured on head: gold 3 -> 1 (gather 2, pay 4 for the
castle, no refund; expected 5). Control (Alchemist as the lowest-rank claim):
gold 5.

### D7-5 — a threat on a seat's second character is silently dropped

`characters/blackmailer.ts resolveThreat` reads `claimOf(state, seat)?.character`
(blackmailer.ts:96), and `resolveReveal` reads `claimOf(state, victim)?.
character` (blackmailer.ts:126). When a seat's higher-rank character is
threatened, the bribe window never opens: the seat cannot bribe, and the marker is
cleared at end of round with no resolution. `rules.json` (blackmailer): "they
may bribe you by giving half their gold rounded down ... removing their marker."

Counterexample: *"D7-5 a threat on a seat's second character can be bribed
away"*. Measured on head: the threat marker `["merchant"]` survives the turn and
no gold moves to the Blackmailer. Control (threat on a one-character seat): the
marker clears and the bribe reaches the Blackmailer.

### D7-6 — the School of Magic re-declares the wrong colour during the gather

`districts/school-of-magic.ts incomeTypeOf` uses `state.claimed.find((entry) =>
entry.seat === owner)` — the seat's first claim. The turn-open declaration
(`declareSchoolOfMagic`) is correct, but the `onIncome` hook then overwrites it
with the wrong character's colour, so the acting character's own income misses the
school. `rules.json` (school-of-magic): "during resource gathering it counts as
a district of any one type you choose" — the acting character's type.

Counterexample: *"D7-6 the School of Magic keeps the acting character's colour
when it is the second character"*. Setup: a seat holds King (rank 4) and Bishop
(rank 5), active as the Bishop, with a School of Magic. Measured on head: the
card's `declaredType` is `noble` (the King's colour, from the first claim) and
the Bishop's income is short 1 gold (gold 0 -> 2; expected 3). Control (Bishop as
the lowest-rank claim): `religious`, gold 3.

## The teeth audit

Method: `cp -r` the worktree to `/tmp/citadels-v7`, patch one source file in
the copy, re-run the named guard with `-t`, record RED/GREEN, restore. No git
command ran in the shared worktree. Sixteen probes: the four rows the sixth pass
found weak, the guards the brief named, and the reverse direction on five.

### Forward (revert/neuter the fix, the guard must redden)

| # | Guard | Reverted | Result |
|---|-------|----------|--------|
| F1 | the engine reaches school-of-magic | `declareSchoolOfMagic` turn-open declaration neutered (D5-7) | **RED** (1 failed) |
| F2 | the engine reaches cardinal | the D5-6 shortfall branch removed | **RED** (1 failed) |
| F3 | the engine reaches blackmailer | the D5-5 threatened-build deferral removed | **RED** (1 failed) |
| F4 | the engine reaches witch | the D5-1..4 resume `RESOLVE` step removed from `resumeStack` | **RED** (1 failed) |
| F5 | the engine reaches navigator | `navigatorChoice` forced to `"gold"` | **RED** (1 failed) |
| F6 | the engine reaches spy | the `transferGold` clause removed | **RED** (1 failed) |
| F7 | the engine reaches thief | `loot` forced to 0 | **RED** (1 failed) |
| F8 | the engine reaches keep | `keepProtects` forced to `false` | **RED** (1 failed) |
| F9 | the engine reaches great-wall | `greatWallToll` forced to 0 | **RED** (1 failed) |
| F10 | the Laboratory discards one card for two gold, once | `discardFirst` neutered | **RED** (1 failed) |
| F11 | the Poor House pays one gold to an empty purse, once | the refill removed | **RED** (1 failed) |
| F12 | the engine reaches school-of-magic | **both** declaration paths removed | **RED** (1 failed) |
| F13 | the engine reaches observatory | the draw-three clause removed | **RED** (1 failed) |
| F14 | the engine reaches navigator | the card branch forced to gold | **RED** (1 failed) |

All fourteen forward probes turn RED. In particular the four rows the sixth pass
found GREEN (F1 school-of-magic turn-open timing, F2 cardinal shortfall, F3
blackmailer deferral, F4 witch resume `RESOLVE`) are now sharp: each reddens on
revert. The sixth pass's T1–T4 guard gaps are closed.

### Reverse (remove the behaviour, the guard must redden)

| Guard | Behaviour removed | Result |
|-------|-------------------|--------|
| the engine reaches observatory | the draw-three clause | **RED** |
| the engine reaches monument | the five-district gate | **RED** |
| the engine reaches secret-vault | the cannot-build refusal | **RED** |
| the engine reaches keep | `keepProtects` | **RED** |
| the Laboratory discards one card for two gold, once | the discard payout | **RED** |

Every sampled guard that pins behaviour turns RED in both directions. No guard
stayed green, so the teeth audit adds no finding this pass.

## Done-predicate clause-by-clause

| # | Clause | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | Full game reaches terminal (one winner) for 3-6 seats | **PASS** | The integration suite folds all six preset casts and the 3/4/5/6-seat sets to terminal; D7-1..6 corrupt the two-character economy but not termination. |
| 2 | Every character implemented with a behavioral test | **FAIL** | D7-1..D7-6: the Navigator, Architect, Wizard, Alchemist, Blackmailer, and School of Magic all misfire in the 2/3-player two-character case. Each character's own guard folds a one-character seat, so none reaches the branch. |
| 3 | Every district implemented with a test per unique effect | **PASS (weak)** | 30 files, 30 tests; sampled district guards redden on revert (F8, F9, F10, F11, F13, R1-R5). D7-6 shows the School of Magic guard does not fold a two-character seat. |
| 4 | Exact scoring: cost sum, five-type bonus, 4 first / 2 other, unique points, tie-breaks | **PASS** | The prior-pass scorers hold; the declared-type scorers and the revealed-rank tie-break are green. D7-6's mis-declaration does corrupt a declared-type score in the two-character case, but the scoring code itself is correct. |
| 5 | Hidden information never crosses `project`; two peers converge | **PASS** | Redaction and convergence tests green at the baseline. |
| 6 | No unverified file; `vp test` and `vp typecheck` green | **FAIL** | `tsc -p tsconfig.citadels.json` is green, but the suite goes red the moment `verification7.test.ts` is added (7 failed | 639 passed). |

## What is verified vs unverified

**Verified:** the deck catalog; genesis deals and conserves; the draft at 3-6
seats; the phase machine reaches terminal for 3-6 seats and the six preset casts;
the naming sub-machine; the colour bonus and declared-type scorers; the
revealed-rank tie-break; codec round-trip; convergence; `tsc` green; the D1..D14,
V2-1..V2-9, D3-1..D3-7, D4-1..D4-7, D5-1..D5-8, and D6-1/D6-2 fixes all hold
(their counterexamples green); the four sixth-pass guard gaps are closed (F1-F4
redden on revert); the sampled district/character guards have teeth in both
directions.

**Unverified / broken:** every per-character clause that reads the seat's first
claim instead of the acting character in the 2/3-player two-character case —
`helpers.ts` `resolveTurn` (Navigator), `buildLimit`, `duplicateBlocked`,
`recordAlchemistSpend`; `characters/blackmailer.ts` `resolveThreat` and
`resolveReveal`; `districts/school-of-magic.ts` `incomeTypeOf`. The
`chargeBuildTax` clause was fixed for exactly this reason in D4-2, which is the
in-codebase precedent the rest of the family should follow.

## What a human should still scrutinize

1. **The fix shape (D7-1..6).** The engine already has the correct derivation:
   `activeCharacterOf(state, seat)` (`callRank - 1` -> `characterAtRank` ->
   `seatHolding`). Every clause above should read it instead of `claimOf`. The
   one wrinkle is the `school-of-magic.ts` and `blackmailer.ts` imports: both
   files are in the district/character layer, and a runtime import back into
   `helpers.ts` closes a cycle the module already warns about. The coordinator
   owns the seam; the root-cause probe inlined the derivation to confirm the
   diagnosis without touching the shared file.
2. **Guard coverage (the root cause of the miss).** Every character and district
   guard folds a one-character seat (`claimed: [{ seat: ANN, character }]`) or a
   4-seat game, so the two-character branch is never reached. Each guard should
   add a two-character fold — the acting character as the seat's higher-rank claim
   — to pin the clause. This is the structural gap the seventh pass found.
3. **The `claimOf` sweep.** Grep for every `claimOf(...)` read in the module
   and ask whether it means "the seat's first claim" or "the character in play."
   The four `helpers.ts` sites, the two `blackmailer.ts` sites, and the one
   `school-of-magic.ts` site are the ones I proved wrong; `activeCharacterOf`
   itself (helpers.ts:394) and `chargeBuildTax` are the correct pattern.
4. **The character summaries.** I spot-checked the summaries against
   `rules.json`; the two-character `claimOf` family is the finding, not the
   prose. The summaries are paraphrases, not verbatim rules, and no test compares
   them to `rules.json`; a human may want to decide whether that is intended.

## Appendix: exact verify output

```
$ scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification7.test.ts \
    --own shared/core/tests/lockstep/citadels/verification7.test.ts
== vitest (the gate) ==
 ❯ shared/core/tests/lockstep/citadels/verification7.test.ts (7 tests | 7 failed) 43ms
   × D7-1 a Navigator that is the seat's second character still gains four gold
   × D7-1b a Navigator that is the seat's second character cannot build
   × D7-2 an Architect that is the seat's second character may build three
   × D7-3 a Wizard that is the seat's second character may build a duplicate
   × D7-4 an Alchemist that is the seat's second character gets its build spend back
   × D7-5 a threat on a seat's second character can be bribed away
   × D7-6 the School of Magic keeps the acting character's colour when it is the second character
 Test Files  1 failed (1)
      Tests  7 failed (7)
VERIFY FAILED: vitest
```

```
$ vp test shared/core/tests/lockstep/citadels/
 Test Files  1 failed | 79 passed (80)
      Tests  7 failed | 639 passed (646)
```

The 7 red tests, in file order: D7-1, D7-1b, D7-2, D7-3, D7-4, D7-5, D7-6.
