# Orchestrate status

Generated: 2026-10-10T17:53:53.992Z

## Units

States: done=10

| ID | Track | State | Branch | PR | SHA | Brief |
| --- | --- | --- | --- | --- | --- | --- |
| core-scaffold | core | done |  |  | 6925dce | orchestrate/citadels/briefs/core-scaffold.md |
| data-catalog-fix | rules | done |  |  | 2e757f8 | fix the invented district catalog and mis-ranked characters 1-3 against docs/design/citadels-catalog.md |
| engine-seams | core | done |  |  | c62f4a4 | orchestrate/citadels/briefs/engine-seams.md |
| engine-hooks | core | done |  |  | 13155e9 | orchestrate/citadels/briefs/engine-hooks.md |
| engine-district-resolvers | core | done |  |  | d666799 | orchestrate/citadels/briefs/engine-district-resolvers.md |
| chars-rank1 | characters | done |  |  | 2a72864 | orchestrate/citadels/briefs/unit-chars-rank1.md |
| chars-rank2 | characters | done |  |  | cccd128 | orchestrate/citadels/briefs/unit-chars-rank2.md |
| chars-rank3 | characters | done |  |  | 1daa707 | orchestrate/citadels/briefs/unit-chars-rank3.md |
| chars-rank4 | characters | done |  |  | 6cf31d1 | orchestrate/citadels/briefs/unit-chars-rank4.md |
| chars-rank5 | characters | done |  |  | 4ffda58 | orchestrate/citadels/briefs/unit-chars-rank5.md |

## Verification ledger

Verdicts: unit-test-verified=9

| PR | SHA | Verdict | Evidence | Verifier | Timestamp |
| --- | --- | --- | --- | --- | --- |
| 1 | 6925dce522b716b7684780900e481aa8530865df | unit-test-verified | scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/scaffold.test.ts -> 16 passed, tsc OK; commit 6925dce |  | 2026-10-10T16:44:09.678Z |
| 1 | 2e757f82693da2d7a23144c565c4ac9c59440776 | unit-test-verified | scripts/citadels-verify.sh scaffold+catalog+seams -> 32 passed, tsc OK |  | 2026-10-10T17:02:18.971Z |
| 1 | 13155e9 | unit-test-verified | scripts/citadels-verify.sh hooks+scaffold -> 30 passed, tsc OK |  | 2026-10-10T17:26:22.655Z |
| 1 | d666799 | unit-test-verified | citadels suite 154 passed at d666799; per-unit verify green |  | 2026-10-10T17:53:53.947Z |
| 1 | 2a72864 | unit-test-verified | citadels suite 154 passed at 2a72864; per-unit verify green |  | 2026-10-10T17:53:53.954Z |
| 1 | cccd128 | unit-test-verified | citadels suite 154 passed at cccd128; per-unit verify green |  | 2026-10-10T17:53:53.962Z |
| 1 | 1daa707 | unit-test-verified | citadels suite 154 passed at 1daa707; per-unit verify green |  | 2026-10-10T17:53:53.969Z |
| 1 | 6cf31d1 | unit-test-verified | citadels suite 154 passed at 6cf31d1; per-unit verify green |  | 2026-10-10T17:53:53.977Z |
| 1 | 4ffda58 | unit-test-verified | citadels suite 154 passed at 4ffda58; per-unit verify green |  | 2026-10-10T17:53:53.983Z |

## Frontier

Generation: 0
Lowest unmerged: none

(none)

## Gates

(none)

<!-- orch-summary {"unitStates":{"done":10},"ledgerVerdicts":{"unit-test-verified":9},"frontierGeneration":0,"openGateIds":[]} -->
