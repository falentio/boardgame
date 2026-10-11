# Citadels game definition: sixth independent verification

Verifier: review sub-agent (adversarial, sixth pass). I did not write this module.
Source head under review: `feat/citadels-game-definitions`, worktree
`/home/kevin/.t3/worktrees/boardgame/t3-a32da114`. Module head `32b9c1d`; worktree
tip `9065b03`, which touches only `orchestrate/citadels/**`, so both are the same
module. The citadels suite is green at 78 files / 634 tests before my file lands.

Product: this report plus
`shared/core/tests/lockstep/citadels/verification6.test.ts` — 2 counterexamples,
each failing against this head, plus 3 positive probes whose teeth I measured.

## Verdict

**FAIL.** The five prior passes were right and their fixes hold: all 14 first-pass,
15 second-pass, 10 third-pass, 9 fourth-pass, and 8 fifth-pass counterexamples pass
against this head. The D5-1..8 fixes are real and reachable through the engine.
But two defects survive a sixth pass, and the teeth audit finds four guard rows that
do not pin the fix they claim to guard — one of them pins nothing in the whole suite.

1. **D6-1 — the Cardinal's shortfall gift drops a card (blocking).**
   `characters/cardinal.ts` `coverShortfall` removes the cards it hands over with
   `hand.filter((id) => id === reserve || !given.includes(id))`. When the Cardinal's
   hand holds two copies of the same id, `given.includes(id)` matches both, so both
   leave the Cardinal's hand while the donor receives one. A 1-gold shortfall costs
   two cards: card conservation breaks (measured 68 -> 67 through a folded game).
2. **D6-2 — the turn window makes gather and build mutually exclusive.**
   `helpers.ts` `resolveTurn` handles the turn window as one either/or action:
   answering `gold`/`draw` gathers and ends the turn with no build window; answering
   `build` builds and never gathers. The rules of record say the opposite —
   `docs/design/citadels-full-game.md`: "A turn: gather (2 gold, or draw 2 keep 1),
   then optionally build one district." Measured: a King with 10 gold who builds
   ends at 9; the same King who gathers ends with no build opportunity.

The four guard rows that stay GREEN on a revert are the teeth audit's finding;
the sharpest is that **no test in the 78-file suite catches removing the D5-5
threatened-build deferral** — reverting that fix leaves 634/634 green.

## How to reproduce

```
scripts/citadels-verify.sh \
  shared/core/tests/lockstep/citadels/verification6.test.ts \
  --own shared/core/tests/lockstep/citadels/verification6.test.ts
# => VERIFY FAILED: vitest   (Tests 2 failed | 3 passed (5))
```

Whole citadels suite with this file added:

```
vp test shared/core/tests/lockstep/citadels/
# => Test Files  1 failed | 78 passed (79)
#    Tests  2 failed | 637 passed (639)
```

Re-running the prior passes against this head: `vp test` over `verification3..5` and
`verification-report` is green (48 passed). This pass adds no duplicate of a prior
finding.

## Defects (each has a failing test in verification6.test.ts)

### D6-1 — the Cardinal's shortfall gift loses a card on a duplicate-id hand (blocking)

`rules.json` (cardinal): "When you build a district and lack the gold, you may take
the shortfall from one player, **giving that player one card from your hand per gold
taken**." `coverShortfall` (characters/cardinal.ts) picks the cards to give with
`const spare = payer.hand.filter((id) => id !== reserve); const given = spare.slice(0, taken);`
and then rebuilds the hand with
`const kept = payer.hand.filter((id) => id === reserve || !given.includes(id));`.

`given` is an array of ids, so `given.includes(id)` is true for **every** copy of an
id that appears in `given`. With a hand of `["cathedral", "tavern", "tavern"]` and a
1-gold shortfall, `given` is `["tavern"]`; the filter drops both taverns, the donor
receives one, and the other vanishes.

Counterexample: *"D6-1 the Cardinal's shortfall gift conserves cards when the hand
holds duplicates"*. Measured: `totalCards` 68 at the turn's start, 67 at its end
(`expected 67 to be 68`). The donor receives the card; the second copy is lost. The
unit test `cardinal.test.ts` only ever hands over distinct ids, so it never reaches
this shape.

Reproduced three ways:
- direct `coverShortfall(state, ANN, BOB, 1, "cathedral")` on a hand of
  `["cathedral", "tavern", "tavern"]`: `annHand` goes from 3 cards to `["cathedral"]`,
  `bobHand` gains one `tavern`, total 67 -> 66.
- `taken = 3` on `["cathedral", "tavern", "tavern", "tavern"]`: two taverns survive,
  three vanish, one is given (total 68 -> 67).
- through the engine (the counterexample): a folded Cardinal turn with a cost-5
  cathedral, 4 gold, and two taverns in hand loses one card (68 -> 67).

### D6-2 — gather and build are mutually exclusive in the turn window

`docs/design/citadels-full-game.md` (rules of record): "A turn: gather (2 gold, or
draw 2 keep 1), then optionally build one district." `rules.json` corroborates for
every income character ("usable regardless of which resource you gathered this
turn") and for the Blackmailer ("they must gather resources, then resolve the
threat... before... building").

`helpers.ts` `resolveTurn` handles the turn window as a single choice: the `gold`
branch adds 2 and returns `endTurnThen(rest)` (the turn ends, no build window), the
`draw` branch gathers and opens a keep window (no build window), and the `build`
branch runs `tryBuild` without ever adding the gather. So on a one-window turn a seat
either gathers or builds, never both. The module's own `resolveTurn` comment says
"the turn window is both the gather and the build"; the code makes it either/or.

Counterexample: *"D6-2 a seat that gathers may then build in the same turn"*. Two
measurements, both on a King turn with 10 gold and a tavern in hand:
- answer the turn window with `gold`: the next open purpose is `draft-pick` — the
  round has advanced and no build window ever opens (`expected 'draft-pick' to be 'turn'`).
- answer the turn window with `build`: the tavern lands and gold is 9 — the gather
  never ran (gather 2, pay 1 would leave 11).

Note the tension a human should weigh: the module's own guards encode the either/or
model (e.g. the Alchemist row asserts a build turn ends at its start gold, which
holds only if the build turn never gathers). If the coordinator rules the either/or
model deliberate, this counterexample should be re-aimed; as written, the code and
the rules of record disagree, and every one-window turn loses its income on a build.

## The teeth audit

Method: `cp -r` the worktree to `/tmp/citadels-v6` (its `.git` points at the shared
gitdir, so no git command ran there), patch one source file in the copy, re-run the
guard with `-t`, record RED/GREEN, restore the file. I reset the copy from the shared
worktree between batches after one batch left it corrupted. Roughly two dozen
probes: every guard the brief named, at least one per character family, and the
reverse direction on eight.

### Forward (revert/neuter the fix, the guard must redden)

| # | Guard (`engine-coverage.test.ts`) | Reverted | Result |
|---|-----------------------------------|----------|--------|
| F1 | the engine reaches navigator | `navigatorChoice` forced to `"gold"` | **RED** (1 failed) |
| F2 | the engine reaches spy | the `transferGold` clause removed | **RED** (1 failed) |
| F3 | the engine reaches thief | `loot` forced to 0 | **RED** (1 failed) |
| F4 | the engine reaches keep | `keepProtects` forced to `false` | **RED** (1 failed) |
| F5 | the engine reaches great-wall | `greatWallExchangeToll` forced to 0 | **RED** (1 failed) |
| F6 | the engine reaches trader | declared-type read reverted to the catalog type | **RED** (1 failed) |
| F7 | the engine reaches gold-mine | the `+1` extra-gold clause removed | **RED** (1 failed) |
| F8 | the engine reaches library | the keep-both `pending.gold = pending.amount` removed | **RED** (1 failed) |
| F9 | the engine reaches observatory | the draw-three clause removed | **RED** (1 failed) |
| F10 | the Poor House pays one gold... | the refill removed | **RED** (1 failed) |
| F11 | the Laboratory discards one card... | `endTurnThen` always prepends `END_TURN` | **RED** (1 failed) |
| F12 | the engine reaches monument | the five-district build gate removed | **RED** (1 failed) |
| F13 | the engine reaches secret-vault | the cannot-build refusal removed | **RED** (1 failed) |
| F14 | the engine reaches armory | the `armory` effect neutered | **RED** (1 failed) |
| F15 | the engine reaches thieves-den | the gold share not debited | **RED** (1 failed) |
| F16 | the engine reaches school-of-magic | **both** declaration paths removed | **RED** (1 failed) |

### The four rows that stay GREEN (findings)

| # | Guard | Reverted | Result |
|---|-------|----------|--------|
| T1 | the engine reaches school-of-magic | **only** the D5-7 turn-open declaration removed (the `onIncome` hook left intact) | **GREEN** |
| T2 | the engine reaches cardinal | the D5-6 shortfall branch removed from `resolveTurn` | **GREEN** |
| T3 | the engine reaches blackmailer | the D5-5 threatened-build deferral removed from `resolveTurn` | **GREEN** |
| T4 | the engine reaches witch | the D5-1..4 resume `RESOLVE` step removed from `resumeStack` | **GREEN** |

Each is a guard that claims to pin a fix it does not reach:

- **T1.** The school-of-magic guard folds a King turn and asserts the placed card's
  `declaredType` is `noble`. Both the turn-open declaration and the `onIncome` hook
  set that field, so removing either alone leaves the guard green. The guard pins the
  hook, not the D5-7 timing fix. Only `verification5.test.ts` D5-7 catches the
  turn-open revert (confirmed: D5-7 goes RED, 1 failed).
- **T2.** The cardinal guard asserts only the income draw (hand delta 3) and never
  folds a shortfall, so the D5-6 branch is invisible to it. Only `verification5`
  D5-6 catches the revert (RED, 1 failed).
- **T3.** The blackmailer guard asserts two threats are assigned and a
  `blackmailer-threat` window opens. Both hold with the D5-5 deferral removed — the
  threatened seat simply never gets its build back. **Reverting the D5-5 deferral
  leaves the entire 78-file suite green (634/634 passed)**; the `verification5`
  D5-5 counterexample also passes, because it only checks that no district stands
  while the threat window is open (true both with the deferral and with the build
  dropped). This pass's `P6-1` is the only test that reddens.
- **T4.** The witch guard asserts the purposes contain `witch-takeover` and
  `witch-resume`; the resume `RESOLVE` step is what runs the bewitched ability, and
  removing it leaves the guard green. `verification5` D5-1, D5-3, D5-4 and
  `verification4` D4-1b do catch it (4 failed).

### Reverse (remove the behaviour, the guard must redden)

| Guard | Behaviour removed | Result |
|-------|-------------------|--------|
| the engine reaches observatory | the draw-three clause | **RED** |
| the Poor House pays one gold... | the refill clause | **RED** |
| the engine reaches monument | the five-district gate | **RED** |
| the engine reaches secret-vault | the cannot-build refusal | **RED** |
| the engine reaches keep | `keepProtects` | **RED** |
| the engine reaches school-of-magic | both declaration paths | **RED** |
| the engine reaches armory | the destroy offer | **RED** |
| the engine reaches thieves-den | the gold-share debit | **RED** |

Every sampled guard that pins behaviour turns RED in both directions. The four rows
above are the exceptions, and each is a guard whose fix sits in a branch its fold
never reaches.

### The teeth of this pass's own positive probes

`P6-1`, `P6-2`, and `P6-3` in `verification6.test.ts` pass on the head and each
reddens when the fix behind it is removed:

| Probe | Fix removed | Result |
|-------|-------------|--------|
| P6-1 (threatened build lands after the threat) | D5-5 deferral | **RED** — `expected [] to deeply equal [ 'tavern' ]` |
| P6-2 (School of Magic income timing) | D5-7 turn-open declaration | **RED** — `expected 2 to be 3` |
| P6-3 (Cardinal shortfall reachable) | D5-6 shortfall branch | **RED** — `expected [ 'temple' ] to include 'cathedral'` |

## Done-predicate clause-by-clause

| # | Clause | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | Full game reaches terminal (one winner) for 3-6 seats | **PASS** | All six rulebook preset casts fold to terminal for 4/5/6 seats (18/18) and a 7-seat fold reaches terminal; `vp test` integration is green. D6-2 corrupts the economy but not termination. |
| 2 | Every character implemented with a behavioral test | **FAIL** | D6-1 breaks the Cardinal's shortfall gift; D6-2 makes every one-window turn lose its gather. T2/T4 show the Cardinal and Witch guards do not pin their fixes. |
| 3 | Every district implemented with a test per unique effect | **PASS (weak)** | 30 files, 30 tests; sampled district guards turn RED on revert. T1 shows the School of Magic guard does not pin the D5-7 timing. |
| 4 | Exact scoring: cost sum, five-type bonus, 4 first / 2 other, unique points, tie-breaks | **PASS** | The prior-pass scorers hold; the declared-type scorers and the revealed-rank tie-break are green. |
| 5 | Hidden information never crosses `project`; two peers converge | **PASS** | Redaction and convergence tests green. |
| 6 | No unverified file; `vp test` and `vp typecheck` green | **FAIL** | `tsc -p tsconfig.citadels.json` is green, but the suite goes red the moment `verification6.test.ts` is added (2 failed | 637 passed). |

## What is verified vs unverified

**Verified:** the deck catalog; genesis deals and conserves; the draft at 3-6 seats;
the phase machine reaches terminal for 3-6 seats, all six preset casts, and a 7-seat
fold; the naming sub-machine; the colour bonus and declared-type scorers; the
revealed-rank tie-break; codec round-trip; convergence; `tsc` green; the D1..D14,
V2-1..V2-9, D3-1..D3-7, D4-1..D4-7, and D5-1..D5-8 fixes all hold (their
counterexamples green); the sampled district/character guards have teeth in both
directions; the D5-6 and D5-7 fixes are reachable through the engine (P6-2, P6-3).

**Unverified / broken:** the Cardinal's shortfall gift with a duplicate-id hand
(D6-1); the turn model's gather-then-build clause (D6-2); the D5-5 threatened-build
deferral is pinned by no test in the suite (T3); the engine-coverage cardinal,
blackmailer, witch, and school-of-magic rows do not pin their fixes (T1-T4).

## What a human should still scrutinize

1. **D6-1.** `coverShortfall` must remove exactly the `given` occurrences, not every
   card whose id appears in `given`. The reserve (`pending.cards[0]`) must stay. A
   duplicate-safe removal (index-based, or a multiset) fixes it; the card count is
   the invariant to pin.
2. **D6-2.** Decide whether the turn window should carry the gather as a mandatory
   step followed by an optional build (the rules of record), or whether the either/or
   model is a deliberate simplification. If the former, the change is engine-level
   (`helpers.ts`) and touches every income reader, the Blackmailer's threat order,
   the Architect/Navigator/Trader limits, and every guard that asserts a build-turn
   gold delta — a coordinator-serialized wave, not a one-file fix.
3. **The T3 gap.** The D5-5 fix is pinned by nothing. My `P6-1` (a threatened seat's
   build must land after the threat) closes it; the `verification5` D5-5 counterexample
   should be strengthened the same way.
4. **The T1/T2/T4 guard rows.** Each guard should fold the branch its fix lives in:
   the school-of-magic row should assert the declared type is present *before* the
   income runs (not merely after), the cardinal row should fold a shortfall, and the
   witch row should assert the resumed ability's effect (hand/gold delta), not only
   the window purpose.

## Appendix: exact verify output

```
$ scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification6.test.ts \
    --own shared/core/tests/lockstep/citadels/verification6.test.ts
== vitest (the gate) ==
 ❯ shared/core/tests/lockstep/citadels/verification6.test.ts (5 tests | 2 failed) 25ms
   × D6-1 the Cardinal's shortfall gift conserves cards when the hand holds duplicates
   × D6-2 a seat that gathers may then build in the same turn
 Test Files  1 failed (1)
      Tests  2 failed | 3 passed (5)
VERIFY FAILED: vitest
```

```
$ vp test shared/core/tests/lockstep/citadels/
 Test Files  1 failed | 78 passed (79)
      Tests  2 failed | 637 passed (639)
```

The 2 red tests, in file order: D6-1 (Cardinal card loss), D6-2 (gather/build).
