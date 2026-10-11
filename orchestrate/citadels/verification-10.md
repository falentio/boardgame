# Citadels game definition: tenth independent verification

Verifier: review sub-agent (adversarial, tenth pass). I did not write this
module. Source head under review: `feat/citadels-game-definitions`, worktree
`/home/kevin/.t3/worktrees/boardgame/t3-a32da114`. Head
`c867b2a74aa19a06696f8c6a42fb78d509c991b0` ("fold a Museum-owning turn in the
engine-coverage guard"), the commit the brief names. The citadels suite is green
at 82 files / 660 tests before my file lands.

Product: this report plus
`shared/core/tests/lockstep/citadels/verification10.test.ts` — 3
counterexamples, each failing against this head, plus 3 positive probes.

## Verdict

**FAIL.** The ninth-pass fix is real and its two clauses hold — I re-proved the
Museum offer on the Alchemist's build and on the Navigator's turn (below, and
the two new guard rows redden on revert in the teeth audit). But the ninth-pass
fix touched only the *Museum* window that opens on top of a standing pending.
The same seam has a second member the ninth pass never swept: the **Blackmailer's
threat**. When a threatened seat **refuses** the threat, the reveal window
(`blackmailer-resolve`) clears the pending, and the stack continues into the
**second** turn window that `withThreat` spliced the threat above. `resolveTurn`
then sees a bare pending, treats that window as the gather window, and the
character's own resolve step (which sits below it) reads a null pending. Three
clauses break from that one misroute:

1. **D10-1** — a threatened seat that refuses **gathers a second time**. rules.json
   (blackmailer): "they must gather resources, then resolve the threat." One
   gather. A King with 0 gold ends the refused turn at **4**, where the bribe
   path and an unthreatened turn both end at 2.
2. **D10-2** — a threatened **Navigator** that refuses **loses its four gold /
   four cards entirely**. rules.json (navigator): "Gain either four gold or four
   cards." The reveal window clears the pending before the Navigator's resolve
   step reads its gain choice. Measured 0 gold / 0 cards, where an unthreatened
   Navigator ends at 4 / 4.
3. **D10-3** — a threatened **Navigator** resolves the threat **before** it
   gains, so the bribe is computed on the pre-gain purse. Measured: the Navigator
   bribes 0 of its post-gain 4 (Navigator 4, Blackmailer 2), where the rule wants
   half of 4 = 2 (Navigator 2, Blackmailer 4). An ordinary character with the
   same 0 gold gathers 2 first and bribes 1 (King 1, Blackmailer 3).

This is the "one clause beside a fix that just landed" pattern once more: the
ninth-pass fix chose a *tagged pending* to tell the Museum offer apart from the
gather keep, but the threat seam still tells its two turn windows apart by
nothing at all, so the refused seat's continuation re-enters the gather branch.

## How to reproduce

```
scripts/citadels-verify.sh \
  shared/core/tests/lockstep/citadels/verification10.test.ts \
  --own shared/core/tests/lockstep/citadels/verification10.test.ts
# => VERIFY FAILED: vitest   (Tests 3 failed | 3 passed (6))
```

Whole citadels suite with this file added:

```
vp test shared/core/tests/lockstep/citadels/
# => Test Files  1 failed | 82 passed (83)
#    Tests  3 failed | 663 passed (666)
```

`npx tsc -p tsconfig.citadels.json` is green (rc=0).

## Defects (each has a failing test in verification10.test.ts)

### D10-1 — a threatened seat that refuses gathers twice

`withThreat` (helpers.ts) splices a `blackmailer-threat` window directly below
the turn window, so the seat answers the turn window with its gather and the
threat opens on the post-gather gold. `resolveThreat` (characters/blackmailer.ts)
clears the threat and, when the seat refuses, opens `blackmailer-resolve` for
the Blackmailer. `resolveReveal` runs `withPending(state, null)` and returns
`rest` — the steps below the threat window, which still carry the **turn
window** `withThreat` left below it. The stack re-enters `resolveTurn` with a
**null** pending, and the `alreadyGathered` test (`resumedWitch || gatheredPending
!== null`) is false, so the window is treated as a fresh gather window and the
seat gathers again.

Measured (King, 0 gold, empty city, `threats: ["king"]`, no hand):

| path | final gold | window order |
|------|-----------|--------------|
| unthreatened | **2** | turn |
| bribe | **1** | turn, blackmailer-threat, turn |
| refuse | **4** | turn, blackmailer-threat, blackmailer-resolve, turn, turn |

The refused turn's window list is the smoking gun: `...turn, turn` — a second
turn window after the threat resolves.

Counterexample: *"D10-1 a threatened seat that refuses the threat gathers once,
not twice"*. Control (unthreatened) 2 and (bribe) 1 pass; the refused seat
measures 4.

### D10-2 — a threatened Navigator that refuses loses its gain

The Navigator's turn window is its gain choice, and the effect that reads the
choice runs at the **resolve step below** the turn window (`applyCall` arms
`[winStep("turn"), RESOLVE, ...]` for the Navigator). `withThreat` splices the
threat window directly below the turn window, so the order is
`turn, blackmailer-threat, resolve`. A refusal opens `blackmailer-resolve`,
whose resolver clears the pending (`withPending(state, null)`) — wiping the
`pending.note` that carries the Navigator's four-card choice — and then the
resolve step runs `navigator` against a null pending, taking neither gold nor
cards.

Measured (Navigator, 0 gold, empty city, `threats: ["navigator"]`):

| path | final gold | final hand |
|------|-----------|------------|
| unthreatened | **4** | 0 |
| unthreatened (draw) | 0 | **4** |
| refuse | **0** | 0 |
| refuse (draw) | 0 | **0** |

Counterexample: *"D10-2 a threatened Navigator that refuses still gains its four
gold"* — 0 gold (expected 4) and 0 cards on the draw branch (expected 4).

### D10-3 — a threatened Navigator resolves the threat before it gains

Same seam, the other ordering symptom. Because the threat window sits **above**
the Navigator's resolve step, the bribe is computed before the gain lands. The
rule (rules.json blackmailer) is "gather resources, then resolve the threat";
for the Navigator its gain *is* its gather.

Measured (0 gold, `threats: [character]`, answer bribe):

| character | final gold | Blackmailer gold |
|-----------|-----------|------------------|
| King (gathers 2, bribes 1) | **1** | **3** |
| Navigator (gains 4, should bribe 2) | **4** | **2** |

Counterexample: *"D10-3 a threatened Navigator gains before it resolves the
threat"* — the Navigator keeps all 4 (expected 2) and the Blackmailer takes
nothing (expected 4).

## The teeth audit

Method: `cp -r` the worktree to `/tmp/citadels-v10`, patch one source file in
the copy with `python3` (no git command ran in the shared worktree), re-run the
named guard with `-t`, record RED/GREEN, restore. 15 probes: 11 forward (revert
the fix, the guard must redden) and 4 reverse (remove the behaviour, the guard
must redden). Three patches matched no source text and are reported as
PATCH-NOOP and were re-aimed.

### Forward (revert/neuter the fix, the guard must redden)

| # | Guard | Reverted | Result |
|---|-------|----------|--------|
| F1 | engine-coverage "the engine reaches navigator" | `NAVIGATOR_GOLD` 4 -> 2 | **RED** |
| F2 | engine-coverage "the engine reaches spy" | `transferGold` -> no-op | **RED** |
| F3 | engine-coverage "the engine reaches thief" | `loot` -> 0 | **RED** |
| F4 | engine-coverage "the engine reaches keep" | `keepProtects` -> false | **RED** |
| F5 | engine-coverage "the engine reaches great-wall" | toll -> 0 | **RED** |
| F6 | engine-coverage "the engine reaches trader" | income -> no-op | **RED** |
| F7 | engine-coverage "the Laboratory discards one card for two gold, once" | `REWARD` 2 -> 0 | **RED** |
| F8 | engine-coverage "the Alchemist's build with a Museum keeps its refund and still tucks" (Museum-owning row) | `pending.note === MUSEUM_OFFER_NOTE` removed from `resolveKeep` | **RED** |
| F9 | engine-coverage "the Navigator's turn still opens the Museum's placement offer" (Museum-owning row) | Navigator branch disabled | **RED** |
| F10 | engine-coverage "the Witch's resume declares the School of Magic of a two-character seat" (two-character row) | resume `declareSchoolOfMagic` removed | **RED** |
| F11 | engine-coverage "the Theater owner gives the claim it chooses from a two-character seat" (two-character row) | `giveIndex` forced to 0 | **RED** |

All eleven forward probes turn RED. In particular both Museum-owning rows (F8,
F9) and both two-character rows (F10, F11) are sharp: each reddens on revert, so
the pass-9 and pass-8 guard gaps are genuinely closed for those clauses.

### Reverse (remove the behaviour, the guard must redden)

| # | Guard | Behaviour removed | Result |
|---|-------|-------------------|--------|
| R1 | engine-coverage "the engine reaches observatory" | draw-three -> draw-two | **RED** |
| R2 | engine-coverage "the engine reaches secret-vault" | `legal:false` -> `legal:true` | **RED** |
| R3 | engine-coverage "the engine reaches monument" | five-district gate -> open | **RED** |
| R4 | engine-coverage "the Poor House pays one gold to an empty purse, once" | `POOR_HOUSE_GOLD` 1 -> 0 | **RED** |
| R5 | engine-coverage "the engine reaches wizard" | `moveCard` -> null | **RED** |
| R6 | engine-coverage "the engine reaches navigator" | `NAVIGATOR_CARDS` 4 -> 1 | **RED** |

Every sampled guard that pins behaviour turns RED in both directions.

### Two guards that stayed GREEN — findings

Two probes targeted the Blackmailer's threat seam and stayed green, which is the
guard gap that let D10-1..D10-3 through:

- **R7.** engine-coverage "the engine reaches blackmailer" stays **GREEN** when
  the bribe branch in `resolveThreat` is disabled (`value === "bribe" && false`).
  The row asserts only that two threats are assigned and a `blackmailer-threat`
  window opens; it never drives the refuse path, so the double-gather and the
  dropped gain are unreachable from it. The character's own unit test
  (`characters/blackmailer.test.ts`) *does* redden on both the bribe branch
  (R7b) and the reveal branch (R7c), so the seam is pinned only by the unit file,
  and that unit file folds hand-armed states, not the engine's own turn stack —
  which is exactly why the second turn window was invisible.
- **R9.** engine-coverage "the engine reaches school-of-magic" stayed green when
  `incomeTypeOf` returns null (the onIncome declaration), but neutering the whole
  `schoolOfMagic` effect turns the **whole suite** red (5 failures, 2 files). The
  single-row probe was mis-aimed at a helper the row's scenario does not exercise;
  the clause is covered by a different row. Not a weakness, recorded for honesty.

No other guard stayed green.

### The guard-file gap (does any policy avoid the ability it pins?)

The guard suite's threat rows drive only the **bribe** answer
(`engine-coverage.test.ts` `windowAnswer` case "blackmailer-threat" returns
`{ t: "choose", value: "bribe" }`, and every verification fold does the same).
No guard row folds a **refused** threat on the engine's own stack, so the
refuse → reveal → second-turn-window path is unreachable by the guard suite. This
is the same structural gap the last four passes each named, now one window
further along the seam the ninth pass opened.

## Done-predicate clause-by-clause

| # | Clause | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | Full game reaches terminal (one winner) for 3-6 seats | **PASS** | Integration folds 3/4/5/6 seats and the casts; my fold sweep reaches terminal at 2-7 seats with the deck conserved. |
| 2 | Every character implemented with a behavioral test | **FAIL** | D10-1: a refused threat gathers twice (all characters). D10-2/D10-3: a refused threatened Navigator loses its gain and resolves the threat out of order. |
| 3 | Every district implemented with a test per unique effect | **PASS** | No district defect found this pass; the Museum-owning rows (F8, F9) are sharp and the end-of-turn hooks fire once (LAB/PARK+MUSEUM folds). |
| 4 | Exact scoring: cost sum, five-type bonus, 4 first / 2 other, unique points, tie-breaks | **PASS** | The prior scorers hold (re-read; unchanged this pass). |
| 5 | Hidden information never crosses `project`; two peers converge | **PASS** | Integration covers 3-6 seats; the prior passes re-proved redaction and convergence and nothing in the threat seam touches `project`. |
| 6 | No unverified file; `vp test` and `vp typecheck` green | **FAIL** | `tsc -p tsconfig.citadels.json` is green, but the suite goes red the moment `verification10.test.ts` is added (3 failed | 663 passed). |

## What is verified vs unverified

**Verified:** the ninth-pass fix (D9-1 the Alchemist's refund+tuck with a Museum,
D9-2 the Navigator's Museum offer) — both guard rows redden on revert and the
Alchemist/Navigator/Magician/Seer/Cardinal/threatened folds all reach the offer
exactly once; the Museum offer survives a standing pending (Alchemist spend,
Magician swap, Seer give, Cardinal donor, threat); the Witch's resume as the
Navigator and the School-of-Magic declaration on the resume; the end-of-turn
hooks (Laboratory, Park) fire once with the Museum offer in the stack; the
two-character rows (Witch resume, Theater give-choice) redden on revert; the 27
character summaries re-read against rules.json (faithful); the draft spare at
2/3/4/5/6/7 seats; the deck conserves (68 cards) and the game reaches terminal at
2-7 seats; the bribe path of the threat (half rounded down) and the reveal path
(flowered lace) both hold; `tsc` green; the D1..D9 families hold.

**Unverified / broken:** a threatened seat that **refuses** the threat — the
second turn window gathers again (D10-1), a threatened Navigator loses its gain
(D10-2) and resolves the threat before it gains (D10-3). None of the three is
reachable from any guard.

## What a human should still scrutinize

1. **The D10 fix shape.** The threat window must not leave a *gather* turn window
   below it. Options: give the post-threat turn window the
   `TURN_GATHERED_NOTE` marker so `resolveTurn` takes the build branch (a
   helpers.ts change), or splice the threat **above** the character's resolve
   step so the gain lands first and the seat's own continuation is unchanged.
   The second option also fixes D10-3 in the same stroke; the first does not.
2. **The Navigator under a threat (D10-3).** The Navigator's gain rides the
   resolve step *below* its turn window, so any window spliced below the turn
   window lands ahead of the gain. The Witch's resume and the threat are the two
   such splices; the resume is already ordered correctly, the threat is not. A
   human should rule whether the threat must always resolve after the seat's
   resource step for *every* character, not just the Navigator.
3. **The guard-file gap.** `engine-coverage.test.ts` drives only the bribe
   answer. It should fold at least one **refused** threat on the engine's own
   stack (and one on the Navigator) so this family cannot regress silently. The
   Museum-owning rows closed the pass-9 gap; the threat-refuse dimension is still
   open.
4. **The character summaries.** No test compares them to rules.json; I read all
   27 by eye and found no misstatement, but a data-driven test would close that
   permanently.

## Appendix: exact verify output

```
$ scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification10.test.ts \
    --own shared/core/tests/lockstep/citadels/verification10.test.ts
== vitest (the gate) ==
 ❯ shared/core/tests/lockstep/citadels/verification10.test.ts (6 tests | 3 failed)
   × D10-1 a threatened seat that refuses the threat gathers once, not twice
   × D10-2 a threatened Navigator that refuses still gains its four gold
   × D10-3 a threatened Navigator gains before it resolves the threat
 Test Files  1 failed (1)
      Tests  3 failed | 3 passed (6)
VERIFY FAILED: vitest
```

```
$ vp test shared/core/tests/lockstep/citadels/
 Test Files  1 failed | 82 passed (83)
      Tests  3 failed | 663 passed (666)
```

```
$ npx tsc -p tsconfig.citadels.json
(no output)
TSC_RC=0
```

The 3 red tests, in file order: D10-1, D10-2, D10-3. The 3 green: P1, P2, P3.
