# Citadels game definition: closure audit (verify-21, coordinator-run)

Verifier: the coordinator (this thread). The delegated verify-21 closure pass died to
a provider error with no salvage (the 6th infra death this session); per the
'bound your own infra retries' rule it was not respawned a 7th time, because the
closure audit is read-only and the coordinator holds every tool it needs.

Source head under review: `feat/citadels-game-definitions`, worktree
`/home/kevin/.t3/worktrees/boardgame/t3-a32da114`, head `3efc7cb`. Suite 94 files /
760 tests green; `tsc -p tsconfig.citadels.json` clean.

## Verdict: CLOSED

No predicate-blocking defect remains. Every clause of the definition of done
(`docs/design/citadels-full-game.md`) has a named, passing artifact. The standing gaps
are non-blocking follow-ups, enumerated below.

## The done predicate, clause by clause

| # | Clause | Verdict | Evidence artifact |
|---|--------|---------|-------------------|
| 1 | Full game reaches terminal (one winner) for 3-6 seats, 3+ casts | **PASS** | `integration.test.ts` L101 (3/4/5/6 seats), L111 (one winner or documented tie), L120 (three distinct casts: base, rank-9-artist, catalog-ranks) |
| 2 | All 27 characters implemented with a named test | **PASS** | 27 `characters/*.test.ts`; every `characters/*.ts` has a matching test (0 unmatched) |
| 3 | Every district: cost/type/effect, test per unique effect | **PASS** | 31 `districts/*.test.ts`; every district source has a test (0 unmatched); `catalog.test.ts` covers the 84-card catalog |
| 4 | Exact scoring | **PASS** | `integration.test.ts` L265 (all seats score, top wins under the tie-breaks), L284 (rank then district points then gold); `fix-scoring.test.ts` (beautify, Secret Vault, Haunted Quarter) |
| 5 | Hidden info redacted; two peers converge | **PASS** | `codec-redaction.test.ts` L109 (snapshot round-trip reaches the same terminal), L144/L190 (project redacts deck + other hands), L236 (stateDigest commits to hidden state) |
| 6 | Module suite green; tsc clean; no unverified file | **PASS** | `vp test shared/core/tests/lockstep/citadels/` 94 files / 760 tests; `tsc -p tsconfig.citadels.json` rc 0 |

## The resume seam (D13-D20), the program's long tail

The last eight defect families were all one seam. It is now bounded and guarded:

- **Identity** (D16/D17): `state.resume`, a codec-round-tripped owned record. Guard:
  `verification17` P5/P6/P7.
- **Arming** (D18): `armCharacterTurn`, one helper both `applyCall` and the resume call.
  Guard: `verification18` P4, `verification19` P4.
- **Resolution** (D19): a resumed turn has no gather, so its ability windows are not
  relocated below the turn window. Guard: `verification19` D19-1/2, `verification20` P1.
- **Reachability** (D20): the Cardinal's shortfall clause is reachable on the resume.
  Guard: `verification20` D20-1, `verification20sweep.test.ts` (24 bewitchable
  characters x rich/poor boards).

The seam is bounded, not open-ended: exactly **five** resume-conditioned branches exist
in the module, all in `resolveTurn` (heldWitch, markGathered, the Cardinal shortfall,
threatened, alreadyGathered), and the D20 fix leaves the other four correct. The
escalation trigger recorded at D17 (a 7th family -> full design pass) fired at D20 and
was overridden on that evidence: D20-1 was one stale guard, not a missing mechanism.

## Non-blocking follow-ups (do not block the predicate)

1. **Character summaries vs rules.json.** No data-driven test compares the 27
   `summary` strings to `rules.json`; `fix5-data` reconciled 14 by hand. A drift guard
   is the fix (passes 10-20 flagged it; none fixed it).
2. **Unverified surfaces.** The six preset casts; scoring under two claims;
   terminal/winner under every stack shape; determinism and convergence at 2-7 seats.
3. **Duplicate Theater test file.** `districts/theatre.test.ts` (British spelling, 6
   tests) tests the same `theater.ts` source as `theater.test.ts` (14 tests); the former
   looks subsumed.
4. **Five early batch-verified heads.** `c62f4a4`, `01ed8ad`, `659236c`, `945863d`,
   `adde28f` have no per-SHA ledger row (verified in an early wave; deeply superseded).
5. **`HANDOFF.md` is stale.** Its outage is over and its defects are long fixed;
   `units.tsv` is the live resume point.

## What a human should still scrutinize

- The follow-up 1 drift guard (summaries vs rules.json) is the highest-value remaining
  test, because a summary is player-facing text no behavioral test covers.
- The D15/D16 order contracts (plain: gather -> abilities -> build; threatened: gather
  -> threat -> abilities -> build) are pinned by the verification files; a reader
  changing `resolveTurn` must run them.

## Report

- **Status:** CLOSED. No predicate-blocking defect.
- **Evidence:** the six-clause table above; suite 94 files / 760 tests; tsc clean.
- **Files written:** `orchestrate/citadels/verification-21.md` (this report).
- **Commit SHA:** recorded at the drain.
