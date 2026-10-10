# Orchestrate status

Generated: 2026-10-10T17:02:19.196Z

## Units

States: done=3, pending=1

| ID | Track | State | Branch | PR | SHA | Brief |
| --- | --- | --- | --- | --- | --- | --- |
| core-scaffold | core | done |  |  | 6925dce | orchestrate/citadels/briefs/core-scaffold.md |
| data-catalog-fix | rules | done |  |  | 2e757f8 | fix the invented district catalog and mis-ranked characters 1-3 against docs/design/citadels-catalog.md |
| engine-seams | core | done |  |  | c62f4a4 | orchestrate/citadels/briefs/engine-seams.md |
| engine-hooks | core | pending |  |  |  | orchestrate/citadels/briefs/engine-hooks.md |

## Verification ledger

Verdicts: unit-test-verified=2

| PR | SHA | Verdict | Evidence | Verifier | Timestamp |
| --- | --- | --- | --- | --- | --- |
| 1 | 6925dce522b716b7684780900e481aa8530865df | unit-test-verified | scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/scaffold.test.ts -> 16 passed, tsc OK; commit 6925dce |  | 2026-10-10T16:44:09.678Z |
| 1 | 2e757f82693da2d7a23144c565c4ac9c59440776 | unit-test-verified | scripts/citadels-verify.sh scaffold+catalog+seams -> 32 passed, tsc OK |  | 2026-10-10T17:02:18.971Z |

## Frontier

Generation: 0
Lowest unmerged: none

(none)

## Gates

(none)

<!-- orch-summary {"unitStates":{"done":3,"pending":1},"ledgerVerdicts":{"unit-test-verified":2},"frontierGeneration":0,"openGateIds":[]} -->
