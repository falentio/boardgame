# Citadels game definition: second independent verification

Verifier: review sub-agent (adversarial, second pass). I did not write this
module. Head under review: `feat/citadels-game-definitions`, worktree
`/home/kevin/.t3/worktrees/boardgame/t3-a32da114`, commit `866fef7`.

Product: this report plus
`shared/core/tests/lockstep/citadels/verification2.test.ts`, 15 counterexample
tests, every one of which fails against this head.

## Verdict

**FAIL.** The first pass's blocking defect (D1: no character ability ran) is
genuinely fixed: `applyCall` now arms `pending` and pushes a `resolve` step, and
effects do run. The first pass's 14 counterexamples all pass. But the fix is
shallow in the same place it was broken before. The engine runs an effect only
when the effect's window names explicit seats; every effect that opens the shared
"any" window (the Assassin, Witch, Magistrate, Thief, Spy, and Blackmailer) has
that window silently dropped by the drain loop before anyone can answer it. So a
real folded game still runs no kill, no rob, no bewitch, no warrant, and no peek.
The first pass's D1 counterexample missed this because the Magician and Warlord,
whose windows do name seats, surface fine.

Five more real defects survive, including one the D1 commit introduced: every
end-of-turn district (Laboratory, Smithy, Park, Poor House) fires twice per turn.

## How to reproduce

```
scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification2.test.ts
# => VERIFY FAILED: vitest  (15 failed)
```

First pass's file still green: `verification-report.test.ts` => 14 passed.
Whole citadels suite with this file added:
`vp test shared/core/tests/lockstep/citadels`
=> **1 failed | 72 passed (73 files)**, **15 failed | 531 passed (546 tests)**.
The 531 are the module's own suite plus the first pass; the 15 are these
counterexamples. `tsc -p tsconfig.citadels.json` is green.

## Re-running the first pass

All 14 first-pass counterexamples pass. Each fix addresses the defect it names,
not the test:

| Fix | Defect | Verified |
|-----|--------|----------|
| 91a57df | D1 engine runs effects; D7 duplicate rule; D8 finish order; D10 Museum seam; D13 totality; D14 discard leak | D1 partially (see V2-1); D7, D8, D10, D13, D14 hold |
| 7b1a1c9 | D11 Thieves' Den mixed payment | builds, but gold share never debited (V2-4) |
| fdf9d20 | D2 beautify, D3 held Vault, D12 Ivory Tower | all hold |
| 04db150 | D4 Great Wall, D5 Keep, D6 Bishop shield, D9 declared type | D4/D5/D6 hold; D9 missed two counters (V2-5) |
| e887390 | D9 declared type in income | same partial gap (V2-5) |

The D1 fix is real work: `applyCall` (helpers.ts:659) now pushes
`RESOLVE, winStep("turn"), END_TURN, CALL, ...rest`, and the `{kind:"resolve"}`
branch of `applyImmediate` runs `CHARACTER_EFFECTS[pending.character]`. The
Magician, Warlord, Wizard, Emperor, Abbot, Cardinal, Trader, Scholar, Seer,
Diplomat, Marshal, Tax Collector, and Architect all surface a window or a
visible state change through the engine now.

## Defects (each has a failing test in verification2.test.ts)

### V2-1 — The "any" naming windows are dropped by the drain loop (blocking)

`drain` in windows.ts:68-71 decides whether to stop at a window with
`owedFor(next, top.window)`, which filters the window's explicit `seats` list.
The Assassin, Witch, Magistrate, Thief, Spy, and Blackmailer open
`choose-character`, `choose-seat`, or `choose-type` windows built with
`winStep(purpose, [])` (empty seats, `kind: "any"`). `owedFor` returns `[]` for
those, so `drain` treats them as unowed, pops them, and runs the resolve step
that reads the (never-set) name. `stepState` itself uses the correct
`windowOwed` (which expands `any` to `liveSeats`), so the window resolves
correctly only when it is already on top when `stepState` is entered, never when
an effect opens it under a bare resolve step.

Counterexamples: *"a folded game that names characters records at least one
kill, rob, or bewitch"*, and one per character: the Assassin's, Witch's,
Magistrate's, Thief's, and Spy's windows do not surface through the engine.

Evidence: `applyCall` for the Assassin yields `resolve, W:turn, end-turn, call,
end-round`; after one frame the stack is `W:turn, ...` with `skipped: []`. A
full 3-seat base-cast game folds to terminal in 111 frames with the window
purposes seen exactly `{draft-pick, keep, magician-discard, magician-swap, turn,
warlord-destroy}` — no naming window, and `skipped`, `robbed`, `bewitched` stay
empty for the whole game. The same state with the naming window hand-placed on
top resolves and records the kill, which pins the cause to `drain`.

### V2-2 — The Blackmailer never assigns threat markers

`blackmailer` (characters/blackmailer.ts) distinguishes its first pass by
`pending === null`, but `applyCall` now arms `pending` with the character and a
null note before the effect runs. The effect therefore takes the `mine.note ===
THREAT_1` branch on its first (and only) pass, sets `threats` from a null
`namedCharacter`, and clears pending. The two naming passes never run. A real
game never opens `blackmailer-resolve`, so no threat is ever placed.

Counterexample: *"the Blackmailer assigns threat markers through the engine"*.

### V2-3 — End-of-turn districts fire twice per turn

The turn's continuation is `[RESOLVE, winStep("turn"), END_TURN, CALL, ...rest]`.
When `resolveTurn` handles the turn window it builds `[END_TURN, ...rest]`, but
`rest` is `state.steps.slice(1)`, which still holds the continuation's own
`END_TURN`. The result is two `end-turn` steps in a row, so `applyEndTurn` runs
`runDistrictHooks(state, "onEndTurn", ...)` twice per turn. The Laboratory and
Smithy have no idempotence guard, so each charges and pays twice.

Counterexample: *"an end-of-turn district fires once per turn, not twice"*. A
turn with a Laboratory and no build leaves gold 7 and one card, not gold 5 and
two cards. This is pre-existing (the parent of 91a57df has the same
`[END_TURN, ...rest]` shape), but the first pass did not catch it because no
end-turn district ran under a real turn before D1. The existing Laboratory and
Smithy tests hand-build the turn stack as `[W:turn, end-round]` with no
`END_TURN`, so they see a single firing and stay green; the real stack from
`applyCall` carries the extra `END_TURN`.

### V2-4 — The Thieves' Den's mixed payment never debits its gold share

`thievesDenBuild` now returns `{ payCards: cost - gold }` for any split, which is
why the D11 counterexample passes. But `tryBuild` (helpers.ts:425-430) charges
no gold whenever `payCards > 0`: the card branch sets `paid = false` and skips
the gold debit entirely. With 2 gold and 2 spare cards on a cost-4 Den, the Den
builds and the 2 gold stay in the stash. The district file names this gap in its
own comment ("the matching gold share ... is not debited yet").

Counterexample: *"a mixed Thieves' Den payment spends its gold share"*. Gold
after the build is 2, not 0.

### V2-5 — The Trader and Emperor still ignore `declaredType`

The D9 fix (e887390) converted eight income counters to `typeOfPlaced` but
missed two: `trader.ts:22,52` and `emperor.ts:27` still read
`specOfDistrict(id).type`. A Trader with a School of Magic declared trade gains
0, not 1; an Emperor with a School of Magic declared noble gains 0, not 1.

Counterexamples: *"the Trader counts a School of Magic declared trade"* and
*"the Emperor counts a School of Magic declared noble"*.

### V2-6 — The Diplomat ignores the Great Wall toll

`greatWallExchangeToll` exists and is tested, but no exchange code consults it:
`diplomat.ts:115` uses `exchangeCost(taken.id, given.id)` alone. A Diplomat
exchanging a Tavern for a Palace out of a Great Wall city pays 4, not 5. This is
the Diplomat half of the first pass's D4, left unfixed while the Warlord half
landed.

Counterexample: *"the Diplomat pays one extra gold to exchange a district out of
a Great Wall city"*. Gold after the exchange is 16, not 15.

### V2-7 — The Alchemist's refund is dead

`alchemist` reads `pending.gold` for the gold paid to build, but no build path
writes `pending.gold` (only the gather sets it, to the keep count). The effect
also runs at the top of the turn, before the turn's build. An Alchemist that
builds a Tavern ends the turn with 9 gold, not the 10 it started with.

Counterexample: *"the Alchemist takes back the gold it spent building this
turn"*.

### V2-8 — The Armory's destroy ability never fires

`armoryTriggers` declares `["onDestroy"]`, but `runDistrictHooks` is only ever
called with `onBuild`, `onDraw`, `onIncome`, `onEndTurn`, and `onRoundStart`.
Nothing calls it with `onDestroy`, so the Armory never opens `armory-destroy` in
a real game. `district-windows.test.ts` stays green because it hand-places the
window rather than building the Armory and taking a turn.

Counterexample: *"a seat that built the Armory is offered its destroy window on
its turn"*. A turn with the Armory in the city shows only `call, turn,
draft-pick, ...`.

### V2-9 — A pass on the Museum's placement offer still places a card

`museumPlace` (districts/museum.ts:46-47) treats any non-`null` report as a
placement: `const wanted = action.t === "keep" ? action.index : 0`. A `pass`
action is non-null, so it coerces to index 0 and tucks the hand's first card
under the Museum. The rule is "you may place", so declining must place nothing.

Counterexample: *"a pass on the Museum's placement offer places no card"*. The
card under the Museum is 1, and the hand loses its first card.

## Done-predicate clause-by-clause

| # | Clause | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | Full game reaches terminal (one winner) for 3-6 seats and 3+ casts | **PASS (weak)** | Folds to `phase: "over"` for 3/4/5/6 seats and three casts; but the naming sub-machine is dead (V2-1, V2-2), so it terminates a game missing six characters' abilities. |
| 2 | All 27 characters implemented with a named test | **FAIL** | 27 files and 27 tests exist, but the Assassin, Witch, Magistrate, Thief, Spy, and Blackmailer abilities never run through the engine (V2-1, V2-2), and the Alchemist's refund is dead (V2-7). |
| 3 | Every district with a test per unique effect | **FAIL** | 30 files, 30 tests, but the Armory never fires (V2-8); the Museum's decline is wrong (V2-9); the Thieves' Den under-charges (V2-4); the Great Wall's Diplomat half is ignored (V2-6); every end-turn district double-fires (V2-3). |
| 4 | Exact scoring: cost sum, 3 for five types, 4 first / 2 other, unique points, tie-breaks | **PASS (weak)** | D2, D3, D8, D12 all hold. V2-4 (a free 2 gold) and V2-3 (double income) shift real games' gold, which can change the gold tie-break. The scoring formulas themselves are right. |
| 5 | Hidden information never crosses `project`; two peers converge | **PASS** | D14 holds: unkept gather cards sink to the deck. `project` still omits deck, draft, pool, facedown, and other hands. Two peers converge (integration test, re-checked). |
| 6 | No unverified file; `vp test` and `vp typecheck` green | **FAIL** | The suite is green only because no test folds a game and asserts a naming window opens. `tsc -p tsconfig.citadels.json` is green. |

## Coverage audit

**Characters (27).** The existing tests call each effect function directly. A
test that would fail if the engine stopped invoking the character exists for the
Magician, Warlord, Wizard, Emperor, Abbot, Cardinal, Trader, Scholar, Seer,
Diplomat, Marshal, Tax Collector, and Architect (their windows surface, and the
character tests drive them through `advance`). It does **not** exist for:

- **Assassin, Witch, Magistrate, Thief, Spy, Blackmailer** — their tests hand-build
  the `choose-character`/`choose-seat`/`choose-type` window and call the resolver
  directly, never folding a game to the window. V2-1/V2-2 cover these.
- **King, Bishop, Merchant, Patrician, Queen, Artist, Alchemist, Navigator** — no
  test asserts the engine reaches them. Some are visible in a folded game (the
  crown moves, income lands), but none is pinned by a failing test. The Alchemist
  is actively broken (V2-7).
- **Architect, Scholar, Trader, Seer, Tax Collector** — a window surfaces, but the
  tests mostly call the effect directly; only the window's existence is
  engine-checked, not its full rule.

**Districts (30).** A test that would fail if the engine stopped invoking the
district exists for the hooks that actually fire: Gold Mine (`onIncome`),
Library/Observatory (`onDraw`), Factory/Quarry/Necropolis/Framework/Stables/
Monument/Secret Vault/Thieves' Den (`onBuild`), Park/Poor House/Smithy/Laboratory
(`onEndTurn`), Theater (`onRoundStart`). It does **not** exist for:

- **Armory** — `onDestroy` never fires (V2-8). Its test hand-places the window.
- **Great Wall, Keep** — registered under `onDestroy` (never fires); their real
  clauses are consulted directly by the Warlord, which is tested. The Diplomat
  half of the Great Wall is untested and unfixed (V2-6).
- **Museum** — the placement offer fires, but no test asserts the decline is a
  decline (V2-9); the existing tests place a card.
- **Basilica, Capitol, Dragon Gate, Imperial Treasury, Ivory Tower, Map Room,
  Statue, Wishing Well, Haunted Quarter, School of Magic** — end-game scorers.
  `scoreGame` folds them, and the scoring tests exercise several through
  `scoreGame`; a full-game fold never reaches most because their uniques are not
  in the default deck. The scorer-level tests are real, but no test would fail if
  the engine stopped *dealing* them.

## The three "tautological" tests the first pass flagged

- `scaffold.test.ts` "every character ... has its own file, an effect, and a
  resolver wiring" — still `typeof ... === "function"`. Still passes with a stub.
  It matters less now that D1 is fixed for named-seat windows, but it is still not
  a behavioral test.
- `district-triggers.test.ts` "every row is the array its own district file
  exports" — still a tautology over the registry (`UNIQUE_TRIGGERS[id]` is the
  file's own array). It proves wiring, not behavior.
- `district-windows.test.ts` "stepState tries the district registry before the
  character registry" — still `indexOf` over source text. Worse now: the file's
  other tests hand-place `armory-destroy` and `theatre-swap` windows, so they stay
  green while the Armory never fires in a real game (V2-8).

All three still assert nothing about engine behavior. They did not cause V2-1
(the naming windows are engine-opened and would have been caught by a folded-game
test), but they did hide V2-8.

## What is verified vs unverified

**Verified:** the deck catalog; the registries are total; genesis deals and
conserves; the draft is hidden; gather and build work; the phase machine reaches
terminal for 3-6 seats and 3 casts; the colour bonus and 4/2 completion split;
D2, D3, D7, D8, D12, D13, D14 hold; codec round-trip; convergence; `tsc` green.

**Unverified / broken:** the six "any"-window characters (V2-1); the Blackmailer
(V2-2); every end-turn district's once-per-turn clause (V2-3); the Thieves' Den's
gold share (V2-4); the Trader's and Emperor's declared type (V2-5); the
Diplomat's Great Wall toll (V2-6); the Alchemist's refund (V2-7); the Armory
(V2-8); the Museum's decline (V2-9).

## Verdict on the done predicate

The module does **not** meet the done predicate. Clauses 2, 3, and 6 are false,
and clause 1 is true only for a game that is not Citadels. The D1 fix moved the
engine from "no ability runs" to "abilities with named-seat windows run"; the
shared-window characters are still dark, and the fix introduced a double
end-turn.

## What a human should still scrutinize

1. **The drain/stepState asymmetry (V2-1).** This is the load-bearing one. `drain`
   must use `windowOwed`, not `owedFor`, or six characters stay dead. A single
   folded-game test that asserts a `choose-character` window opens would have
   caught it.
2. **The double end-turn (V2-3).** Any fix to the naming windows must not paper
   over this; both live in the same `resolveTurn`/`applyCall` seam.
3. **Coverage honesty.** 27 character tests and 30 district tests exist, but the
   ones that matter (does the engine reach it?) are missing for 14 characters and
   several districts. Count the tests that fold a real game, not the files.
4. **The first pass's own blind spot.** Its D1 counterexample asserted *some*
   character window opens; the Magician's did, so the counterexample passed while
   six siblings stayed broken. A per-character folded-game assertion is the fix.
