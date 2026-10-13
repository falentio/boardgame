# Citadels program overview

Spec: docs/design/citadels-full-game.md
Target module: shared/core/lockstep/games/citadels/
Tests: shared/core/tests/lockstep/citadels/
Reference implementation to mirror: shared/core/lockstep/games/g54/ (read it first)

## Done predicate

All units merged on feat/citadels-game-definitions, each with a ledger row of
`unit-test-verified` or better, and a full game reaching terminal for 3-6 seats.

## Tracks

- core: scaffold (types, state, actions, codec, window machine, genesis, project).
- rules: setup+draft, turn phase, scoring+end game.
- characters: 9 rank-group units covering all 27 characters.
- districts: catalog, unique-effect groups.
- verify: integration, redaction, convergence, independent verifier pass.

## Resumed program (thread 2fe386ea, 2026-10-11)

Spawned units (reconcile at drain; zombie of b320ea9b killed, salvage handed to fix2-engine-tail):
- fix2-engine-tail: taskId node:delegated-task:command%3Amcp%3A69bf45e4-c67d-48cd-b9b2-235d7c50500e%3Adelegate-task%3Acitadels-fix2-engine-tail-2026-10-11 — owns helpers.ts, characters/alchemist.ts, districts/armory.ts (V2-7 refund, V2-8 armory onDestroy, land V2-4 salvage)
- fix2-verification-tests: taskId node:delegated-task:command%3Amcp%3A69bf45e4-c67d-48cd-b9b2-235d7c50500e%3Adelegate-task%3Acitadels-fix2-verification-tests-2026-10-11 — owns verification2.test.ts, verification-report.test.ts (3 flawed counterexamples + stale D10)

Queued next: fix2-regression (engine-coverage.test.ts folded-game guard) after the wave lands; then verify-3, an independent adversarial pass over the new head.
## Open follow-ups (parked, from passes 10-16)

These do not block the D15 frontier; they are recorded so they are not lost.

- **Character summaries vs rules.json.** Passes 10-15 each flagged the same gap: no
  data-driven test compares the 27 character `summary` strings to `rules.json`. fix5-data
  reconciled 14 by hand; nothing guards against a future drift.
- **Close-once guard gap (verify-15 T5b).** `verification15.test.ts` has no probe that
  reddens on a symmetric double close of the turn; `verification11` P3 and
  `engine-coverage.test.ts` own it. verify-16 should consider adding one.
- **Pre-fix `endTurnThen` form (verify-15 T10).** The pre-fix13c form is green on
  verification11 P3 and verification14 P4 at the current head. Not a defect; recorded so
  no future pass mistakes it for a live regression.
- **Unverified surfaces.** The six preset casts; scoring under two claims; terminal and
  winner resolution under every stack shape; determinism and convergence at 2-7 seats.
  None has been re-derived since the D10-D15 seams landed.
- **HANDOFF.md is stale.** The executor-down outage it describes is over (delegate_task
  works again); the three defects and three flawed counterexamples it names are long
  fixed. Left in place as history; the live resume point is `units.tsv`.

- **No CI in this repo.** There is no `.github/workflows`, so PR 20 reports "no checks reported" and a CLEAN/MERGEABLE state with no automated gate. The verification gate is the local citadels suite (`scripts/citadels-verify.sh` + `vp test`), which is why every ledger verdict is local. Do not wait on a CI check; it will never appear.
