# Citadels game definition: nineteenth independent verification

Verifier: review sub-agent (adversarial, nineteenth pass). I did not write this
module. Source head under review: feat/citadels-game-definitions, worktree
/home/kevin/.t3/worktrees/boardgame/t3-a32da114, source head **511a50a** (the
worktree tip when I started was 775006d, a chore commit whose only delta from
511a50a is under orchestrate/; it has since advanced to c018553, another chore
commit with no source delta). The citadels suite is green at 91 files / 741 tests
before my file lands; it is 92 files / 749 tests with it (4 red).

Product: this report plus
shared/core/tests/lockstep/citadels/verification19.test.ts - 4 counterexamples,
failing against this head, plus 4 positive probes.

## Verdict

**FAIL.** The D18 fix (29d31dd + 511a50a) does exactly what it claims for the two
cases it was built for: `armCharacterTurn` is a single exported helper, and BOTH
`applyCall` and the Witch's `resumeStack` call it (P4), so the Navigator's
choice window opens above the resume resolve (P2, D18-2 closed) and the
Alchemist's turn-open pass sees the turn window at `ctx.rest[0]`, so its refund
lands (P1, D18-1 closed). The interim `RESUME_WINDOW_TAG` is gone; `grep` finds
no reference in the module (P3 cites the codec and clear, and the tag has no
remaining home). The codec still round-trips the owned resume record (P3). No
dead code remains.

But the shared helper fixed the *shape of the arming* while leaving the *shape of
the resumed turn* wrong for every window-opening character. `armCharacterTurn`
produces the plain gather-turn shape `[RESOLVE, turn, END_TURN]`, which
`relocateEffectBelowThreat` then reorders into `[turn, arm, ...abilityWindows,
END_TURN]`. `resolveTurn` visits that leading turn window with `resumedWitch`
true, so it takes the `alreadyGathered` (BUILD) branch: **the resume's build
window lands ABOVE the bewitched ability window**, the reverse of the plain turn's
gather -> abilities -> build. Two consequences fall out:

- **D19-1 (real, present since the D17 redesign, still open).** The **Scholar's**
  Witch resume cannot build the card it just kept. The resume's turn window is the
  build window and the `scholar-keep` window sits below it; closing the turn after
  the keep drops the post-ability build window. Measured: the resume builds **0**
  and keeps 1; the plain Scholar turn builds the kept card (1 build, 0 kept). The
  **Architect** shares the mechanism (its three armed build windows collapse to the
  resume's single build window), but on the boards I folded its end state happened
  to match the plain turn (2 builds each) because its draw lands regardless of
  order, so I report it as the same mechanism rather than a measured divergence.
- **D19-2 (real).** For every window-opening character the resume opens the build
  window *before* the ability window. Measured for 13 characters (Magician, Wizard,
  Spy, Thief, Blackmailer, Emperor, Abbot, Cardinal, Tax Collector, Warlord,
  Marshal, Diplomat, Artist): the resume reads `turn, <ability>...`; the plain turn
  reads `turn(gather), <ability>..., turn(build)`.

Both are the *same* seam: the resume turn is armed as the character's own turn but
*resolved* as a bare build window. **This is a SIXTH family in the turn-ordering
seam** (D13 11, D14 1, D15 3, D16 1, D17 5, D18 2, now D19 2).

## The seam: a sixth family, and the under-specified rule

The brief asks for this explicitly. Every defect since D13 has been the ordering of
a character ability window relative to the gather and the build.

The under-specified rule: **a resumed turn has no gather, so it must be abilities ->
build; the engine instead visits the resume turn window with the resume identity set
and takes the build branch, placing the build above the ability.**

The D18 fix named the right invariant ("the resume arms the bewitched character's
own turn") but implemented it as *the plain gather turn* - `armCharacterTurn`
returns `[RESOLVE, turn, END_TURN]` (or the Navigator's `[turn, RESOLVE,
END_TURN]`). That shape is correct for a turn that GATHERS on the turn window. On
the resume there is no gather: `resolveTurn`'s `resumedWitch` flag routes the
leading turn window to the `alreadyGathered` branch, which is the BUILD branch. So
the arming is right and the *resolution* is wrong: the resume turn window is the
turn's build window, not its gather, and it therefore precedes the ability the
resume exists to run.

The fix that closes D19-1..2 is not another per-character patch: the resume's
leading turn window must be recognized as a no-op (the held turn already gathered),
so the continuation `[arm, ...abilityWindows, turn(build), END_TURN]` drains in
order - the ability first, then the build - exactly as the plain turn reaches
gather -> abilities -> build. This is a `helpers.ts` / `resolveTurn` change (or a
dedicated resume-turn step kind), so it is the coordinator's to serialize.

Attribution (measured by folding the same board at each head): the Scholar resume
build loss is **clean at 3dd52f4 (fix15) and 73a5258 (fix16)** - it builds 1 - and
**appears at 33b9165 (fix17, the owned-resume redesign)** and persists at 5e86a02,
29d31dd, and the head. It is the D17 redesign's own consequence: the redesign made
the resume run the bewitched character's *effect* (which the D15 relocation then
reorders) but armed its turn window as the gather, so the build lands first.

## How to reproduce

    scripts/citadels-verify.sh \
      shared/core/tests/lockstep/citadels/verification19.test.ts \
      --own shared/core/tests/lockstep/citadels/verification19.test.ts
    # => VERIFY FAILED: vitest   (Tests 4 failed | 4 passed (8))

vp test shared/core/tests/lockstep/citadels/ adds exactly 4 failing tests to the
suite (D19-1, D19-1b, D19-2, D19-2b); P1-P4 are green, and every prior verification
file stays green.

## The defects

### D19-1 - the Scholar's Witch resume cannot build the card it kept

Counterexamples *"D19-1 the Scholar's Witch resume cannot build the card it kept"*
and *"D19-1b the Scholar resume diverges from the plain turn across seeds"*.

The rule (rules.json witch): the resume "use[s] that character's abilities and build
limit, with YOUR hand, YOUR gold, and YOUR city." rules.json (scholar): "Draw seven
cards from the deck and choose one to add to your hand ... Your building limit this
turn is two." The plain turn is gather -> draw/keep -> build, so the kept card is
buildable.

| board | resume city / kept | plain city / kept |
|---|---|---|
| empty Witch hand, deck top cheap (head) | [] / 1 | [tavern] / 0 |
| same board at 33b9165 (fix17) | [] / 1 | [tavern] / 0 |
| same board at 73a5258 (fix16) | [tavern] / 0 | [tavern] / 0 |

Root cause. The resume stack at the resume turn window is `[turn(ann), arm,
scholar-keep(ann), turn(ann), end-turn, ...]`. `resolveTurn` sees the leading turn
window with `resumedWitch` true, so `alreadyGathered` is true and it takes the
build branch: a build at that window, else `closeTurn`. The Scholar's effect (run
by the resolve below) opens `scholar-keep`, whose card the Witch keeps; the
post-keep build window is then closed away by `endTurnThen`, so the kept card is
never built. The plain turn instead reaches `[turn(gather), arm, scholar-keep,
turn(build), end-turn]`, so the keep precedes the build and the kept card is
buildable. The Architect shares the mechanism: its `withBuildLimit` re-seats three
turn windows, which the resume's single already-gathered turn window replaces, so
its build opportunities precede its draw; on the boards I folded its end state still
matched (its draw lands regardless of order), so I report the mechanism, not a
measured divergence.

**Fix shape (shared - report and stop).** The resume's leading turn window must not
be the build window: with no gather, the order must be abilities -> build, so the
build window sits below the relocated ability windows (as `relocateEffectBelowThreat`
already does for a *threatened* turn). Either recognize the resume window as a
no-op in `resolveTurn` (the held turn gathered), or arm the resume with a shape
that places the build after the effect's windows. `helpers.ts` / `resolveTurn`.

### D19-2 - the resume builds before the bewitched ability

Counterexamples *"D19-2 the resume builds before the bewitched ability, not after"*
(Magician) and *"D19-2b no window-opening resume leads with its build window"* (13
characters).

The rule: standing order 13 fixes the plain turn order as gather -> abilities ->
build; the resume has no gather, so it must be abilities -> build.

Measured window order after `witch-resume`:

| character | resume | plain |
|---|---|---|
| Magician | turn, magician-swap, magician-discard | turn(gather), magician-swap, magician-discard, turn(build) |
| Warlord | turn, warlord-destroy | turn(gather), warlord-destroy, turn(build) |
| Spy | turn, choose-seat, choose-type | turn(gather), choose-seat, choose-type, turn(build) |
| (all 13 window-openers) | turn leads the ability | the ability leads the build |

Root cause. Same as D19-1: the leading resume turn window is the build window (the
`alreadyGathered` branch), and the ability's own windows drain below it, so the
build precedes the ability.

**Fix shape (shared - report and stop).** Same seam fix as D19-1.

## The teeth audit

Method: `git archive HEAD | tar -x -C /tmp/citadels-v19` (no git command ran in the
shared worktree), patch one source file in the copy with a Node replace that
**asserts the pattern is present** (a no-op patch cannot masquerade as a pass; my
patcher exits 3 on an absent pattern), run the guard, record RED/GREEN, restore
from the shared worktree by copy.

| # | Guard | Neuter | Result |
|---|-------|--------|--------|
| T1 | D19-1/D19-2 (my file) | `alreadyGathered` drops `resumedWitch` | **RED** (D19-2, D19-2b, P1, P3) |
| T2 | P4 helper shape / P2 | `armCharacterTurn` navigator branch -> `false` | **RED** (P4, P2, D19-1, D19-1b, D19-2, D19-2b) |
| T3 | all resume guards | `resumeStack` hand-builds `[RESOLVE, turn, END_TURN, ...]` | **RED** (7 of 8) |
| T4 | P2 navigator choice | `resolveTurn` navigator note -> `null` | **RED** (P2, D19-*) |
| T5 | P3 resume clear | drop `resume: null` from `applyEndTurn` | **RED** (P3, D19-*) |
| T6 | P3 codec round-trip | `decodeResume` -> `null` | **RED** (P3, D19-*) |
| T7 | identity / P1 / P2 | `seatHolding` resume branch -> `null` | **RED** (P1, P2, D19-*) |

**Every guard I cite reddens under its neuter; no guard stayed GREEN.** Two rows
deserve a note:

- **T1 is the important row.** Dropping `resumedWitch` from `alreadyGathered`
  makes D19-1 and D19-1b **GREEN** (the Scholar resume then builds the kept card),
  which proves the resume-identity branch of `alreadyGathered` is exactly the
  mechanism of D19-1 - not a bystander. It also reddens P1 (the Alchemist) and P3,
  so the fix must not simply delete the branch; it must distinguish the resume turn
  window (no gather, ability first) from an ordinary post-gather build window.
- **T2** shows the `armCharacterTurn` Navigator branch is load-bearing for P4 (the
  helper's per-character shape) and P2 (the Navigator's choice).

## Attack of the resume turn shape end to end (the brief's question 2)

I folded the resume for every bewitchable character on one board (identical deck,
hands, gold, city for the resume and the plain fold; ANN starts on 10 so the held
+2 and the plain gather +2 both enter the ability on 12). Divergences at the head:

- **D19-1 (build-order).** Scholar (resume builds 0 keeps 1; plain builds 1 keeps
  0). The Architect shares the mechanism; its end state matched on the boards I
  folded (2 builds each), so I did not claim a divergence for it.
- **D19-2 (order).** All 13 window-opening characters open the build window before
  the ability window.
- **Alchemist, Navigator** now reach their plain end state (D18-1..2 closed), and
  the D17 identity (Abbot/Emperor/Spy/Blackmailer/Scholar re-seating) holds: no
  owner-misroute or double-gather returned.
- **Emperor/Navigator gold rows** in the sweep are correct, not defects: the
  Navigator's resume gain (+4) and the Emperor's reward (+1) are the bewitched
  ability the resume must run; the resume's total (16 / 13) is 2 more than the plain
  (14 / 12) because the plain fold's `-2` alignment does not cancel the *held* turn
  +2 for a character that also gains. I checked each by hand; the divergence there
  is the fixture's purse bookkeeping, not the engine.

## Attack of the shared arming helper (the brief's question 3)

`armCharacterTurn(character, seat, rest)` is exported once from `helpers.ts` and
called by exactly two sites: `applyCall` (`armCharacterTurn(character, seat, [CALL,
...rest])`) and `witchResolve`'s `resumeStack` (`armCharacterTurn(bewitched,
witchSeat, rest)`). No other site hand-builds a turn shape; the resume passes no
extra steps of its own. So the *arming* cannot diverge again - a future character
whose armed shape differs is handled by the one helper (P4 pins it). **But the
helper only shapes the arm; the *resolution* of the resume turn window is still
special-cased by `resumedWitch` in `resolveTurn`, and that is where D19 lives.**
The seam did not re-open through a hand-built copy; it re-opened because the shared
helper produces the gather-turn shape and the resolver treats the resume window as
already gathered. The under-specified rule is the *resolution*, not the arming.

## New defects from the fix (the brief's question 5)

The D18 fix introduces no double gather of its own, no lost payload, no
conservation break, no window that re-offers forever, no double close, and no
district hook that fires twice. Its only weakness is that it made the resume *arm*
the bewitched turn without making the resume *resolve* as that turn; D19-1..2 are
that gap. **No defect outside the turn-ordering seam was found this pass.**

## Coverage

Every one of the 27 characters and 30 districts still has at least one test that
fails when the engine stops invoking it (engine-coverage.test.ts plus the
per-character files). The standing gaps from passes 10-18 remain:

- **No data-driven test compares the 27 character summary strings to rules.json.**
  verification5 pins three by hand; the other 24 are unguarded.
- **No pass has re-derived the six preset casts, scoring under two claims,
  terminal/winner resolution under every stack shape, or 2-7 seat convergence.** My
  folds all reach a fresh draft from a real deal, but that is not a full sweep.
- **The Scholar resume build order was unguarded** until this pass; D19-1 and D19-1b
  now cover it.

## Done-predicate clause-by-clause

| # | Clause | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | Full game reaches terminal for 3-6 seats | **PASS** | Unchanged; my folds reach a fresh draft from a real deal. |
| 2 | Every character implemented with a behavioral test | **FAIL** | D19-1: the Scholar's resume drops the build the plain turn takes. |
| 3 | Every district implemented with a test per unique effect | **PASS** | No district defect this pass. |
| 4 | Exact scoring | **PASS** | Unchanged; prior scorers hold. |
| 5 | Hidden information never crosses project; two peers converge | **PASS** | Unchanged; the resume record round-trips the codec (P3). |
| 6 | The resume arms the bewitched character's own turn | **PASS** | P4; `applyCall` and the resume call the same helper. |
| 7 | The resume *resolves* as the bewitched character's own turn | **FAIL** | D19-1..2: the resume's build window leads the ability. |

## REPORT

- **Status:** FAIL. 4 counterexamples (D19-1, D19-1b, D19-2, D19-2b) red at the
  head, plus 4 positive probes green. **The seam is not closed: it is a SIXTH family
  in the turn-ordering seam** (the resume turn window resolved as the build window),
  not a defect elsewhere. No defect outside the seam was found.
- **Files written:** `shared/core/tests/lockstep/citadels/verification19.test.ts`
  (NEW), `orchestrate/citadels/verification-19.md` (this report). No source file
  edited.
- **Exact verify command:**
  `scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification19.test.ts --own shared/core/tests/lockstep/citadels/verification19.test.ts`
- **Raw result:** `Tests 4 failed | 4 passed (8)` then `VERIFY FAILED: vitest`.
  `npx tsc -p tsconfig.citadels.json` is clean (rc 0).
- **Commit SHA:** b411d2c (the test file); 87abac5 (this report).
- **Deviation / shared-file change needed:** none written. The fix needs a shared
  change (`helpers.ts` `resolveTurn`'s `resumedWitch` handling of the leading turn
  window, or a resume-turn step kind), so per standing order 4 I report it and stop.
  The fix shape is the seam fix named in D19-1: the resume has no gather, so its
  turn must drain abilities -> build.
- **Seam:** every defect found is IN the turn-ordering seam. D19-1 is the D17
  redesign's consequence (the resume runs the bewitched effect, which the D15
  relocation reorders, but its turn window is resolved as the gather/build). D19-2
  is the same mechanism for every window-opening character.
