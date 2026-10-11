# Citadels game definition: fifth independent verification

Verifier: review sub-agent (adversarial, fifth pass). I did not write this module.
Source head under review: `feat/citadels-game-definitions`, worktree
`/home/kevin/.t3/worktrees/boardgame/t3-a32da114`. The module head is `a59355b`
(the fix4 wave); the worktree tip when I wrote this is `4f42c10`, which touches
only `orchestrate/citadels/**` and no source file, so both are the same module.

Product: this report plus
`shared/core/tests/lockstep/citadels/verification5.test.ts` — 8 tests, every one
of which fails against this head and names a defect.

## Verdict

**FAIL.** The four prior passes were right, and their fixes hold: all 14
first-pass, 15 second-pass, 10 third-pass, and 9 fourth-pass counterexamples pass
against this head (48 green, re-run below). The guard wave's teeth are real where
the third and fourth passes strengthened them (see the teeth audit: eight sampled
guards all turn RED on the forward revert, five on the reverse).

But the module still has five real defect clusters a fifth pass reaches, and they
sit one clause beside a fix that just landed:

1. **The Witch's resumed turn (D5-1..4)** ignores the bewitched character's
   ability and build limit. The D4-1 fix closed her held turn but left the resume
   as a bare `turn` window: `witchResolve` pushes `winStep("turn", [witchSeat])`
   and never runs `CHARACTER_EFFECTS[bewitched]` or that character's
   `BUILD_LIMITS` row. Bewitching the Navigator still lets her build; the
   Architect's three-build limit, the Merchant's income, and the Architect's card
   draw never run.
2. **The Blackmailer's threat (D5-5)** resolves after the threatened player's
   build. The D4-4 fix spliced the threat below the turn window for post-gather
   gold — but the turn window is also the build window, so a threatened player who
   answers it with a build lands the district before the threat.
3. **The Cardinal's shortfall (D5-6)** is dead through the engine:
   `cardinalResolve` reads `pending.amount`, which no engine path writes.
4. **The School of Magic (D5-7)** declares its type on the gather hook, after the
   character income that should read it, so the colour is a turn late.
5. **The character summaries (D5-8)** disagree with the implemented effects for
   at least four characters.

None repeats D1..D14, V2-1..V2-9, D3-1..D3-7, or D4-1..D4-7; each is a clause one
step to the side of a fix that landed. The last two are the D3-1/D3-7
"windowless ability" and "catalog summary" patterns recurring in a new file.

## How to reproduce

```
scripts/citadels-verify.sh \
  shared/core/tests/lockstep/citadels/verification5.test.ts \
  --own shared/core/tests/lockstep/citadels/verification5.test.ts
# => VERIFY FAILED: vitest   (Tests 8 failed (8))
```

Whole citadels suite with this file added:

```
vp test shared/core/tests/lockstep/citadels/
# => Test Files  1 failed | 77 passed (78)
#    Tests  8 failed | 626 passed (634)
```

`tsc -p tsconfig.citadels.json` is green (the verify script's tsc stage passes;
the gate fails only on the vitest counterexamples).

## Re-running the prior passes

```
vp test shared/core/tests/lockstep/citadels/verification3.test.ts \
  shared/core/tests/lockstep/citadels/verification4.test.ts \
  shared/core/tests/lockstep/citadels/verification2.test.ts \
  shared/core/tests/lockstep/citadels/verification-report.test.ts
# => Test Files  4 passed (4);  Tests  48 passed (48)
```

Every prior counterexample passes against this head. This pass adds no duplicate
of a prior finding.

## Defects (each has a failing test in verification5.test.ts)

### D5-1..4 — the Witch's resumed turn ignores the bewitched character (blocking)

`rules.json` (witch): "You then resume your turn as if you were playing the
bewitched character: you use that character's abilities and build limit, with
YOUR hand, YOUR gold, and YOUR city."

`characters/witch.ts`'s `witchResolve` opens the resume as
`withSteps(resumed, [winStep("turn", [witchSeat]), ...rest])` — a plain turn
window. `resolveTurn` then runs its ordinary branch with `WITCH_RESUME_NOTE`
suppressing the gather only; it never calls `CHARACTER_EFFECTS[bewitched]`, and
the build limit is `buildLimit(state, seat)` read from the *Witch's* claim, so
it is always the default one. Every bewitched ability is dead on the resume.

Counterexamples and measured evidence:

- *"D5-1 the Witch's resume honours the Navigator's no-build clause"*. rules.json
  (navigator): "You cannot build any districts this turn." Measured: a folded
  Witch round bewitching the Navigator builds `tavern` (city `["tavern"]`,
  expected `[]`).
- *"D5-2 the Witch's resume uses the bewitched Architect's three-build limit"*.
  rules.json (architect): "Your building limit this turn is three." Measured: one
  build (city length 1, expected 3).
- *"D5-3 the Witch's resume runs the bewitched Merchant's income ability"*.
  rules.json (merchant): "Gain 1 gold per trade district in your city, plus 1
  extra gold." Measured: the Witch ends at +2 (her held gather only), expected +5
  (held +2 plus the Merchant's 2 trade + 1 bonus).
- *"D5-4 the Witch's resume runs the bewitched Architect's card draw"*. Measured:
  hand delta 0, expected 2.

### D5-5 — the Blackmailer's threat resolves after the threatened player's build

`rules.json` (blackmailer): "A threatened player must resolve the threat before
using abilities or building."

`withThreat` (helpers.ts) splices the `blackmailer-threat` window directly below
the turn window. The D4-4 fix did that so the bribe reads post-gather gold, but
the turn window is also the engine's only build window (`resolveTurn` handles
gold, draw, and build in one branch), so a threatened player who answers it with
a build lands the district before the threat opens — and the build branch skips
the gather, so they never gather at all.

Counterexample: *"D5-5 a threatened player's build lands only after the threat
resolves"*. Measured: at the moment the `blackmailer-threat` window is open,
BOB's city already holds `tavern` (expected `[]`).

### D5-6 — the Cardinal's shortfall clause is dead through the engine

`characters/cardinal.ts`'s `cardinalResolve` reads the shortfall from
`ctx.state.pending?.amount ?? 0`, but `cardinal` opens `cardinal-gold` with
`emptyPending(owner, "cardinal")` (amount 0) and no engine path writes the
amount, so the window is always a no-op. The rulebook's "take the shortfall from
one player" never runs in a real game. The unit test hand-writes the amount
(`withShortfall`), the D3-1/D3-7 pattern.

Counterexample: *"D5-6 the Cardinal's shortfall clause is reachable through the
engine"*. Measured: a folded Cardinal turn with 1 gold and a cost-5 cathedral in
hand never builds and never moves BOB's gold (the `cardinal-gold` window armed
amount 0; the donor pays 0).

### D5-7 — the School of Magic declares its type after the income that reads it

`districts/school-of-magic.ts` writes the declared type on the `onIncome` hook
(the gather), but the character's income runs at the resolve step *above* the
turn window (`applyCall` builds `[RESOLVE, winStep("turn"), ...]`), so on the
turn the School is declared the King's income has already run without it. The
colour is one turn late: the first turn the School of Magic is in the city it
earns nothing.

Counterexample: *"D5-7 the School of Magic counts for the owner's income the turn
it is declared"*. Measured: a folded King turn with one School of Magic ends at
+2 (the gather only), expected +3 (the gather plus 1 noble).

### D5-8 — the character catalog summaries disagree with the implemented effects

`characters.ts`'s `summary` is catalog data. The prior pass found and fixed one
such mismatch (the Navigator); the rest were not swept. Four describe abilities
the module does not implement:

- Bishop: "Collect 1 gold per religious district; name a player who pays you 1
  gold per noble." The implemented clause is the rank-8 shield; there is no
  noble-payment ability. (Contradicts rules.json bishop.)
- Tax Collector: "Name a character; every player holding it gives you 1 gold."
  The implemented clause is the tax token (`chargeBuildTax`). (Contradicts
  rules.json tax-collector.)
- Blackmailer: "Pay 1 gold to a character; that character skips its turn this
  round." The implemented clause is two threat markers, the flowered lace, and a
  bribe. (Contradicts rules.json blackmailer.)
- Magician: "Swap your whole hand with the deck, or exchange cards with another
  player." The implemented clause swaps with another *player*, or discards to the
  bottom of the deck. (Contradicts rules.json magician.)

Counterexample: *"D5-8 the character summaries match the implemented abilities"*.

## The teeth audit

I copied the worktree to `/tmp/citadels-v5`, edited each source directly in the
copy (its `.git` points at the shared gitdir, so I never ran git there),
re-ran the guard, and restored from the shared worktree. Eight forward probes
(every guard the brief named), including the re-aimed D4-1 Witch row, the
Navigator card-gather row, the Spy gold-take row, the Thief loot row, the Keep
protected-vs-unprotected row, the Great Wall toll row, the Trader declared-type
row, and a once-per-turn row:

| # | Guard under test | Reverted | Guard result |
|---|------------------|----------|--------------|
| F1 | Navigator card gather | `navigatorChoice` forced to "gold" (D3-1 branch dead) | **RED** — 1 failed (`the engine reaches navigator`) |
| F2 | Spy gold-take | the `transferGold` clause removed | **RED** — 1 failed (`the engine reaches spy`) |
| F3 | Thief loot | `loot` forced to 0 | **RED** — 1 failed (`the engine reaches thief`) |
| F4 | Keep protected-vs-unprotected | `keepProtects` forced to `false` | **RED** — 1 failed (`the engine reaches keep`) |
| F5 | Great Wall toll | `greatWallExchangeToll` forced to 0 | **RED** — 1 failed (`the engine reaches great-wall`) |
| F6 | Trader declared-type | `tradeIn` reverted to the catalog type | **RED** — 1 failed (`the engine reaches trader`) |
| F7 | once-per-turn (Laboratory/Smithy/Park/Poor House) | `endTurnThen` always prepends `END_TURN` | **RED** — 11 failed |
| F8 | D4-1 Witch row | the `heldWitch` early-close removed from `resolveTurn` | **RED** — 2 failed (D4-1, D4-1b) |

All eight forward probes turn RED. The three rows the fourth pass called theater
(Navigator, Spy, Thief) are now behavioral: F1/F2/F3 redden when the *move* is
removed, not merely the wiring. No sampled guard stayed green.

### Reverse direction (non-tautology)

I removed the *behaviour* behind five more guards and watched the guard:

| Guard | Behaviour removed | Guard result |
|-------|-------------------|--------------|
| Gold Mine | the `+1` extra-gold clause removed | **RED** — 1 failed (`the engine reaches gold-mine`) |
| Library | the keep-both `pending.gold = pending.amount` removed | **RED** — 1 failed (`the engine reaches library`) |
| Observatory | the draw-three `amount = DRAW_COUNT` removed | **RED** — 1 failed (`the engine reaches observatory`) |
| Monument | the five-district build gate removed | **RED** — 1 failed (`the engine reaches monument`) |
| Secret Vault | the cannot-build refusal removed | **RED** — 1 failed (`the engine reaches secret-vault`) |

All five reverse probes turn RED. The guard suite asserts behaviour, not wiring,
for every sampled row.

## Done-predicate clause-by-clause

| # | Clause | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | Full game reaches terminal (one winner) for 3-6 seats | **PASS (weak)** | The integration suite folds 3/4/5/6 seats and three casts to `phase: "over"`; my probe folds all six rulebook preset casts to terminal for 4/5/6 seats (no throw, one winner each). But D5-1..5 corrupt a real game's cities and gold, so the *winner* is not always the rulebook's. |
| 2 | Every character implemented with a behavioral test | **FAIL** | 27 files and 27 tests exist, but the Witch's resume runs no bewitched ability or build limit (D5-1..4); the Blackmailer's threat order lets the threatened player build first (D5-5); the Cardinal's shortfall is dead through the engine (D5-6); the School of Magic's declaration lags its income (D5-7); four summaries describe abilities that do not exist (D5-8). |
| 3 | Every district implemented with a test per unique effect | **PASS (weak)** | 30 files and 30 tests; the destroy-path card conservation the fourth pass found is fixed (Warlord, Armory, Framework/Necropolis self-destroy, and the Magistrate all conserve cards — probes below). The School of Magic's *timing* is wrong (D5-7), which is a character-income interaction rather than the district's own effect. |
| 4 | Exact scoring: cost sum, five-type bonus, 4 first / 2 other, unique points, tie-breaks | **PASS** | Cost sum (beautify included), colour bonus (declared types included), the 4/2 completion split, the declared-type unique scorers, and the revealed-rank tie-break all hold (my probes: colour bonus 3 with a declared noble; tie-break awards the rank-8 holder; the D3-6/D4-6 fixes hold). |
| 5 | Hidden information never crosses `project`; two peers converge | **PASS** | The redaction and convergence tests are green; a folded game seals 395 frames and two peers converge. `project` still omits deck, draft, pool, facedown, and other hands. |
| 6 | No unverified file; `vp test` and `vp typecheck` green | **FAIL** | `tsc` is green, but the suite goes red the moment `verification5.test.ts` is added (8 failed | 626 passed). |

## What is verified vs unverified

**Verified:** the deck catalog; the registries are total; genesis deals and
conserves; the draft is hidden and its face-up/facedown counts match the catalog
at 3/4/5/6 seats and 8- and 9-character casts; the phase machine reaches terminal
for 3-6 seats, three casts, and all six rulebook preset casts; the naming
sub-machine records through the engine; the colour bonus, the cost sum including
beautify, the 4/2 completion split, the declared-type unique scorers, and the
revealed-rank tie-break; codec round-trip; convergence; `tsc` green; the
D1..D14, V2-1..V2-9, D3-1..D3-7, and D4-1..D4-7 fixes hold (48 counterexamples
green); the destroy-path card conservation (Warlord, Armory, Framework,
Necropolis, Magistrate) conserves cards; eight sampled guards turn RED on revert
and five on reverse-removal.

**Unverified / broken:** the Witch's resumed turn's ability and build limit
(D5-1..4); the Blackmailer's build-before-threat ordering (D5-5); the Cardinal's
shortfall clause (D5-6); the School of Magic's income timing (D5-7); four
character catalog summaries (D5-8).

## Verdict on the done predicate

The module does not meet the done predicate. Clauses 2 and 6 are false, and
clause 1 and 3 are green only because the suite does not fold a game that
exercises the uncovered clauses. The prior passes closed "does the engine reach
it?" for windows, scorers, and one held turn; this pass shows the same gap
persists for the Witch's *resume* (a window that runs with no ability and the
wrong limit), for the Cardinal's shortfall (a windowless amount no path writes),
and for a district hook whose timing is one step off the reader.

## What a human should still scrutinize

1. **The Witch's resume (D5-1..4).** `witchResolve` opens a bare `turn` window;
   the resume must run `CHARACTER_EFFECTS[bewitched]` and read that character's
   `BUILD_LIMITS` row, then keep the `WITCH_RESUME_NOTE` gather suppression.
   Reconcile with `navigator.withoutBuild` and `architect/scholar.withBuildLimit`,
   which already express "the character's build limit" as a step-stack rewrite.
2. **The gather/build window merge (D5-5).** The engine's turn window is both the
   gather and the build; a rule that needs "gather, then resolve X, then build"
   (the Blackmailer's threat) cannot be expressed by ordering windows around a
   window that does both. This is the structural seam behind D4-4 and D5-5.
3. **Windowless amounts (D5-6).** `cardinalResolve` reads `pending.amount`, which
   only the unit test writes. Sweep every `pending.amount`/`pending.note` reader
   in `characters/` and `districts/` for a value no engine path sets; the
   Navigator and Haunted Quarter were the first two, the Cardinal is the third.
4. **Hook timing vs the resolve step (D5-7).** `onIncome` runs below the resolve
   step that runs the character income, so a district that declares state read by
   that income (School of Magic) is always a turn late. Decide whether the
   declaration belongs before the income or the income reads the catalog type.
5. **Catalog summaries (D5-8).** `characters.ts`'s `summary` is the only
   human-readable spec in the module and four of 27 contradict the effect and
   rules.json. Sweep all 27 against `rules.json`.
6. **Guard honesty.** The three rows the fourth pass called theater are now real
   (F1/F2/F3), and the once-per-turn rows are real (F7). No sampled guard stayed
   green, but the suite still does not fold a game that reaches the Witch's
   resume ability, the Cardinal's shortfall, or the School's income timing, which
   is why D5-1..7 slipped a fifth pass.

## Appendix: exact verify output

```
$ scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification5.test.ts --own shared/core/tests/lockstep/citadels/verification5.test.ts
== vitest (the gate) ==
 ❯ shared/core/tests/lockstep/citadels/verification5.test.ts (8 tests | 8 failed) 47ms
   × D5-1 the Witch's resume honours the Navigator's no-build clause 30ms
   × D5-2 the Witch's resume uses the bewitched Architect's three-build limit 2ms
   × D5-3 the Witch's resume runs the bewitched Merchant's income ability 2ms
   × D5-4 the Witch's resume runs the bewitched Architect's card draw 2ms
   × D5-5 a threatened player's build lands only after the threat resolves 2ms
   × D5-6 the Cardinal's shortfall clause is reachable through the engine 3ms
   × D5-7 the School of Magic counts for the owner's income the turn it is declared 2ms
   × D5-8 the character summaries match the implemented abilities 1ms
 Test Files  1 failed (1)
      Tests  8 failed (8)
VERIFY FAILED: vitest
```

```
$ vp test shared/core/tests/lockstep/citadels/
 Test Files  1 failed | 77 passed (78)
      Tests  8 failed | 626 passed (634)
```

The 8 red tests, in file order: D5-1, D5-2, D5-3, D5-4 (Witch resume), D5-5
(Blackmailer), D5-6 (Cardinal), D5-7 (School of Magic), D5-8 (summaries).
