# Citadels game definition: seventeenth independent verification

Verifier: review sub-agent (adversarial, seventeenth pass). I did not write this
module. Source head under review: feat/citadels-game-definitions, worktree
/home/kevin/.t3/worktrees/boardgame/t3-a32da114. The brief names head 1f892a1; the
worktree sits at 9cd368f, a chore commit whose only delta from 1f892a1 is under
orchestrate/ - no source file changed between them (git diff 1f892a1 9cd368f
--stat -- shared/ is empty). The citadels suite is green at 89 files / 721 tests
before my file lands; it is 90 files / 731 tests with it (6 red).

Product: this report plus
shared/core/tests/lockstep/citadels/verification17.test.ts - 6 counterexamples,
failing against this head, plus 4 positive probes.

## Verdict

**FAIL.** fix16 (73a5258) does what it claims for the one case it was built for:
the Warlord resume no longer gathers a second time (P1), the D15 plain-turn order
still holds (P2), the multi-pass first-pass guard still has teeth (P3), and the
D14-1 refused-Scholar contract still holds (P4). I re-ran every prior pass
counterexample: verification-report through verification16, 16 files / 131 tests,
all green.

But the fix is narrow, and it **papered over the seam rather than closing it**. The
resume marker still rides the single pending slot, and a bewitched character whose
effect writes that slot - or re-seats its own turn windows - still breaks the
resume. Five more defects fall out of the same seam:

- **D17-1 (real, new at the D15 relocation, still open at the fix16 head).** The
  **Scholar's** Witch resume gathers a second time. Her gold reaches **4** on an
  empty board where the rule caps it at 2. This is the *same* defect D16-1 reported
  for the Warlord; fix16 fixed only the characters whose effect pushes a window
  above the resume turn window, and the Scholar is not one of them.
- **D17-2 (real).** The **Abbot's** resume pays its income to the bewitched holder,
  counted on the holder's city, instead of the Witch. Measured: the holder ends on
  4 gold (its takeover gather 2 plus 2 religious) where the rule gives it 2.
- **D17-3 (real).** The **Spy's** resume runs no ability at all: no naming windows,
  no loot. Measured: the target keeps all 4 gold and the Witch draws nothing.
- **D17-4 (real).** The **Blackmailer's** resume assigns no threat markers.
  Measured: threats is empty at the end of the resume.
- **D17-5 (real).** The **Emperor's** resume pays the crown reward to the bewitched
  holder instead of the Witch. Measured: the holder ends on 3 gold where the rule
  gives it 2.

The four defects D17-2..D17-5 share one mechanism (the effect clobbers the resume
marker in pending.note, so seatHolding falls back to the real holder); D17-1 shares
the other half of the same seam (the effect re-seats its turn windows above the
fix16 arm step). **This is a FOURTH family in the turn-ordering seam.**

## The seam: a fourth family, and the under-specified rule

The brief asks for this explicitly. Every defect since D13 has been in the ordering
of a character ability window relative to the gather and the build. D16-1 was the
first time the seam was crossed with the Witch's resume, and fix16 patched it by
moving the marker onto an arm step. That is a patch, not a rule, and it leaves the
seam under-specified in two ways:

1. **The resume marker is not owned.** resolveTurn decides "is this the Witch's
   resume?" from pending.note === WITCH_RESUME_NOTE (helpers.ts:814), and
   seatHolding / buildLimit decide "who owns this character?" the same way
   (helpers.ts:106, 439). But pending is a single shared slot that every character
   effect writes when its turn opens. Any bewitched effect that writes pending.note
   (the Abbot, Emperor, Cardinal, Spy, Blackmailer, Warlord, Marshal, Diplomat,
   Scholar, Seer, Wizard, Magician, Artist, ...) destroys the marker, and the
   resume is then re-keyed to the real holder. **The under-specified rule: the
   resume identity must be owned by a step on the stack (like the fix16 arm step),
   never by the shared pending slot.**
2. **The resume turn window must be recognized from the stack, not the pending.**
   fix16 recognized the resume by an arm step *above* the turn window; a character
   effect that re-seats its turn windows above that arm step (the Scholar and the
   Architect both call withBuildLimit, which filters and re-prepends turn windows)
   defeats it. **The under-specified rule: the resume turn window must be
   distinguishable from an ordinary turn window by position in the stack,
   independent of what any effect prepends.**

Both are the same under-specification: **the resume is a turn whose identity rides
mutable shared state instead of the immutable stack.** The fix that closes
D17-1..5 is a design pass on the seam (a step-carried resume token no effect can
clobber, read by resolveTurn and seatHolding), not another per-character patch. Per
the coordinator's convergence note in decisions.tsv, this is the fourth family and
the design-pass trigger.

Attribution (measured by folding the same board at each head): the Scholar
double-gather is clean at 5305109 (D13) and 536f78d (D14) - it appears at 3dd52f4
(fix15) and persists at the fix16 head. The owner-misroute family
(Abbot/Emperor/Spy/Blackmailer) is present at 5305109 already and persists at every
head since; it is not introduced by fix15 or fix16, but it is the same seam and
fix16 did not close it. **D17-1 is a regression of the D15 relocation; D17-2..5 are
the D13 relocation's own consequence, never previously reported.**

## How to reproduce

    scripts/citadels-verify.sh \
      shared/core/tests/lockstep/citadels/verification17.test.ts \
      --own shared/core/tests/lockstep/citadels/verification17.test.ts
    # => VERIFY FAILED: vitest   (Tests 6 failed | 4 passed (10))

vp test shared/core/tests/lockstep/citadels/ adds exactly 6 failing tests to the
suite (D17-1, D17-1b, D17-2..5); P1-P4 are green, and every prior verification file
stays green.

## The defects

### D17-1 - the Scholar's resume gathers a second time (the D16-1 defect, still open)

Counterexamples *"D17-1 the Scholar's Witch resume gathers a second time"* and
*"D17-1b the Scholar resume double-gather reproduces through a real deal"*.

The rule (rules.json witch): "You then resume your turn as if you were playing the
bewitched character: you use that character's abilities and build limit, with YOUR
hand, YOUR gold, and YOUR city." The Witch's +2 is the gather of her held turn; the
resume gathers NOTHING.

| board | window order | ANN gold |
|---|---|---|
| Witch holds, resume as Scholar (head) | -,choose-character,turn,turn,turn,witch-takeover,witch-resume,turn,scholar-keep,turn,draft-pick | 4 |
| same board at 536f78d (pre-fix15) | -,choose-character,turn,turn,turn,witch-takeover,witch-resume,scholar-keep,turn,turn,draft-pick | 2 |

Root cause. The Scholar's effect (scholar.ts) calls withBuildLimit(ctx.rest, owner,
2), which filters the round's turn window out of the continuation and **re-prepends
two fresh turn windows above it**. It also writes its own pending record (note null,
character "scholar") at the resolve step. fix16 put the resume marker on an arm step
directly above the resume turn window; the Scholar's withBuildLimit re-seats its turn
windows ABOVE that arm step, so the window resolveTurn actually visits is one of the
Scholar's own, carrying note null. resumePending is null, resumedWitch is false, and
the window takes the GATHER branch: gatherGold adds +2.

The blast radius is every effect that re-seats turn windows: the **Scholar** and the
**Architect** both call a local withBuildLimit (architect.ts:29, scholar.ts:34). On
the empty-board sweep the Architect escapes a gold test because its ability only
draws cards, but the resume still mis-orders; the Scholar is the visible gold defect.
The Navigator re-seats no turn window (it strips them) and its resume gain is +4 on
top of the held +2 = 6, which is correct.

**Fix shape (shared - report and stop).** The resume turn window must be recognized
from the stack position, not from a marker an effect can outflank: either exempt the
resume window from withBuildLimit's re-seating, or tag the resume window itself (not
the arm step) so resolveTurn reads it regardless of what the effect prepends. Both
touch helpers.ts / the two character files.

### D17-2 - the Abbot's resume pays income to the bewitched holder

Counterexample *"D17-2 the Abbot's resume pays income to the bewitched holder, not
the Witch"*.

The rule (rules.json abbot): "Gain either 1 gold or 1 card per religious district in
your city." On the resume the acting player is the Witch, so the count is HER city's
religious districts and the income is hers. Board: the Witch's city is empty; the
Abbot holder's city holds two religious districts. Measured: the holder ends on **4**
gold (its takeover gather 2 plus 2 religious) where the rule gives it 2.

Root cause. The Abbot's effect writes pending.note = "abbot-split" when its turn
opens (abbot.ts). That clobbers the resume marker, so seatHolding (helpers.ts:106,
keyed on pending.note === WITCH_RESUME_NOTE) falls back to the real Abbot holder.
ownerOf therefore returns the holder, and religiousIn(state, owner) counts the
holder's city. The same mechanism hits resolveSplit/resolveTie
(seatHolding(ctx.state, "abbot") ?? ...).

### D17-3 - the Spy's resume runs no ability at all

Counterexample *"D17-3 the Spy's resume runs no naming or loot"*.

The rule (rules.json spy): "Choose another player and name a district type, then look
at that player's hand: for each card of the named type, take 1 gold from the player
and gain 1 card from the deck." Board: the target holds two trade cards and 4 gold.
Measured: the resume opens no choose-seat window, the target keeps all 4 gold, and
the Witch draws nothing.

Root cause. The Spy's effect (spy.ts) dispatches on pending.note (null -> arm
spy-seat, spy-seat -> spy-type, spy-type -> peek, spy-peek -> apply). The resume arms
pending.character = "spy" with note "witch-resume", which is neither null nor any of
the Spy's own tags, so the effect falls through to the **apply** branch with target
=== null and returns the cleared state - no window, no loot.

### D17-4 - the Blackmailer's resume assigns no threat markers

Counterexample *"D17-4 the Blackmailer's resume assigns no threat markers"*.

The rule (rules.json blackmailer): "Assign two threat markers facedown to two
different characters." Measured: threats is empty at the end of the resume.

Root cause. Same shape as D17-3. The Blackmailer's effect dispatches on pending.note
(null -> threat-1, threat-1 -> threat-2, threat-2 -> commit). The resume's
"witch-resume" note sends it to the commit branch, whose namedCharacter is null, so
canThreat fails and no threats are recorded.

### D17-5 - the Emperor's resume pays the crown reward to the holder

Counterexample *"D17-5 the Emperor's resume pays the crown reward to the bewitched
holder"*.

The rule (rules.json emperor): "You must take the crown from its holder and give it
to a different player, not yourself, then take either 1 gold or 1 random card from
that player's stash or hand." On the resume the acting player is the Witch, so the
crown leaves her and the reward comes to her. Board: the Witch has 0 gold, the
recipient 3. Measured: the holder ends on **3** gold (takeover gather 2 plus the
1-gold reward) where the rule gives it 2.

Root cause. The Emperor's window writes pending.note = "emperor-target" (emperor.ts),
clobbering the resume marker. emperorResolve reads
seatHolding(ctx.state, "emperor") ?? ctx.window.seats[0], and with the marker gone
that resolves to the real holder, so the reward (transferGold(..., owner, 1) or
takeRandomCard(..., owner)) lands on the holder.

## The teeth audit

Method: git archive HEAD | tar -x -C /tmp/citadels-v17 (no git command ran in the
shared worktree), patch one source file in the copy with a Python replace that
**asserts the pattern is present** (a no-op patch cannot masquerade as a pass), run
the named guard, record RED/GREEN, restore from the shared worktree by copy.

| # | Guard | Neuter | Result |
|---|-------|--------|--------|
| T1 | P1 Warlord resume gathers nothing (my file) | delete the fix16 arm step from resumeStack (witch.ts) | **RED** - and D17-1..5 stay red |
| T2 | P3 Spy plain turn gathers once (my file) | first-pass guard (hasArmAbove or !hasWindowAbove) -> (false) | **RED** |
| T3 | P2 plain turn gathers before its ability (my file) | plain relocation (threatAt < 0 branch) -> return steps | **RED** |
| T4 | P4 refused threatened Scholar reaches plain (my file) | restore the pre-D14 splice [threat, buildWindow, ...ability, rearm, ...close] | **RED** |
| T5 | verification16 D16-1 / D16-1b | delete the fix16 arm step | **RED** |
| T6 | verification14 D14-1 | restore the pre-D14 splice | **RED** |
| T7 | verification14 D14-1 | plain relocation neuter | **RED** (fix16 unit closed verify-16 finding T7) |
| T8 | verification16 P2 / P4 | first-pass guard neuter | **RED** (fix16 unit closed verify-16 finding 2) |

**Every guard I cite reddens under its neuter.** The two guard gaps verify-16 named
are closed: the strengthened verification14 D14-1 now reddens under the
plain-relocation revert (T7), and verification16 P4 pins a one-gather guard for each
of the five multi-pass effects (T8). No guard stayed green.

## Attack of the Witch's two turns (the brief's question 2)

I folded the resume for **every** bewitchable character and compared the end state to
that character's own plain turn on the same board (identical entropy, adaptive
policy, stop at the first non-Witch turn window):

- **Empty-board gold sweep** (ANN 0 gold, empty hands and cities): the Witch's gold
  must never exceed 2. Measured HIGH for **Scholar (4)** and **Navigator (6)** and
  **Merchant (3)**. The Merchant and Navigator are correct (their resume income is +1
  and +4 respectively); the Scholar is D17-1.
- **Owner-keying differential** (the Witch's city empty, the holder's city
  populated): the Abbot pays the holder (D17-2), the Emperor pays the holder (D17-5),
  the Cardinal pays the holder (same mechanism, noted but not a separate test), the
  Spy runs nothing (D17-3), the Blackmailer assigns nothing (D17-4).
- **Two-character seat keying.** seatHolding returns the resume pending.actor only
  while the marker survives; once an effect clobbers it the keying reverts to
  state.claimed. This is the same failure D17-2..5 demonstrate, so the
  two-character-seat path is broken by the same mechanism.
- **School of Magic declaration.** The engine-coverage two-character test still
  passes (declaration happens in witchResolve before the resume stack is armed, and
  the Bishop writes no pending.note), so that clause holds - it is the one bewitched
  ability whose effect is marker-free.

## Attack of the D15 order (the brief's question 3)

- **Plain turn is gather -> abilities -> build.** P2 pins the Scholar's plain keep
  window opening after the gather and before the build; the sweep over 26 characters
  shows the same shape. Holds.
- **Refused turn equals the plain turn.** P4 pins the refused Scholar; the
  verification15 D15-1..3 rows and verification11 P1 stay green. Holds.
- **Threatened order is gather -> threat -> abilities -> build.** The verification13
  D13-1..11 and verification14 D14-1 rows stay green. Holds.

## New defects from the fix16 head

The fix16 change is a one-file, one-step edit. It introduces no double gather of its
own (P1 clean), no lost payload, no conservation break, no window that re-offers
forever, and no double close (the endTurnThen reuse is untouched). Its only weakness
is that it is too narrow: it fixes the resume for effects whose window pushes *above*
the turn window and leaves the rest of the seam open, which is D17-1..5.

## Coverage

Every one of the 27 characters and 30 districts still has at least one test that
fails when the engine stops invoking it (engine-coverage.test.ts plus the
per-character files). The standing gaps from passes 10-16 remain:

- **No data-driven test compares the 27 character summary strings to rules.json.**
  verification5 pins three by hand; the other 24 are unguarded.
- **No pass has re-derived the six preset casts, scoring under two claims,
  terminal/winner resolution under every stack shape, or 2-7 seat convergence.** My
  folds all reach a fresh draft from a real deal, but that is not a full convergence
  sweep.

## Done-predicate clause-by-clause

| # | Clause | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | Full game reaches terminal for 3-6 seats | **PASS** | Unchanged; my folds reach a fresh draft from a real deal. |
| 2 | Every character implemented with a behavioral test | **FAIL** | D17-1..5: five bewitched abilities mis-run on the Witch's resume. |
| 3 | Every district implemented with a test per unique effect | **PASS** | No district defect this pass; the Museum/Smithy rows hold. |
| 4 | Exact scoring | **PASS** | Unchanged; prior scorers hold. |
| 5 | Hidden information never crosses project; two peers converge | **PASS** | Unchanged; the arm step round-trips the codec (verification14 P2). |
| 6 | No unverified file; vp test and tsc green | **FAIL** | tsc is green; the suite goes red the moment verification17.test.ts lands (6 failed, 725 passed). |

## What is verified vs unverified

**Verified this pass** (measured, not read):

- Every prior pass counterexample: verification-report through verification16, 16
  files / 131 tests, all green at the head.
- The fix16 clause (Warlord resume no gather, P1) and its teeth.
- The D15 plain order (P2), the first-pass guard (P3), and the D14-1 contract (P4).
- The Scholar double-gather and the owner-misroute family, attributed across the
  heads 5305109, 536f78d, 3dd52f4, and the fix16 head.

**Unverified / not checked:** the six preset casts; scoring under two claims;
determinism and convergence at 2-7 seats; the 24 unguarded character summaries.

## What a human should still scrutinize

1. **The seam design, not another patch.** This is the fourth family. The
   under-specified rule is that the resume identity rides the shared pending slot and
   the resume window is recognized by a marker an effect can outflank. A
   step-carried resume token (read by resolveTurn and seatHolding, written by nothing
   but witchResolve) closes D17-1..5 in one place. Route it through the design pass
   named in decisions.tsv, not a per-character fix.
2. **The Cardinal.** It shares the owner-misroute mechanism (seatHolding +
   pending.note clobber). I folded it and measured a divergence on the differential
   board but did not add a counterexample, because its resume income is cards and the
   gold symptom is masked; a proper test needs a build-shortfall board. It is the
   same defect and should be closed with D17-2..5.
3. **The Architect.** Its withBuildLimit re-seats turn windows exactly as the
   Scholar's does, so the resume turn window is mis-identified; it escapes a gold
   test only because its ability moves no gold. A build-order probe on the resume
   would expose it.
4. **The character summaries.** Still no rules.json comparison (passes 10-16 flagged
   the same gap).

## Appendix: exact verify output

    $ scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification17.test.ts \
        --own shared/core/tests/lockstep/citadels/verification17.test.ts
    == vitest (the gate) ==
     x shared/core/tests/lockstep/citadels/verification17.test.ts (10 tests | 6 failed)
       x D17-1 the Scholar's Witch resume gathers a second time
       x D17-1b the Scholar resume double-gather reproduces through a real deal
       x D17-2 the Abbot's resume pays income to the bewitched holder, not the Witch
       x D17-3 the Spy's resume runs no naming or loot
       x D17-4 the Blackmailer's resume assigns no threat markers
       x D17-5 the Emperor's resume pays the crown reward to the bewitched holder
     Test Files  1 failed (1)
          Tests  6 failed | 4 passed (10)
    VERIFY FAILED: vitest

    $ vp test shared/core/tests/lockstep/citadels/
     Test Files  1 failed | 89 passed (90)
          Tests  6 failed | 725 passed (731)

## Deviation reported (standing order 4)

None. I wrote only the two files named in my brief. Every source edit for the teeth
audit was made in /tmp/citadels-v17 (a git archive copy restored from the shared
worktree after each probe); no checkout/switch/stash/reset/rebase/branch ran in the
shared worktree. The D17-1..5 fixes touch helpers.ts and the character files, all
shared, so they are routed to the coordinator rather than attempted here.

## Report

- **Status:** FAIL - 5 real defects (D17-1 the Scholar resume double-gather, new at
  the D15 relocation and still open at the fix16 head; D17-2..5 the owner-misroute
  family: Abbot, Spy, Blackmailer, Emperor), all in the turn-ordering seam. **This is
  a FOURTH family in the seam** - the coordinator's design-pass trigger. 4 seam
  clauses verified clean, 8 teeth probes red.
- **Files written:** shared/core/tests/lockstep/citadels/verification17.test.ts
  (new), orchestrate/citadels/verification-17.md (this report).
- **Verify command:** scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification17.test.ts --own shared/core/tests/lockstep/citadels/verification17.test.ts
- **Raw result:** Tests 6 failed | 4 passed (10); VERIFY FAILED: vitest.
- **Commit SHA:** <filled at commit>
- **Shared-file change needed:** helpers.ts (resolveTurn's resume detection and
  seatHolding/buildLimit keying) plus the effect files that clobber pending.note - a
  step-carried resume token no effect can overwrite. Coordinator-owned.
- **Seam:** every defect found is IN the turn-ordering seam. D17-1 is the D15
  relocation regression; D17-2..5 are the D13 relocation's consequence. No defect
  outside the seam was found.
