# Citadels game definition: eighth independent verification

Verifier: review sub-agent (adversarial, eighth pass). I did not write this
module. Source head under review: `feat/citadels-game-definitions`, worktree
`/home/kevin/.t3/worktrees/boardgame/t3-a32da114`. Head `0ab24e2`. The citadels
suite is green at 80 files / 646 tests before my file lands.

Product: this report plus
`shared/core/tests/lockstep/citadels/verification8.test.ts` — 2 counterexamples,
each failing against this head, plus 3 positive probes.

## Verdict

**FAIL.** The seventh-pass fix is real and its seven clauses hold — I re-proved
the whole family by differential (below) and the D7 counterexamples are green. But
the two-character dimension the seventh pass opened is still not swept. The
seventh pass fixed the clauses that read the *seat's* character; it did not touch
the two places where the dimension itself changes the engine's shape:

1. **D8-1** — the Witch's resumed turn (the second, bewitched-character turn) never
   calls `declareSchoolOfMagic`, so the School of Magic is undeclared for the whole
   resumed turn. The D7-6 fix corrected `incomeTypeOf` but not the declaration
   call site that the resume path bypasses.
2. **D8-2** — the Theater's own two-character clause is unimplemented. In 2-3
   player games the rulebook lets the owner choose *which* of its two characters to
   give; the resolver always gives the lowest-rank claim and reads no choice.

Both are the "one clause beside a fix that just landed" pattern the brief warns
about, both are reachable only when a seat holds two characters, and neither is
caught by any guard (no guard file pins a two-character seat — see the teeth
audit).

## How to reproduce

```
scripts/citadels-verify.sh \
  shared/core/tests/lockstep/citadels/verification8.test.ts \
  --own shared/core/tests/lockstep/citadels/verification8.test.ts
# => VERIFY FAILED: vitest   (Tests 2 failed | 3 passed (5))
```

Whole citadels suite with this file added:

```
vp test shared/core/tests/lockstep/citadels/
# => Test Files  1 failed | 80 passed (81)
#    Tests  2 failed | 649 passed (651)
```

`npx tsc -p tsconfig.citadels.json` is green (rc=0).

## Defects (each has a failing test in verification8.test.ts)

### D8-1 — the Witch's resumed turn never declares her School of Magic

The School of Magic declares its colour through `declareSchoolOfMagic`
(`districts/school-of-magic.ts`), and the only caller is `applyCall`
(`helpers.ts:952`): "The School of Magic declares its colour when the turn opens,
above the resolve step that runs this character's income, so the income counts
it." An ordinary character turn gets that declaration. The Witch's resumed turn
does not: `witchResolve` (`characters/witch.ts:88`) builds `resumeStack` =
`[RESOLVE, turn-window, ...]` and never calls `declareSchoolOfMagic`. So when the
Witch plays the bewitched character's turn with her own city, the School of Magic
is still undeclared — it keeps its catalog type (`unique`) and the income misses
it.

`rules.json` (witch): "You then resume your turn as if you were playing the
bewitched character: you use that character's abilities and build limit, with YOUR
hand, YOUR gold, and YOUR city." The School of Magic is in the Witch's city, so it
must declare for the character she is playing.

Counterexample: *"D8-1 the Witch resuming as a bewitched Bishop declares her
School of Magic"*. Setup: a 3-seat game, ANN holds the Witch, BOB the Bishop,
CARA the Warlord; ANN's city is a lone School of Magic, her hand is one card, her
purse 0. The Witch bewitches the Bishop; on the resume she plays the Bishop with
her own city.

Measured on head: the card's `declaredType` is `undefined` (never declared) and
the purse ends at **2** (her +2 gather only). Expected: `declaredType` =
`religious` and the purse at **3** (the Bishop's 1-per-religious counts the
school).

Control (a normal Bishop turn, ANN holding the Bishop as her own character): the
school declares `religious` and the purse ends at 3 — the declaration path works
for an ordinary turn and only the resume misses it.

Root-cause probe: in a `/tmp` copy I added
`declareSchoolOfMagic(resumed, witchSeat, bewitched)` to the `witch-resume`
branch of `witchResolve`. The counterexample flips green and the control stays
green; restoring the copy returns it to red. No source file in the shared worktree
was touched.

### D8-2 — a 2-3 player Theater ignores the owner's choice of which character to give

`rules.json` (theatre): "At the start of the round you may exchange your character
card for a random character card from another player. You choose the player
blindly. **In 2-3 player games you choose which of your two characters to give and
randomly take one of your opponent's.**"

`theaterResolve` (`districts/theater.ts:70`) implements only the blind half: it
reads the target seat, takes `inRankOrder(mine)[0]` (the owner's lowest-rank
claim) unconditionally, and reads no give-choice from the action. A seat holding
two characters therefore cannot hand over its higher-rank one.

Counterexample: *"D8-2 a 2-3 player Theater lets its owner give its higher-rank
character"*. Setup: ANN holds assassin (rank 1) and merchant (rank 6), BOB holds
king and bishop; the `theatre-swap` window is open owed by ANN. ANN sends
`{ t: "keep", index: 1 }` (the merchant).

Measured on head: ANN's claims are unchanged `["assassin","merchant"]` — the
action is ignored and the lowest-rank assassin is always the one given. Expected:
the merchant leaves ANN's claims.

The existing `districts/theater.test.ts` pins the *defect* as the rule (its comment
reads "The owner gave up their lowest-rank character", and its "the owner's
lowest-rank claim specifically changed" row asserts the merchant stays). No test
drives a give-choice, so the clause is unverified.

## The teeth audit

Method: `cp -r` the worktree to `/tmp/citadels-v8`, patch one source file in the
copy, re-run the named guard with `-t`, record RED/GREEN, restore. No git command
ran in the shared worktree. 26 probes: the brief's named guards, the four rows the
sixth pass strengthened (T1-T4), and the reverse direction on twelve.

### Forward (revert/neuter the fix, the guard must redden)

| # | Guard | Reverted | Result |
|---|-------|----------|--------|
| F1 | the engine reaches navigator | `NAVIGATOR_GOLD` 4 -> 2 | **RED** |
| F2 | the Spy takes 1 gold per matching card | `transferGold` -> no-op | **RED** |
| F3 | the Thief takes the owner's gold | `loot` -> 0 | **RED** |
| F4 | the Warlord cannot destroy the Keep | `keepProtects` -> false | **RED** |
| F5 | the Great Wall toll | toll -> 0 | **RED** |
| F6 | the Trader gains 1 gold per trade | `typeOfPlaced === "trade"` -> false | **RED** |
| F7 | the Laboratory discards one card for two gold, once | reward -> 0 | **RED** |
| F8 | the Poor House pays one gold to an empty purse, once | refill removed | **RED** |
| F9 | the engine reaches school-of-magic | `recordType` chosen -> null | **RED** |
| F11 | the engine reaches navigator (card branch) | `NAVIGATOR_CARDS` 4 -> 1 | **RED** |
| T1 | the engine reaches school-of-magic | turn-open `declareSchoolOfMagic` removed | **RED** |
| T2 | the engine reaches cardinal | shortfall branch disabled | **RED** |
| T3 | the engine reaches blackmailer | threatened-build deferral disabled | **RED** |
| T4 | the engine reaches witch | resume `RESOLVE` step removed | **RED** |

All fourteen forward probes turn RED. In particular the four rows the sixth pass
found weak (T1-T4) are sharp: each reddens on revert.

### Reverse (remove the behaviour, the guard must redden)

| Guard | Behaviour removed | Result |
|-------|-------------------|--------|
| the engine reaches observatory | draw-three clause | **RED** |
| the engine reaches monument | five-district gate | **RED** |
| the engine reaches secret-vault | cannot-build refusal | **RED** |
| the Spy takes 1 gold per matching card | match count -> 0 | **RED** |
| the engine reaches cardinal | shortfall cover -> 0 | **RED** |
| the engine reaches navigator | `withoutBuild` neutered | **RED** |
| the engine reaches alchemist | refund removed | **RED** |
| an Architect that is the seat's second character | `BUILD_LIMITS.architect` 3 -> 1 | **RED** |
| the engine reaches wizard | Wizard take -> null | **RED** |
| the engine reaches keep | `keepProtects` -> false | **RED** |
| the engine reaches great-wall | toll -> 0 | **RED** |
| the engine reaches blackmailer | threat assignment emptied | **RED** |

Every sampled guard that pins behaviour turns RED in both directions.

### The two green probes are findings, not noise

- **R8b (`ARCHITECT_BUILD_LIMIT` 3 -> 1) leaves `verification7.test.ts` GREEN.**
  The seventh-pass D7-2 counterexample passes because the *helpers* build limit is
  what the engine reads; the character file's exported constant is dead weight for
  the limit. A2 confirmed the live clause reddens
  (`helpers.ts BUILD_LIMITS.architect` 3 -> 1 turns "the engine reaches architect"
  RED, and turns D7-2 RED). So the guard has teeth through `helpers.ts`; the
  character-file constant is a redundant mirror. Not a defect, but a reader trap.
- **B1/B2 (`incomeTypeOf` returning null) leave both the D7-6 row and the
  school-of-magic guard GREEN.** With `declareSchoolOfMagic` setting the colour at
  turn open, the `onIncome` re-declaration is a second, redundant path for an
  ordinary turn; neutering it changes nothing the guards observe. It is only
  load-bearing on the Witch's resume — which is exactly the path D8-1 proves is
  never declared. This is the strongest evidence that D8-1 is real: the fix that
  should have covered the resume (D7-6's `incomeTypeOf`) cannot, because the
  resume never reaches the declaration step that calls it.

### The guard-file gap (the brief asked specifically)

No guard pins a two-character seat. `engine-coverage.test.ts` — the structural
guard — folds one-character seats everywhere: its `armedTurn` helper sets
`claimed: [{ seat: ANN, character }]`, and both hand-built `claimed` arrays (lines
391, 545) give every seat exactly one claim. Only `verification7.test.ts` (the
seventh pass's own counterexamples) and `scaffold.test.ts` ever put two claims on
one seat. So the guard suite cannot catch D8-1 or D8-2, and a future regression of
the seventh-pass family would be caught only by the seventh pass's file. This is a
finding: the guard file should fold a two-character seat.

## Done-predicate clause-by-clause

| # | Clause | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | Full game reaches terminal (one winner) for 3-6 seats | **PASS** | Integration folds 3/4/5/6 seats and six casts; my P2 also folds **2 and 7 seats** to `over` with the deck conserved at 68. |
| 2 | Every character implemented with a behavioral test | **FAIL** | D8-1: the Witch's resume misplays the School of Magic in her city. The Witch guard folds a one-character seat and never checks a city district. |
| 3 | Every district implemented with a test per unique effect | **FAIL** | D8-2: the Theater's 2-3 player give-choice clause is unimplemented and unverified; the existing test pins the defect. |
| 4 | Exact scoring: cost sum, five-type bonus, 4 first / 2 other, unique points, tie-breaks | **PASS** | The prior-pass scorers hold; the declared-type scorers and the revealed-rank tie-break are green. D8-1 corrupts a declared-type income in the resume case, but the scoring code is correct. |
| 5 | Hidden information never crosses `project`; two peers converge | **PASS** | Integration covers 3-6 seats; my P3/P4 extend convergence and redaction to **2 and 7 seats** — both green. |
| 6 | No unverified file; `vp test` and `vp typecheck` green | **FAIL** | `tsc -p tsconfig.citadels.json` is green, but the suite goes red the moment `verification8.test.ts` is added (2 failed | 649 passed). |

## What is verified vs unverified

**Verified:** the deck catalog; genesis deals and conserves (68 cards at 2 and 7
seats, terminal); the draft spare at 2/3/4/5/6/7 seats (`perSeat` = 2 for <=3
seats, discards 4/2/3/2/1/1 as the catalog says); the phase machine reaches
terminal for 2-7 seats; convergence and redaction at 2 and 7 seats; the naming
sub-machine; the colour bonus and declared-type scorers; the revealed-rank
tie-break; `tsc` green; the D1..D14, V2, D3, D4, D5, D6, and D7 fixes all hold
(their counterexamples green, and I re-proved the whole D7 family by differential —
see below); the sampled character and district guards have teeth in both
directions (14 forward, 12 reverse, all RED).

**The D7 family differential.** I folded every one of the 27 characters' turns
twice — once as the seat's only claim, once as the seat's second (higher-rank)
claim — and compared gold, hand size, city, and the rival's gold and city. All 27
match, and a School-of-Magic differential over the 10 income characters (declared
type and gold) also matches. The seven seventh-pass clauses are genuinely fixed
and there is no remaining `claimOf`-vs-acting-character reader in the module
(`grep` finds `claimOf` only as `activeCharacterOf`'s fallback at helpers.ts:394).

**Unverified / broken:** the Witch's resume declaration path (D8-1); the Theater's
2-3 player give-choice (D8-2). Neither is reachable from any guard, because no
guard folds a two-character seat.

## What a human should still scrutinize

1. **The D8-1 fix shape.** The resume stack should declare the school the same way
   `applyCall` does, for the bewitched character: `declareSchoolOfMagic(resumed,
   witchSeat, bewitched)` before `resumeStack`. The wrinkle is the same import
   cycle the D7-6 fix inlined to avoid — `witch.ts` is a character file and
   `declareSchoolOfMagic` is already exported from
   `districts/school-of-magic.ts`, so a direct import is available and needs no
   new runtime edge (the module already imports helpers, which imports
   school-of-magic). Confirm the cycle does not bite.
2. **The D8-2 fix shape.** The rulebook gives the owner a choice only at 2-3 seats.
   The window is already `oneOf`; the resolver can read a `keep` index from the
   owner (0/1) when `perSeat` is 2, defaulting to the lowest claim when absent.
   The existing `theater.test.ts` rows that pin the lowest-rank-only behaviour must
   be re-framed, not weakened.
3. **The guard-file gap.** `engine-coverage.test.ts` should fold at least one
   two-character seat per character (the acting character as the seat's second
   claim) so the seventh- and eighth-pass families cannot regress silently. This is
   the structural fix the last three passes have each asked for and that still has
   not landed.
4. **The character summaries.** I re-read all 27 against `rules.json`; the summaries
   are faithful paraphrases and no new prose defect surfaced. No test compares them
   to `rules.json`, which a human may still want to decide on.

## Appendix: exact verify output

```
$ scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification8.test.ts \
    --own shared/core/tests/lockstep/citadels/verification8.test.ts
== vitest (the gate) ==
 ❯ shared/core/tests/lockstep/citadels/verification8.test.ts (5 tests | 2 failed) 58ms
   × D8-1 the Witch resuming as a bewitched Bishop declares her School of Magic
   × D8-2 a 2-3 player Theater lets its owner give its higher-rank character
 Test Files  1 failed (1)
      Tests  2 failed | 3 passed (5)
VERIFY FAILED: vitest
```

```
$ vp test shared/core/tests/lockstep/citadels/
 Test Files  1 failed | 80 passed (81)
      Tests  2 failed | 648 passed (650)
```

The 2 red tests, in file order: D8-1, D8-2. The 3 green: P1, P2, P3.
