# Citadels game definition: sixteenth independent verification

Verifier: review sub-agent (adversarial, sixteenth pass). I did not write this
module. Source head under review: `feat/citadels-game-definitions`, worktree
`/home/kevin/.t3/worktrees/boardgame/t3-a32da114`, head `e12a21c` (the working
tree is at `b93d686`, a docs/chore commit whose only delta from `e12a21c` is
`orchestrate/` — no source changed). The citadels suite is green at 88 files /
715 tests before my file lands; it is 89 files / 720 tests with it (2 red).

Product: this report plus
`shared/core/tests/lockstep/citadels/verification16.test.ts` — 2 counterexamples,
failing against this head, plus 3 positive probes.

## Verdict

**FAIL.** The D15 fix itself holds: the plain turn gathers before its ability, the
refused turn equals the plain turn (P1), the first-pass guard keeps the Spy
gathering once (P2), and the Alchemist settle refund still runs after its build
(P3). I re-ran every prior pass counterexample: `verification-report` through
`verification15`, 15 files / 125 tests, all green. The re-framed fixtures
(`verification2` x6, `verification14` D14-1, `verification15` D15-1) still have
teeth where it matters (see the audit below).

But the fix **introduced a new defect** in the Witch resume, which the brief did
not name and no prior pass caught:

- **D16-1 (real, new at 3a3c85d).** The Witch's resumed turn gathers a second
  time. Her held turn gathers her fixed +2; the resume turn is the bewitched
  character's turn and must gather nothing ("You then resume your turn as if you
  were playing the bewitched character: you use that character's abilities and
  build limit, with YOUR hand, YOUR gold, and YOUR city"). fix15's relocation
  moves the bewitched ability's window **below** the resume's turn window, so the
  ability's own pending (the Warlord's `warlord-pick`, the Scholar's pool, the
  Magician's swap record, ...) now survives to that window. `resolveTurn` reads
  the resume marker off the pending (`incoming?.note === WITCH_RESUME_NOTE`), so
  it no longer recognizes the resumed turn: the `resumedWitch` branch does not
  fire and the window takes the **gather** path. Measured on an empty-city board:
  ANN's gold reaches **4** where the rule caps it at 2. On the pre-fix head
  (`b02a47a`) the same board ends at 2, so the defect is new at the D15 commit.

Attribution (measured by folding the same board at each head): clean at `aa6f553`,
`5305109`, `536f78d` (all end at 2); at `e12a21c` (fix15, `3a3c85d`) the resume
gathers and ANN ends at 4. The defect is the fix15 plain-turn relocation, not the
D14 splice.

## How to reproduce

```
scripts/citadels-verify.sh \
  shared/core/tests/lockstep/citadels/verification16.test.ts \
  --own shared/core/tests/lockstep/citadels/verification16.test.ts
# => VERIFY FAILED: vitest   (Tests 2 failed | 3 passed (5))
```

`vp test shared/core/tests/lockstep/citadels/` adds exactly 2 failing tests to the
suite (D16-1, D16-1b); P1-P3 are green, and every prior verification file stays
green.

## Defect

### D16-1 — the Witch's resumed turn gathers a second time

Counterexamples *"D16-1 the Witch resume turn must not gather a second time"* and
*"D16-1b the Witch resume double-gather reproduces through a real deal"*.

| path | window order | ANN gold |
|---|---|---|
| Witch holds, resume as Warlord (pre-fix `b02a47a`) | `-,choose-character,turn,turn,turn,witch-takeover,witch-resume,warlord-destroy,turn,draft-pick` | 2 |
| Witch holds, resume as Warlord (head `e12a21c`) | `-,choose-character,turn,turn,turn,witch-takeover,witch-resume,turn,warlord-destroy,turn,draft-pick` | 4 |

Note the extra `turn` window between `witch-resume` and `warlord-destroy` at the
head: that is the resume turn gathering. Before fix15 the Warlord's destroy window
led the continuation (it was above the resume turn window); fix15 relocated it
**below** that window, and the pending it carries now defeats the resume marker.

Root cause. `applyCall`/`witchResolve` arm the resume stack as
`[RESOLVE, turn, ...rest]` with `pending = { character: bewitched, note: WITCH_RESUME_NOTE }`
(witch.ts `resumeStack` + `witchResolve`). The RESOLVE step runs the bewitched
effect, which pushes its ability window above the turn window; `relocateEffectBelowThreat`
now moves that window below the turn window (the fix15 plain-turn branch). The
turn window then runs with the ability's pending (e.g. `warlord-pick`) standing,
not the resume marker, so `resolveTurn`'s `resumePending` is null, `resumedWitch`
is false, `heldWitch` is false (incoming is not null), and the window takes the
gather branch: `gatherGold(state, seat, ...)` adds +2 and hands the turn a build
window. The resumed turn should take the `alreadyGathered` path instead
(`resumedWitch === true`), which skips the gather and marks the turn.

The blast radius is every window-opening character the Witch can bewitch. On an
empty-city board (ANN 0 gold), the resume over-gathers to a peak of 4 for
**Thief, Magician, Wizard, Seer, Emperor, Abbot, Cardinal, Scholar, Warlord,
Diplomat, Marshal, Tax Collector** (2 is correct), to 6 for **Navigator**, and to
3 for **Merchant**. The Spy, Blackmailer, King, Patrician, Bishop, Alchemist,
Trader, Architect, Artist, and Queen escape on this board — their ability window
either opens below the turn window already or moves no gold the resume would
re-add — but the rule is violated for the whole window-opening family, and the
same mechanism will bite any of them on a board where their window carries a
payload that survives to the resume turn window.

**Fix shape (helpers.ts + characters/witch.ts, shared — report and stop).** The
relocation must not move the bewitched effect's window past the resume turn
window, or `resolveTurn` must recognize the resume turn from the stack rather than
the pending (e.g. key it off a `WITCH_RESUME_NOTE` riding a step, or exempt the
`witch-resume` turn from the relocation the way the held Witch turn is exempt).
Either shape touches shared files; the coordinator owns it.

## The teeth audit

Method: `git archive HEAD | tar -x -C /tmp/citadels-v16` (no git command ran in
the shared worktree), patch one source file in the copy with a Python replace that
**asserts the pattern is present** (a no-op patch cannot masquerade as a pass), run
the named guard with `-t`, record RED/GREEN, restore from the shared worktree by
copy. Also compared against a pre-fix archive (`git archive b02a47a`) and the
intermediate heads (`aa6f553`, `5305109`, `536f78d`).

| # | Guard | Neuter | Result |
|---|-------|--------|--------|
| T1 | D16-1 / D16-1b (my file) | pre-fix archive `b02a47a` (fix absent) | **GREEN — the defect is new at fix15** |
| T1b | D16-1 / D16-1b (my file) | plain-relocation neuter (`if (threatAt < 0) return steps`) | **GREEN — pre-fix behaviour** |
| T2 | P1 (my file) | plain-relocation neuter | **RED** |
| T3 | P2 (my file) | first-pass guard neuter (`if (hasArmAbove \|\| !hasWindowAbove) return steps` -> `if (false)`) | **RED** |
| T4 | verification15 Spy / D15-1..3 | first-pass guard neuter | **RED** (Spy) |
| T5 | verification15 D15-1..3 | plain-relocation neuter | **RED** |
| T6 | verification14 D14-1 | pre-D14 splice (`[threat, buildWindow, ...ability, rearm, ...close]`) | **RED** |
| T7 | verification14 D14-1 | plain-relocation neuter | **GREEN — finding (see below)** |
| T8 | verification2 x6 window rows | plain-relocation neuter | **RED** (6/6) |

**Two findings from the audit.**

1. **T7 — the re-framed `verification14` D14-1 fixture no longer has teeth against
   the D15 relocation.** Reverting the plain relocation (`if (threatAt < 0) return
   steps`) leaves all 5 `verification14` rows green, while it reddens the 6
   `verification2` window rows and 3 `verification15` rows. The re-frame changed
   `firstBuild = plain.purposes.indexOf("turn")` to
   `plain.purposes.findIndex((p, i) => i > keep && p === "turn")` so it still
   passes with the ability window above the gather (`-,scholar-keep,turn,...`):
   the keep at index 1 is still less than the first `turn` after it at index 2.
   The assertion encodes the *relationship* (keep before build) but is blind to
   *where the gather sits*, which is exactly what the D15 fix changed. It still
   reddens under the D14 splice neuter (T6), so the D14-1 contract is guarded —
   but a reader should know the D14-1 row is not the guard for the plain-turn
   relocation; `verification2`'s six rows and `verification15`'s three are.
2. **The first-pass guard has teeth, but only the Spy has an absolute-gold guard.**
   Neuter `if (hasArmAbove || !hasWindowAbove) return steps` and the suite reddens
   only `verification15`'s Spy row and `engine-coverage`'s thief/spy reachability
   rows. My absolute-gold sweep shows the neuter double-gathers **five** multi-pass
   effects — Spy (peak 8 vs 2), Assassin (4 vs 2), Magistrate (4 vs 2), Thief (4 vs
   2), Blackmailer (0 vs 0, but 6 turn windows vs 4) — while Seer/Wizard/Magician
   escape because their effects open no window above the turn window. The guard is
   load-bearing for all five; only the Spy is directly pinned. Not a defect at the
   head (the guard holds), but a coverage gap worth a general multi-pass probe.

## Attack of the new plain-turn order (the brief's question 2)

All measured at the head with an adaptive policy that re-reads the hand at every
build window and refuses the threat. For each window-opening character:

- **Post-gather purse.** Every ability window now opens on the step **after** the
  gather `turn` window (the scratch trace: `-,turn,<ability>,turn,...`), and the
  plain and refused folds reach the same end state on four boards (empty, low-
  purse, mixed, rich) x 27 characters, plus a 500-seed random differential sweep
  (3- and 4-player, with and without a Museum): **0 divergences**. The D15 family
  (Warlord/Marshal/Diplomat/Abbot) is fixed.
- **Build follows the ability.** The Scholar draws and keeps before it builds
  (P1 in verification15; measured `-,turn,scholar-keep,turn,...`); the Architect
  builds 3, the Seer 2, the Trader its trade chain plus its limit build; the
  Cardinal's shortfall offer and the Alchemist's settle both survive.
- **Alchemist.** The settle refund still runs after the build (P3); its build
  limit re-offers; measured gold 2 on the v16-p3 board for both folds.
- **Navigator.** Its gain rides the resolve step and its turn takes no build; the
  refused turn matches the plain. **Witch.** She is exempt from the relocation,
  but the resume path is exactly where D16-1 lives (the exemption covers her
  held turn, not the bewitched effect's window on the resume).
- **Two-character seat.** Keyed on the acting character (`activeCharacterOf`), not
  the seat's first claim: I folded BOB holding thief+warlord and thief+scholar
  with the threat naming the second claim; refused == plain in both.

## The arm/rearm seam (the brief's question 3)

- **A rearm overwriting a pending a later window owns.** No. The `rearm` is an
  `arm` step with `pending = turnGatheredPending(seat)`, planted directly beneath
  the build window; the Museum offer reads the standing pending and the Alchemist
  settle resolve leads the continuation. P5 of verification15 pins the Museum
  case.
- **A build window running after the turn's END_TURN.** No. Across 4 boards x 27
  characters x plain/refused, no state had two `end-turn` steps or a build window
  after the first `end-turn` in the same turn segment. The threatened branch
  splits `below` at the first `end-turn`; the plain `afterGather` does the same.
- **An `endAt < 0` fold stranding a step or double-closing.** No. A hand-built
  stack with no `end-turn` still drains to a clean `draft-pick`; `endTurnThen`
  supplies the close. One nuance: the plain `afterGather`'s `endAt < 0` branch
  puts the build window directly under the gather (`[buildWindow, ...endTurnThen(below)]`),
  so an ability window would drain **after** the build — but that branch is
  unreachable from the engine (every engine-armed turn carries an `END_TURN`), and
  a hand-built stack with an ability window and no `end-turn` is not a reachable
  position. Recorded, not a defect.

## Coverage

Re-derived: every one of the 27 characters and 30 districts has at least one test
that fails when the engine stops invoking it (`engine-coverage.test.ts`'s
character and district guards, plus the per-character files). The two standing
gaps from passes 10-15 remain:

- **No data-driven test compares the 27 character `summary` strings to
  `rules.json`.** `verification5` pins three summaries (Bishop, Tax Collector,
  Blackmailer) by hand; the other 24 are unguarded. Still open.
- **The first-pass guard is pinned only for the Spy** (finding 2 above).

## Done-predicate clause-by-clause

| # | Clause | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | Full game reaches terminal for 3-6 seats | **PASS** | Unchanged this pass; my folds all reach a fresh draft from a real deal. |
| 2 | Every character implemented with a behavioral test | **FAIL** | D16-1: the Witch's resumed turn gathers a second time, so a resume as any window-opening character over-pays its holder. |
| 3 | Every district implemented with a test per unique effect | **PASS** | No district defect this pass; the Museum offer still rides the close, the Smithy/Laboratory/Park/Poor House close-once rows hold. |
| 4 | Exact scoring | **PASS** | Unchanged; prior scorers hold. |
| 5 | Hidden information never crosses `project`; two peers converge | **PASS** | Unchanged; the `arm` step round-trips the codec (verification14 P2). |
| 6 | No unverified file; `vp test` and `tsc` green | **FAIL** | `tsc` is green; the suite goes red the moment `verification16.test.ts` lands (2 failed \| 718 passed). |

## What is verified vs unverified

**Verified this pass** (measured, not read):

- Every prior pass counterexample: `verification-report` through `verification15`,
  15 files / 125 tests, all green at the head.
- The D15 fix's clauses: plain gather-before-ability (P1), refused == plain, the
  first-pass guard (P2), the Alchemist settle-after-build (P3).
- A 500-seed random differential sweep (27 characters x 3-4 players x Museum
  on/off): 0 refused-vs-plain divergences.
- The Witch resume defect: reproduced through a hand-built stack and a real deal;
  attributed to fix15 by folding the same board at `aa6f553`, `5305109`,
  `536f78d` (all 2) and `e12a21c` (4).

**Unverified / not checked:** the six preset casts; scoring under two claims;
determinism and convergence at 2-7 seats; and the 24 unguarded character summaries.

## What a human should still scrutinize

1. **The Witch resume fix shape.** The relocation must not move the bewitched
   effect's window past the resume turn window, or `resolveTurn` must recognize
   the resume turn from the stack. This is a `helpers.ts` / `characters/witch.ts`
   ordering change — the coordinator serializes it.
2. **The D14-1 re-frame (T7).** `verification14` D14-1 no longer reddens on the
   D15 relocation; `verification2`'s six rows and `verification15`'s three are the
   live guards for the plain-turn order.
3. **The multi-pass guard (finding 2).** Only the Spy is pinned for the
   first-pass guard; a general multi-pass absolute-gold probe would close it.
4. **The character summaries.** Still no `rules.json` comparison (passes 10-15
   flagged the same gap).

## Appendix: exact verify output

```
$ scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification16.test.ts \
    --own shared/core/tests/lockstep/citadels/verification16.test.ts
== vitest (the gate) ==
 ❯ shared/core/tests/lockstep/citadels/verification16.test.ts (5 tests | 2 failed)
   × D16-1 the Witch resume turn must not gather a second time
   × D16-1b the Witch resume double-gather reproduces through a real deal
 Test Files  1 failed (1)
      Tests  2 failed | 3 passed (5)
VERIFY FAILED: vitest
```

```
$ vp test shared/core/tests/lockstep/citadels/
 Test Files  1 failed | 88 passed (89)
      Tests  2 failed | 718 passed (720)
```

## Deviation reported (standing order 4)

None. I wrote only the two files named in my brief. Every source edit for the
teeth audit was made in `/tmp/citadels-v16` (and the comparison archives in
`/tmp/citadels-<sha>`), a `git archive` copy restored from the shared worktree
after each probe; no `checkout`/`switch`/`stash`/`reset`/`rebase`/`branch` ran in
the shared worktree. The D16-1 fix touches `helpers.ts` and
`characters/witch.ts`, both shared, so it is routed to the coordinator rather than
attempted here.

## Report

- **Status:** FAIL — 1 real defect (D16-1, the Witch's resume double-gather, new
  at the D15 fix 3a3c85d), 3 D15-fix clauses verified clean, 2 audit findings.
- **Files written:** `shared/core/tests/lockstep/citadels/verification16.test.ts` (new),
  `orchestrate/citadels/verification-16.md` (this report).
- **Verify command:** `scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification16.test.ts --own shared/core/tests/lockstep/citadels/verification16.test.ts`
- **Raw result:** `Tests 2 failed | 3 passed (5)`; `VERIFY FAILED: vitest`.
- **Commit SHA:** 4bb5f57 (report + test file)
- **Shared-file change needed:** `helpers.ts` + `characters/witch.ts` — the plain-
  turn relocation must not move the bewitched effect's window past the
  `witch-resume` turn window, or `resolveTurn` must recognize the resume turn from
  the stack rather than the pending, so the resumed turn takes no gather.
  Coordinator-owned.

## Correction note (fix16-witch-resume, this unit)

D16-1 is fixed. The Witch's `resumeStack` now carries the resume pending on an
explicit `arm` step directly above the resume turn window
(`[RESOLVE, arm(resumePending), turn, ...rest]`); the relocation's first-pass
guard (`hasArmAbove`) then reads that arm and skips, so the bewitched effect's
window keeps its place below the resume turn window and `resolveTurn` recognizes
the resumed turn from the pending. No shared `helpers.ts` change was needed, so
the coordinator's "shared-file change needed" line above is superseded: the fix is
`characters/witch.ts` only.

The two audit findings are closed:

- **Finding 2 (the multi-pass guard).** `verification16.test.ts` P4 parameterizes
  the one-gather guard over all five multi-pass effects (Spy, Assassin, Magistrate,
  Thief, Blackmailer). Neuter the first-pass guard (`if (hasArmAbove ||
  !hasWindowAbove)` -> `if (false)`) and all five rows redden: Spy 8,
  Assassin 4, Magistrate 4, Thief 4, Blackmailer 6 (each 2 at head).
- **T7 (the D14-1 re-frame).** `verification14` D14-1 now also asserts the plain
  gather turn window leads the `scholar-keep` window (gather -> abilities ->
  build). Reverting the plain relocation (`if (threatAt < 0) return steps`)
  leaves `-,scholar-keep,turn,...` and reddens the row, which the keep-before-build
  assertion alone could not see. Its D14-splice teeth (T6) are preserved: the
  pre-D14 splice still reddens D14-1 (plus P1 and P4).
