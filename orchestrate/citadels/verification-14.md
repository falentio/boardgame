# Citadels game definition: fourteenth independent verification

Verifier: review sub-agent (adversarial, fourteenth pass). I did not write this
module. Source head under review: `feat/citadels-game-definitions`, worktree
`/home/kevin/.t3/worktrees/boardgame/t3-a32da114`, head `aa6f553` (the brief's
head); the working tree is at `5975ed8`, a drain of the fix13c wave into the
store, and `git diff aa6f553..5975ed8 -- shared/core/lockstep/games/citadels/` is
empty, so the source I review is the brief's head. The citadels suite is green at
86 files / 700 tests before my file lands; it is 87 files / 705 with it (1 red).

Product: this report plus
`shared/core/tests/lockstep/citadels/verification14.test.ts` — 1 counterexample,
failing against this head, plus 4 positive probes.

## Verdict

**FAIL.** The fix13c seam itself holds: I re-proved that the `arm` step survives
the codec the engine runs between frames (P2), that a refused threatened turn
closes exactly once so the end-of-turn hooks fire once (P4), and that the Witch
exemption in `relocateEffectBelowThreat` is **unreachable** — the Witch is rank 1
and `canThreat` refuses every rank-1 character, so the D13-12 the brief hunts
cannot be constructed as a reachable game position (P3).

The relocation introduced one ordering defect the fix13c sweep did not see, and
the brief's own four-case probe named it among two artifacts and two real ones:

- **D14-1 (real).** A refused threatened **Scholar** builds before it draws, so it
  loses the build the plain turn takes. `resolveTurn`'s threatened branch splices
  the post-threat build window (`buildWindow`) directly under the threat, ABOVE the
  relocated `scholar-keep` window. The Scholar's ability is the seven-card draw and
  its keep, so on the plain turn the draw lands first and the build takes the kept
  card; the refused turn offers the build on the pre-draw hand (empty in my fixture)
  and only then draws. Measured: the plain Scholar builds one district, the refused
  Scholar builds none and ends holding the card it drew. This is the
  `scholar/museum` and `scholar/school` pair; it predates fix13c (it is the D13
  relocation's build-window splice, present at `2b6727c` as well as at the head).
- **cardinal/school and architect/school (artifacts).** The other two cases the
  brief names do **not** diverge: over 12,000 randomized boards (hands of 0-5
  districts, gold 0-21, build index 0-4, Museum present or not) the refused turn
  reaches the exact same gold, hand, and city as the plain turn, 0/6000 each (P1).
  They were a probe-policy artifact: the coordinator's probe built the first card of
  a hand whose size it did not re-read, and the Cardinal's zero-shortfall income
  window / the Architect's relocated build windows settle on the plain state.

## How to reproduce

```
scripts/citadels-verify.sh \
  shared/core/tests/lockstep/citadels/verification14.test.ts \
  --own shared/core/tests/lockstep/citadels/verification14.test.ts
# => VERIFY FAILED: vitest   (Tests 1 failed | 4 passed (5))
```

`vp test shared/core/tests/lockstep/citadels/` adds exactly 1 failing test to the
suite (D14-1); P1, P2, P3, P4 are green, and every prior verification file stays
green (verification11 5/5, verification12 7/7, verification13 14/14).

## Defect

### D14-1 — a refused threatened Scholar builds before it draws, losing a build

Counterexample *"D14-1 a refused threatened Scholar builds before it draws, losing
a build"*. Measured on a board where BOB holds the Scholar with an **empty** hand,
12 gold, and a School of Magic (or a Museum) in its city:

| path | window purposes | builds | end hand |
|---|---|---|---|
| plain (unthreatened) | `-,scholar-keep,turn,turn,warlord-destroy,turn,turn,draft-pick` | 1 | `[]` |
| refused threat | `-,turn,blackmailer-threat,blackmailer-resolve,turn,scholar-keep,warlord-destroy,turn,draft-pick` | **0** | `["manor"]` |

Root cause: `resolveTurn`'s threatened branch (helpers.ts, the `threatened &&
!alreadyGathered` block) splices `belowThreat = [threat, buildWindow, ...marked]`,
where `marked` begins with the relocated ability windows. So the resolved stack
reads `[turn(gather), threat, buildWindow, resolve, scholar-keep, ...]`: the build
window stands ABOVE the Scholar's own keep. The rule (rules.json scholar) is "Draw
seven cards from the deck and choose one to add to your hand; ... Your building
limit this turn is two" — the draw is the character's turn, and the plain turn
draws before it builds. The D13 relocation moved the ability windows below the
threat but left the build window between the threat and them, so the ability the
build depends on no longer precedes it.

The clause is the same one the D13 seam ruling names: gather → threat → abilities
and builds. The relocation satisfied "abilities below the threat" but broke
"abilities before builds" for the one character whose build consumes its ability.

**Fix shape (helpers.ts, shared — report and stop).** The post-threat build window
must sit below the relocated ability windows and above the turn's own `END_TURN`:
`[turn, threat, ...relocatedWindows, POST_THREAT, buildWindow, END_TURN, ...]`
rather than `[turn, threat, buildWindow, POST_THREAT, ...relocatedWindows, ...]`.
A naive move of the build window below `marked` without re-adding the `POST_THREAT`
marker and without respecting the `END_TURN` position reddens verification11
(4/5) and P4 — the marker and the close position are both load-bearing. The
coordinator owns helpers.ts.

## The teeth audit

Method: `cp -r` the worktree to `/tmp/citadels-v14` (no git command ran in the
shared worktree), patch one source file in the copy with a Python replace that
**asserts the pattern is present** (a no-op patch cannot masquerade as a pass), run
the named guard with `-t`, record RED/GREEN, restore from the shared worktree by
copy.

| # | Guard | Neuter | Result |
|---|-------|--------|--------|
| T1 | P4 a refused threat fires the end-of-turn hook exactly once | revert `endTurnThen` to the pre-fix13c "one step past a bare resolve / threat" form | **RED** |
| T2 | P2 the arm step survives a codec round-trip mid-flight | drop the arm push (`carried = head`) | **RED** |
| T3 | D14-1 | move the build window below `marked` without the marker/close (a wrong reorder) | **RED** |
| T4 | P3 a Witch can never be threatened | `canThreat` rank guard → `true` | **RED** |
| T5 | P1 the refused Cardinal and Architect reach the plain end state | `relocateEffectBelowThreat` returns `steps` for every character | **GREEN — finding** |
| T6 | D14-1 | relocate's ability splice skipped (return `steps`) | **RED** (order assertion) |
| T7 | verification11 P1 (bribe arithmetic) | full 26-character x 2-board sweep, refused == plain | **RED at pre-fix13c, GREEN at head** |
| T8 | verification13 D13-1..11 | the 11 counterexamples | **GREEN at head** (the fix holds) |

**One probe stayed GREEN and it is a finding.** T5: replacing the whole of
`relocateEffectBelowThreat` with a no-op leaves **P1** (cardinal/architect) green,
because neither the Cardinal nor the Architect has an ability that the build
consumes — their refused and plain turns already agree. P1 is a positive probe for
"these two are artifacts", not a guard on the relocation. The relocation's real
teeth are pinned by D14-1 (T6) and by the prior passes' D13 eleven, not by P1. A
guard that folds a threatened **Scholar** (the D14-1 fixture) is what reddens on a
relocation neuter; P1 alone would not.

**T3/T6 confirm the defect is real, not a fixture:** moving the build window below
the relocated windows is the only reorder that changes D14-1's outcome, and the
change is a build the refused turn gains — i.e. the defect is a lost build, and the
fix is an ordering move in helpers.ts.

## Done-predicate clause-by-clause

| # | Clause | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | Full game reaches terminal for 3-6 seats | **PASS** | Unchanged this pass; my folds all reach a fresh draft from a real deal. |
| 2 | Every character implemented with a behavioral test | **FAIL** | D14-1: the threatened Scholar's build is lost because its ability no longer precedes its build. |
| 3 | Every district implemented with a test per unique effect | **PASS** | No district defect; the Smithy once-per-turn teeth hold (P4) and the Museum offer rides the turn close. |
| 4 | Exact scoring | **PASS** | Unchanged; prior scorers hold. |
| 5 | Hidden information never crosses `project`; two peers converge | **PASS** | Unchanged; the arm step and `threats` stay engine bookkeeping and the arm step round-trips the codec (P2). |
| 6 | No unverified file; `vp test` and `tsc` green | **FAIL** | `tsc` is green, but the suite goes red the moment `verification14.test.ts` lands (1 failed \| 704 passed). |

## What is verified vs unverified

**Verified this pass** (measured, not read):

- The `arm` step round-trips the codec: five mid-flight encodes/decodes over a
  threatened Scholar fold preserve both the stack and the pending exactly (P2).
- A refused threatened turn closes exactly once: the Smithy fires once for the
  Scholar, Magician, Seer, and Warlord (P4).
- The Witch exemption is unreachable: `canThreat` refuses the rank-1 Witch, so no
  reachable position has her threatened (P3).
- The two brief cases cardinal/school and architect/school are artifacts: 0/6000
  divergent boards each, with and without a Museum (P1 and the 12,000-board sweep).
- The refused threatened Scholar's defect is present at both the pre-fix13c head
  (`2b6727c`) and the head, so it is the D13 relocation's splice, not fix13c.

**Unverified / not checked:** the six preset casts; scoring under two claims;
terminal and winner resolution under every stack shape; determinism and
convergence at 2-7 seats; and — still open from passes 10-13 — no data-driven test
compares the 27 character `summary` strings to rules.json.

## What a human should still scrutinize

1. **The fix shape for D14-1.** The post-threat build window must move below the
   relocated ability windows but above the turn's `END_TURN`, and it must keep the
   `POST_THREAT` marker directly beneath it so the build takes no second gather. A
   partial move reddens verification11 (4/5) and P4, so the fix is a single
   helpers.ts ordering change that respects both the marker and the close.
2. **The probe-policy artifact.** The coordinator's four-case probe built a fixed
   hand index without re-reading the hand after a draw, which is why cardinal/school
   and architect/school appeared to diverge. A probe that re-reads the hand (or an
   adaptive policy) reports only the real Scholar case. This is worth encoding so
   the next sweep does not chase the two artifacts again.
3. **The character summaries.** Still no rules.json comparison (passes 10-13 flagged
   the same gap).

## Appendix: exact verify output

```
$ scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification14.test.ts \
    --own shared/core/tests/lockstep/citadels/verification14.test.ts
== vitest (the gate) ==
 ❯ shared/core/tests/lockstep/citadels/verification14.test.ts (5 tests | 1 failed)
   × D14-1 a refused threatened Scholar builds before it draws, losing a build
 Test Files  1 failed (1)
      Tests  1 failed | 4 passed (5)
VERIFY FAILED: vitest
```

```
$ vp test shared/core/tests/lockstep/citadels/
 Test Files  1 failed | 86 passed (87)
      Tests  1 failed | 704 passed (705)
```

The 1 red: D14-1. The 4 green: P1, P2, P3, P4.

## Deviation reported (standing order 4)

None. I wrote only the two files named in my brief. Every source edit for the
teeth audit was made in `/tmp/citadels-v14` (a `cp -r` copy, restored from the
shared worktree after each probe); no `checkout`/`switch`/`stash`/`reset`/
`rebase`/`branch` ran in the shared worktree, and `git status --porcelain` shows
only my new test file plus the pre-existing inbox pointers. The fix for D14-1
touches `helpers.ts`, a shared file, so it is routed to the coordinator rather
than attempted here.

## Report

- **Status:** FAIL — 1 real defect (D14-1), 2 brief cases adjudicated as probe
  artifacts, 3 seam clauses verified clean (arm codec round-trip, single end-of-turn
  close, Witch unreachability).
- **Files written:** `shared/core/tests/lockstep/citadels/verification14.test.ts`
  (new), `orchestrate/citadels/verification-14.md` (this report).
- **Verify command:** `scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification14.test.ts --own shared/core/tests/lockstep/citadels/verification14.test.ts`
- **Raw result:** `Tests 1 failed | 4 passed (5)`; `VERIFY FAILED: vitest`.
- **Commit SHA:** fbce10b (this report and the test file)
- **Shared-file change needed:** `helpers.ts` — the threatened branch of
  `resolveTurn` must place the post-threat build window below the relocated ability
  windows (and above the turn's `END_TURN`, keeping `POST_THREAT` beneath the build
  window). Coordinator-owned.
