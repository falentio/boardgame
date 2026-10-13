# Citadels game definition: fifteenth independent verification

Verifier: review sub-agent (adversarial, fifteenth pass). I did not write this
module. Source head under review: `feat/citadels-game-definitions`, worktree
`/home/kevin/.t3/worktrees/boardgame/t3-a32da114`, head `536f78d`. The citadels
suite is green at 87 files / 705 tests before my file lands; it is 88 files / 714
tests with it (3 red).

Product: this report plus
`shared/core/tests/lockstep/citadels/verification15.test.ts` — 3 counterexamples,
failing against this head, plus 6 positive probes.

## Verdict

**FAIL.** The D14-1 fix holds: I re-proved that a refused threatened Scholar draws
before it builds and reaches the plain end state (P1), that the Alchemist's settle
refund still runs after its build (P2), that the Trader's `trader-build` window and
limit build survive (P3), that the Navigator's gain rides the resolve step (P4),
that the new `rearm` arm step does not clobber the Museum offer (P5), and that the
26-character adaptive rich-board sweep is clean (P6). I also re-ran every prior
pass's counterexample: verification-report through verification14 pass 115/115.

The D14-1 fix unified the **build** order below the threat. It left the **gather**
order split: a plain turn runs the character effect at the resolve step ABOVE its
gather window, so the effect's windows drain BEFORE the gather; a threatened turn
drains the same windows BELOW the threat, i.e. AFTER the gather. Every ability whose
result depends on the **purse** therefore sees a different purse on a refused turn
than on a plain one, and the refused turn no longer ends where the plain turn ends.
This is the D15 family — a real, reachable, previously-unreported defect the fix13c
relocation (aa6f553) introduced.

- **D15-1 (real).** A refused threatened **Warlord** destroys a rival district the
  plain Warlord cannot afford. Board: BOB 0 gold, CARA holds a Barracks (cost 3).
  The Warlord's destroy price is cost-1 = 2. On the plain turn the destroy window
  drains ABOVE the gather, so BOB holds 0 gold, destroys nothing, and ends at 2 gold;
  the refused turn drains it BELOW the threat (post-gather), so BOB holds 2 gold,
  destroys the Barracks, and ends at 0. Measured: plain CARA city `[barracks]`,
  refused CARA city `[]`; refused end key `0||||0|57` vs plain `2|||barracks|0|56`.
- **D15-2 (real).** A refused threatened **Abbot** resolves its richest clause on the
  post-gather purse. Board: ANN 1, BOB 0, CARA 2. The rule: "If at any point during
  your turn you are not the richest player, the richest player must give you 1 gold."
  The plain Abbot evaluates the clause before its gather (BOB 0, not richest → takes 1
  from CARA) and ends at 3; the refused Abbot evaluates it after the gather (BOB 2,
  tied richest → receives nothing) and ends at 2.
- **D15-3 (real).** The same purse-timing split for the other two gold-gated military
  abilities. A refused threatened **Marshal** seizes a Watchtower the plain Marshal
  cannot pay for (refused `1||watchtower:0||1|56` vs plain `2|||watchtower|0|56`), and
  a refused threatened **Diplomat** completes an exchange (and pays the difference)
  the plain Diplomat cannot.

Attribution (measured by folding the same board at each head): at `5305109` (the D13
relocation) plain and refused both end `{g:2, cara:[barracks]}` — clean. At `aa6f553`
(fix13c, the payload re-arm) the refused Warlord ends `{g:0, cara:[]}` — the family
appears. It persists at `536f78d`. So the D15 family is the fix13c `arm` seam, not the
D14-1 splice.

## How to reproduce

```
scripts/citadels-verify.sh \
  shared/core/tests/lockstep/citadels/verification15.test.ts \
  --own shared/core/tests/lockstep/citadels/verification15.test.ts
# => VERIFY FAILED: vitest   (Tests 3 failed | 6 passed (9))
```

`vp test shared/core/tests/lockstep/citadels/` adds exactly 3 failing tests to the
suite (D15-1..3); P1-P6 are green, and every prior verification file stays green
(verification11 5/5, verification12 7/7, verification13 14/14, verification14 5/5).

## Defect

### D15-1/2/3 — a refused threatened seat's purse-gated ability sees the post-gather purse

Counterexamples *"D15-1 a refused threatened Warlord destroys on its post-gather purse,
the plain turn cannot"*, *"D15-2 a refused threatened Abbot resolves its richest clause
on the post-gather purse"*, and *"D15-3 the purse-timing family: a refused Marshal and
Diplomat diverge from their plain turns"*.

| character | path | window order | end state |
|---|---|---|---|
| Warlord | plain | `-,warlord-destroy,warlord-destroy,turn,turn,draft-pick` | 2 gold, rival keeps Barracks |
| Warlord | refused | `-,turn,blackmailer-threat,blackmailer-resolve,warlord-destroy,warlord-destroy,turn,draft-pick` | 0 gold, rival Barracks destroyed |
| Abbot | plain | `-,abbot-split,turn,turn,draft-pick` | 3 gold |
| Abbot | refused | `-,turn,blackmailer-threat,blackmailer-resolve,abbot-split,turn,draft-pick` | 2 gold |

Root cause. `applyCall` arms the turn as `[RESOLVE, turn, END_TURN, ...]` (helpers.ts,
the non-Navigator branch): the resolve step runs the character effect, and the effect
prepends its windows above the turn window, so those windows drain BEFORE the gather.
`withThreat` then splices the threat below the turn window, and
`relocateEffectBelowThreat` moves the effect's windows below the threat — i.e. below
the gather the turn window just performed. A plain seat's Warlord destroy, Marshal
seize, Diplomat exchange, or Abbot richest clause therefore runs on the pre-gather
purse; a refused seat's runs on the post-gather purse. The two orders must agree
(rules.json blackmailer: "they must gather resources, then resolve the threat" — the
threat is inserted into the seat's own turn, and the seat's turn is otherwise
unchanged).

**Fix shape (helpers.ts, shared — report and stop).** The relocation must keep the
effect's windows in their plain-turn position relative to the gather: an ability that
ran before the gather on a plain turn must still run before the gather on a refused
turn. Concretely the threatened branch already gathers on the pre-threat turn window
(D10), so the relocate cannot simply move the effect windows below the threat without
also moving the gather below them, or re-seating the effect windows above the gather
with the threat spliced between the gather and the windows. Either shape touches
`helpers.ts` (and possibly `withThreat`), both shared. The coordinator owns it.

## The teeth audit

Method: `git archive HEAD | tar -x -C /tmp/citadels-v15` (no git command ran in the
shared worktree), patch one source file in the copy with a Python replace that
**asserts the pattern is present** (a no-op patch cannot masquerade as a pass), run the
named guard with `-t`, record RED/GREEN, restore from the shared worktree by copy.

| # | Guard | Neuter | Result |
|---|-------|--------|--------|
| T1 | P1 the D14-1 Scholar fix holds | restore the pre-fix splice `[threat, buildWindow, ...ability, ...close]` | **RED** |
| T2 | P2 the Alchemist settle runs after its build | `leadsWithResolve = false` | **RED** |
| T3b | D15-1 Warlord / P1 Scholar | delete the `rearm` arm step (build window re-gathers) | **RED** (both) |
| T4 | D15-1 Warlord | neuter `relocateEffectBelowThreat` (return `steps`) | **RED** |
| T6 | D15-1 Warlord | neuter `buildBlockedByThreat` (allow building under the marker) | **RED** |
| T8 | D15-2 Abbot | `activeCharacterOf` returns the seat's first claim | **RED** |
| T9 | P5 the Museum offer still tucks | neuter `withMuseumOffer` | **RED** |
| T3c | P5 Museum / P3 Trader | delete `rearm` | **RED** (both) |
| T5b | P1..P6 (my file) | `endTurnThen` always prepends `END_TURN` (double close) | **GREEN — finding** |
| T10 | verification11 P3 / verification14 P4 | pre-fix13c `endTurnThen` (step past a bare resolve/threat) | **GREEN — finding** |

**Two probes stayed GREEN and both are findings.**

1. **T5b.** `endTurnThen` replaced with an unconditional `[END_TURN, ...rest]` leaves
   all six of my probes green. My probes compare refused-vs-plain end states, and the
   double close fires on both paths, so the relative comparison cannot see it. The
   double close is caught by `verification11` P3 and by `engine-coverage.test.ts`
   ("an end-of-turn district fires once per turn"), which redden 13 tests under this
   neuter — so the guard exists elsewhere, but **my file does not own a close-once
   probe**. I am reporting the gap rather than adding a guard the brief did not ask for;
   verification11 P3 already covers it.
2. **T10.** The pre-fix13c `endTurnThen` form (step past a bare resolve or a threat
   window, else prepend `END_TURN`) is **green on verification11 P3 and verification14
   P4 at this head** for my fixtures. The fix13c payload re-arm changed the stack shape
   so the old form no longer double-closes on these boards; verification11 P3 remains
   the guard that reddens on the current-form neuter (T5b), which is the behaviour that
   matters. Not a defect in the head; recorded so the next pass does not mistake the
   pre-fix form for a live regression.

**T4 confirms the defect is the relocation, not a fixture:** neutering
`relocateEffectBelowThreat` makes the refused Warlord match the plain one, which is
exactly the divergence D15-1 reports from the other direction. **T8** confirms the
two-character keying holds: forcing `activeCharacterOf` to the seat's first claim
reddens D15-2.

## Sweep coverage

The threatened-vs-plain adaptive sweep (re-read the hand at every build window, same
entropy for both folds) over all 26 threatenable characters:

- **Rich board** (BOB 30 gold, 5-card hand, rival Watchtower): **0 divergences** — this
  is P6, and it is the guard a future general-order regression reddens.
- **Random low-purse boards** (BOB 0-25 gold, 0-5 cards, rival 1-2 cheap districts,
  150 seeds x 26 characters): the divergences are **Abbot, Warlord, Marshal, Diplomat**
  only — every other character reaches the plain end state on every clean fold. The
  four are exactly the characters whose ability is gold-gated (destroy/seize/exchange
  price, richest clause); the Trader, Wizard, Artist, Cardinal, Spy, Emperor, Queen,
  Tax Collector, and the window-only characters are clean.
- **Two-character seat** (3-player draft, BOB holds thief+abbot, threat names abbot,
  callRank 5): the refused turn diverges by the same D15-2 mechanism, and the threat
  keys on the **acting** character (abbot), not BOB's first claim — T8 pins it.

## New defects from 536f78d

None. The D14-1 fix itself is sound: no double count, no lost payload, no conservation
break, no window that re-offers forever, no turn that runs twice (all six probes plus
P6 clean). The D15 family predates 536f78d (introduced by aa6f553) and 536f78d neither
fixed nor worsened it.

## Continuation-shape attacks (the brief's question 2)

- **Can `rearm` overwrite a pending a later window owns?** No. `rearm` is an `arm` step
  whose `pending` is `turnGatheredPending(seat)`; it sits directly beneath the build
  window, and the Museum offer is appended by `withMuseumOffer` AFTER the build, reading
  the standing pending (P5, T3c, T9). The Alchemist settle resolve leads the continuation
  instead (`leadsWithResolve`), so the build window keeps the settle beneath it (P2, T2).
- **Can the build window run after the turn's `END_TURN`?** No. The threatened branch
  splits `below` at the first `end-turn`: `ability` above it, `close` (everything from
  the `end-turn` on) below the build window, so the build window always precedes the
  turn's own close.
- **Can an `endAt < 0` fold strand a step or skip the close?** No. With no `end-turn` in
  the continuation the branch treats all of `below` as `ability` and `close` is empty;
  `endTurnThen` then supplies an `END_TURN`. I folded a hand-built threatened Scholar
  stack with a `call` but no `end-turn` (`turn, blackmailer-threat, call, end-round`):
  it drains `turn,blackmailer-threat,blackmailer-resolve,scholar-keep,turn,turn,...,
  draft-pick` and settles on a clean `draft-pick`, no stranded step.

## Done-predicate clause-by-clause

| # | Clause | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | Full game reaches terminal for 3-6 seats | **PASS** | Unchanged this pass; my folds all reach a fresh draft from a real deal. |
| 2 | Every character implemented with a behavioral test | **FAIL** | D15-1..3: a refused threatened Warlord/Marshal/Diplomat/Abbot no longer equals its plain turn. |
| 3 | Every district implemented with a test per unique effect | **PASS** | No district defect; the Museum offer rides the close (P5), the Smithy close-once holds under verification11 P3. |
| 4 | Exact scoring | **PASS** | Unchanged; prior scorers hold. |
| 5 | Hidden information never crosses `project`; two peers converge | **PASS** | Unchanged; the `arm` step and `threats` stay engine bookkeeping and the arm step round-trips the codec (verification14 P2). |
| 6 | No unverified file; `vp test` and `tsc` green | **FAIL** | `tsc` is green, but the suite goes red the moment `verification15.test.ts` lands (3 failed \| 711 passed). |

## What is verified vs unverified

**Verified this pass** (measured, not read):

- Every prior pass's counterexample: verification-report through verification14,
  14 files / 115 tests, all green.
- The D14-1 fix's four clauses (Scholar draw-before-build, Alchemist settle-after-build,
  Trader windows, Navigator resolve-step gain) and the new continuation shape (rearm,
  close position, `endAt < 0`).
- The 26-character adaptive rich-board sweep: 0/26 refused-vs-plain divergences (P6).
- The D15 family: Warlord, Marshal, Diplomat, Abbot diverge on a refused threat over
  random low-purse boards; the other 22 characters are clean.
- The D15 family is introduced by aa6f553 (fix13c), not by 536f78d.

**Unverified / not checked:** the six preset casts; scoring under two claims; terminal
and winner resolution under every stack shape; determinism and convergence at 2-7
seats; and — still open from passes 10-14 — no data-driven test compares the 27
character `summary` strings to rules.json. The full 30-district coverage audit (which
district still lacks a guard that reddens when the engine stops invoking it) is not
re-derived here; verification11-14 report no district defect.

## What a human should still scrutinize

1. **The D15 fix shape.** The relocation must preserve each ability's plain-turn
   position relative to the gather. A naive "move the ability windows below the threat"
   is exactly what produced D15; the fix must re-seat the gather or the windows so a
   pre-gather ability stays pre-gather. This is a `helpers.ts` ordering change and
   touches the D10 seating (`withThreat`) — the coordinator serializes it.
2. **The close-once guard gap (T5b).** My probes are relative and cannot see a
   symmetric double close; verification11 P3 and `engine-coverage.test.ts` own it.
3. **The character summaries.** Still no rules.json comparison (passes 10-14 flagged
   the same gap).

## Appendix: exact verify output

```
$ scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification15.test.ts \
    --own shared/core/tests/lockstep/citadels/verification15.test.ts
== vitest (the gate) ==
 ❯ shared/core/tests/lockstep/citadels/verification15.test.ts (9 tests | 3 failed)
   × D15-1 a refused threatened Warlord destroys on its post-gather purse, the plain turn cannot
   × D15-2 a refused threatened Abbot resolves its richest clause on the post-gather purse
   × D15-3 the purse-timing family: a refused Marshal and Diplomat diverge from their plain turns
 Test Files  1 failed (1)
      Tests  3 failed | 6 passed (9)
VERIFY FAILED: vitest
```

```
$ vp test shared/core/tests/lockstep/citadels/
 Test Files  1 failed | 87 passed (88)
      Tests  3 failed | 711 passed (714)
```

The 3 red: D15-1..3. The 6 green: P1-P6.

## Deviation reported (standing order 4)

None. I wrote only the two files named in my brief. Every source edit for the teeth
audit was made in `/tmp/citadels-v15` (a `git archive` copy, restored from the shared
worktree after each probe); no `checkout`/`switch`/`stash`/`reset`/`rebase`/`branch` ran
in the shared worktree. The D15 fix touches `helpers.ts` (and likely the `withThreat`
seating), both shared, so it is routed to the coordinator rather than attempted here.

## Report

- **Status:** FAIL — 3 real defects (D15-1/2/3, one family: a refused threatened seat's
  purse-gated ability sees the post-gather purse), 6 seam clauses verified clean.
- **Files written:** `shared/core/tests/lockstep/citadels/verification15.test.ts` (new),
  `orchestrate/citadels/verification-15.md` (this report).
- **Verify command:** `scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification15.test.ts --own shared/core/tests/lockstep/citadels/verification15.test.ts`
- **Raw result:** `Tests 3 failed | 6 passed (9)`; `VERIFY FAILED: vitest`.
- **Commit SHA:** <filled after commit>
- **Shared-file change needed:** `helpers.ts` — the threatened branch of `resolveTurn`
  (with `relocateEffectBelowThreat` and `withThreat`) must preserve each ability's
  plain-turn position relative to the gather, so a pre-gather ability (Warlord destroy,
  Marshal seize, Diplomat exchange, Abbot richest) still runs pre-gather on a refused
  turn. Coordinator-owned.
