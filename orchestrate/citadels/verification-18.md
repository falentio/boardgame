# Citadels game definition: eighteenth independent verification

Verifier: review sub-agent (adversarial, eighteenth pass). I did not write this
module. Source head under review: feat/citadels-game-definitions, worktree
/home/kevin/.t3/worktrees/boardgame/t3-a32da114, head 5e86a02 (the worktree tip
ad90de6 is a chore commit whose only delta is under orchestrate/). The citadels
suite is green at 90 files / 734 tests before my file lands; it is 91 files /
741 tests with it (2 red).

Product: this report plus
shared/core/tests/lockstep/citadels/verification18.test.ts - 2 counterexamples,
failing against this head, plus 5 positive probes.

## Verdict

**FAIL.** The D17 redesign (33b9165 + 5e86a02) does what it claims for the
clobber family: the resume identity is now owned state (`state.resume`), so the
Abbot/Emperor/Spy/Blackmailer resumes land on the Witch (D17-2..5 closed), the
Scholar/Architect resume no longer double-gathers (D17-1 closed), the record is
codec-round-tripped and cleared at turn end (P1, P2), and the old
`WITCH_RESUME_NOTE` export is gone (P4). I re-ran every prior pass
counterexample: verification-report through verification17 stay green (P5 pins
the D13/D14/D15 refused-Scholar contract).

But the redesign fixed the *identity* half of the seam and left the *turn-shape*
half open. The resume is still armed as the generic `[RESOLVE, arm, turn, ...]`,
and two bewitched characters key their first pass off the stack around the turn
window, so their ability mis-runs on the resume:

- **D18-1 (real, new at fix16, still open).** The **Alchemist's** Witch resume
  loses its end-of-turn build refund. The Alchemist's effect runs twice; its
  turn-open pass is detected by `atTurnTop(ctx.rest)`, which reads `ctx.rest[0]`.
  The fix16 `arm` step sits directly above the resume turn window and is
  `rest[0]`, so the effect takes the END pass immediately, refunds 0, and the
  build lands with no settle step below it. Measured: the resume ends on **5**
  gold where the plain turn ends on **7**.
- **D18-2 (real, new at fix16, still open).** The **Navigator's** Witch resume
  never offers the four-gold-or-four-cards choice. The Navigator's turn window
  IS its gain choice; an ordinary Navigator turn arms `[turn(choice), RESOLVE,
  ...]`. The resume arms the generic `[RESOLVE, arm, turn, ...]`, so the
  Navigator effect runs *before* the turn window, reads the resume tag as its
  note (not the cards marker), takes the four-gold branch, and strips the turn
  window it never reached. Measured: no window opens after `witch-resume`, and
  the Witch's hand does not grow.

Both are the *same* seam: the resume turn is built from a fixed template rather
than from the bewitched character's own armed turn. **This is a FIFTH family in
the turn-ordering seam.** The design pass on the identity closed D17-1..5 but not
the seam.

## The seam: a fifth family, and the under-specified rule

The brief asks for this explicitly. Every defect since D13 has been in the
ordering of a character ability window relative to the gather and the build.
D17 was the identity of the resume; D18 is the *shape* of the resume.

The under-specified rule: **the resume must arm the bewitched character's own
turn, not a generic `[RESOLVE, arm, turn, ...]`.** `applyCall` builds an
ordinary turn as `[RESOLVE, turn, END_TURN, ...]` for every character except the
Navigator, whose turn window is its gain choice (`[turn, RESOLVE, END_TURN,
...]`). `witchResolve`'s `resumeStack` hard-codes the non-Navigator template and
inserts an `arm` step the ordinary turn does not have. Two consequences fall
out:

1. **A character whose effect inspects `ctx.rest[0]` is defeated by the arm
   step.** The Alchemist's `atTurnTop` reads the top of its continuation to tell
   its turn-open pass from its end pass. The ordinary turn hands it the turn
   window; the resume hands it the arm step, so it skips the turn-open pass and
   refunds nothing (D18-1).
2. **A character whose turn window is its choice is defeated by the fixed
   order.** The Navigator's effect must run *below* its turn window; the resume
   runs it above, so it reads the wrong note and strips the window (D18-2).

Both are the same under-specification: **the resume's turn is not the bewitched
character's own turn.** The fix that closes D18-1..2 is not another per-character
patch; it is to make the resume re-use the character's own armed turn shape (the
Navigator's `[turn, RESOLVE, ...]` vs everyone else's `[RESOLVE, turn, ...]`)
with the owned `state.resume` identity, and to give the Alchemist's turn-open
detection a signal the resume cannot break. This is a design question on the
seam, per the coordinator's convergence note.

Attribution (measured by folding the same board at each head): both defects are
clean at 536f78d (fix14), appear at 73a5258 (fix16, the arm-step relocation),
and persist at 33b9165 and the head. The redesign moved the failure, it did not
close it: D18-1 and D18-2 are the D16-1/D17 family's own next cases.

## How to reproduce

    scripts/citadels-verify.sh \
      shared/core/tests/lockstep/citadels/verification18.test.ts \
      --own shared/core/tests/lockstep/citadels/verification18.test.ts
    # => VERIFY FAILED: vitest   (Tests 2 failed | 5 passed (7))

vp test shared/core/tests/lockstep/citadels/ adds exactly 2 failing tests to the
suite (D18-1, D18-2); P1-P5 are green, and every prior verification file stays
green.

## The defects

### D18-1 - the Alchemist's resume loses its end-of-turn build refund

Counterexample *"D18-1 the Alchemist's Witch resume loses its end-of-turn build
refund"*.

The rule (rules.json alchemist): "At the end of your turn, take back the gold you
paid to build districts this turn." The rule (rules.json witch): the resume
"uses that character's abilities and build limit, with YOUR hand, YOUR gold, and
YOUR city."

| board | resume purse | plain purse |
|---|---|---|
| Witch holds, resume as Alchemist, build one district (head) | 5 | 7 |
| same board at 536f78d (pre-fix16) | 7 | 7 |

Root cause. `alchemist.ts` distinguishes its two passes with
`atTurnTop(ctx.rest)`, which reads `ctx.rest[0]` and is true only when the turn
window is directly ahead. `applyCall` arms an ordinary Alchemist turn as
`[RESOLVE, turn, END_TURN, ...]`, so the effect's first pass sees the turn window
at `rest[0]`, tags the pending `alchemist-settle`, and pushes `[turn, RESOLVE,
...]` so the end pass runs *below* the build. The resume stack is `[RESOLVE,
arm, turn, ...]`: fix16's `arm` step stands at `rest[0]`, so `atTurnTop` is
false, the effect takes the END pass immediately (refund 0, clear the pending),
and the build then lands with no settle step below it. The D17 redesign kept the
arm step and did not touch this.

**Fix shape (shared - report and stop).** The resume must arm the bewitched
character's own turn shape. Two candidate shapes, both shared-file edits:
either `resumeStack` re-uses the character's own template (so the Alchemist sees
the turn window at `rest[0]`), or `alchemist.ts` stops reading `rest[0]` and
keys its two passes off a signal the resume cannot break. The first is the seam
fix; the second is the per-character patch the design pass was meant to avoid.

### D18-2 - the Navigator's resume never offers the gain choice

Counterexample *"D18-2 the Navigator's Witch resume never offers the four-cards
choice"*.

The rule (rules.json navigator): "Gain either four gold or four cards." The rule
(rules.json witch): the resume "uses that character's abilities".

Measured: no window opens after `witch-resume`, and the Witch's hand does not
grow (the resume forces four gold).

Root cause. `navigator.ts` reads its choice from `pending.note ===
NAVIGATOR_CARDS_NOTE`, which `resolveTurn` writes when the Navigator's turn
window resolves. `applyCall` special-cases the Navigator's turn as
`[turn(choice), RESOLVE, END_TURN, ...]` so the choice window opens before the
effect. The resume stack is the generic `[RESOLVE, arm, turn, ...]`, so the
Navigator effect runs above the turn window, reads the resume tag `"witch-resume"`
as its note (not the cards marker), takes the four-gold branch, and
`withoutBuild` strips the turn window it never reached. The Witch can never take
four cards on the resume.

**Fix shape (shared - report and stop).** Same seam fix as D18-1: the resume must
arm the Navigator's own `[turn, RESOLVE, ...]` shape so the choice window opens
and the effect reads the chosen branch.

## The teeth audit

Method: `git archive HEAD | tar -x -C /tmp/citadels-v18` (no git command ran in
the shared worktree), patch one source file in the copy with a Python/Node
replace that **asserts the pattern is present** (a no-op patch cannot masquerade
as a pass), run the named guard, record RED/GREEN, restore from the shared
worktree by copy.

| # | Guard | Neuter | Result |
|---|-------|--------|--------|
| T1 | D18-1 Alchemist refund | delete the fix16 `arm` step from `resumeStack` (witch.ts) | **D18-1 goes GREEN** - the arm step is the cause; D18-2 stays RED |
| T2 | P4 tag inertness / D18-1 | `seatHolding` resume branch -> null | **RED** (D18-1, D18-2) |
| T3 | P4 buildLimit | `buildLimit` resume branch -> null | **RED** (D18-1, D18-2, P4) |
| T4 | P2 codec round-trip | `stateCodec.decode` resume -> null | **RED** (D18-1, D18-2, P2) |
| T5 | P1 resume clear | drop `resume: null` from `applyEndTurn` | **RED** (D18-1, D18-2, P1) |
| T6 | P4 inert locator | `seatHolding` keyed on `pending.note === "witch-resume"` (the pre-D17 shape) | **RED** (D18-1, D18-2) |
| T7 | P3 no-leak probe | `project` carries `resume: state.resume` | **RED** (P3) |

T1 is the important row: **deleting the fix16 arm step makes D18-1 pass**, which
proves the arm step the D17 redesign kept is exactly the mechanism of D18-1, not
a bystander.

**One guard gap found and closed in my own file.** P4's original third clause
(`buildLimit(mid, ANN) === 2` on the real resume window) stayed **GREEN** under
T3, because the rank cursor happens to name the Scholar on a real resume and
`activeCharacterOf` returns the Scholar even when the resume branch is dead. I
strengthened it to `buildLimit({ ...mid, callRank: 1 }, ANN) === 2`, which
reddens under T3. Reported here per the teeth-audit rule: a guard that stays
GREEN under a neuter is a finding.

## Attack of the Witch's two turns (the brief's question 2)

I folded the resume for **every** bewitchable character (24, excluding the Witch
herself, the Assassin and the Magistrate which name through the same window) and
compared the end state to that character's own plain turn on the same board,
with the Witch's +2 removed from the plain start so both enter the ability on the
same purse:

- **Differential sweep (gold, hand, city, city-gold, tax pot).** Divergences at
  the head: the **Alchemist** (D18-1), the **Navigator** (D18-2). The Thief,
  Magician, King, Bishop, Merchant, Architect, Warlord, Tax Collector, Wizard,
  Emperor, Abbot, Diplomat, Artist, Queen, Blackmailer, Spy, Seer, Patrician,
  Cardinal, Trader, Scholar, Marshal, Assassin and Magistrate all reach their
  plain end state. So the D17-1..5 fixes hold for every clobber character and
  every re-seating character.
- **The four clobberers.** The Abbot, Emperor, Spy and Blackmailer resumes now
  act on the Witch (D17-2..5 closed): the owned record survives their
  `pending.note` writes.
- **The two re-seaters.** The Scholar and Architect resumes no longer
  double-gather (D17-1 closed): the owned record is read by position, not from
  the clobberable slot.

## Attack of the codec and project (the brief's question 3)

- **Codec.** A mid-resume snapshot (resume record set, Scholar re-seating turn
  windows and Spy writing pending.note) round-trips through
  `stateCodec.encode`/`decode` and restores the record (P2; reddens under T4).
- **No leak.** `project` carries no field for the resume record; a mid-resume
  view for a third seat exposes only that seat's own hand, never the Witch's
  (P3; reddens under T7 when `project` is made to carry `resume`).
- **The inert locator tag.** `RESUME_WINDOW_TAG` ("witch-resume") rides the
  resume arm step's pending and survives into the resume turn window's pending.
  It is a locator only: `seatHolding` and `buildLimit` key on the owned record.
  Clearing the tag on the turn window's pending does not move the owner or the
  limit (P4), and keying `seatHolding` back on the tag (the pre-D17 shape)
  reddens the identity guards (T6). The tag does **not** leak anything: it names
  the Witch's own seat and the bewitched character, both public, and
  `project` never carries `pending.note`. The tag can be defeated as a
  *locator* by any effect that rewrites the resume window's pending, but no
  engine decision reads it, so defeating it is inert.
- **The old plumbing.** `helpers.ts` no longer exports `WITCH_RESUME_NOTE`;
  the only remaining references are in the older verification reports' prose
  (verification16/17 comments), not in any decision path.

## New defects from the redesign

The redesign is a clean identity move: no double gather of its own, no lost
payload, no conservation break, no window that re-offers forever, no double
close. Its only weakness is that it left the resume's turn *shape* generic, which
is D18-1..2. **The D18 defects are in the turn-ordering seam** (the resume's turn
template), not elsewhere. No defect outside the seam was found this pass.

## Coverage

Every one of the 27 characters and 30 districts still has at least one test that
fails when the engine stops invoking it (engine-coverage.test.ts plus the
per-character files). The standing gaps from passes 10-17 remain:

- **No data-driven test compares the 27 character summary strings to rules.json.**
  verification5 pins three by hand; the other 24 are unguarded.
- **No pass has re-derived the six preset casts, scoring under two claims,
  terminal/winner resolution under every stack shape, or 2-7 seat convergence.**
  My folds all reach a fresh draft from a real deal, but that is not a full
  convergence sweep.

## Done-predicate clause-by-clause

| # | Clause | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | Full game reaches terminal for 3-6 seats | **PASS** | Unchanged; my folds reach a fresh draft from a real deal. |
| 2 | Every character implemented with a behavioral test | **FAIL** | D18-1..2: two bewitched abilities mis-run on the Witch's resume. |
| 3 | Every district implemented with a test per unique effect | **PASS** | No district defect this pass; the Museum/Smithy rows hold. |
| 4 | Exact scoring | **PASS** | Unchanged; prior scorers hold. |
| 5 | Hidden information never crosses project; two peers converge | **PASS** | P3; the resume record and pending note never cross `project`. |
| 6 | The resume identity is owned state | **PASS** | P1, P2, P4; D17-1..5 closed. |
| 7 | The resume runs the bewitched character's own turn | **FAIL** | D18-1..2. |

## REPORT

- **Status:** FAIL. 2 counterexamples (D18-1, D18-2) red at head 5e86a02, plus 5
  positive probes green. The seam is **not closed**: it is a FIFTH family in the
  turn-ordering seam (the resume's turn template), not a defect elsewhere.
- **Files written:** `shared/core/tests/lockstep/citadels/verification18.test.ts`
  (NEW), `orchestrate/citadels/verification-18.md` (this report). No source file
  edited; `git status` shows only the new test file.
- **Exact verify command:**
  `scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification18.test.ts --own shared/core/tests/lockstep/citadels/verification18.test.ts`
- **Raw result:** `Tests 2 failed | 5 passed (7)` then `VERIFY FAILED: vitest`.
- **Commit SHA:** recorded at commit time (below).
- **Deviation / shared-file change needed:** none written. The fix needs a shared
  change (`helpers.ts` `resolveTurn` / `characters/witch.ts` `resumeStack`), so
  per standing order 4 I report it and stop. The fix shape is the seam fix named
  in D18-1: arm the resume with the bewitched character's own turn shape.
