# Orchestrate status

Generated: 2026-10-13T08:39:46.922Z

## Units

States: abandoned=10, done=73, failed=4, partial=3

| ID | Track | State | Branch | PR | SHA | Brief |
| --- | --- | --- | --- | --- | --- | --- |
| core-scaffold | core | done |  | 20 | 6925dce | orchestrate/citadels/briefs/core-scaffold.md |
| data-catalog-fix | rules | done |  |  | 2e757f8 | fix the invented district catalog and mis-ranked characters 1-3 against docs/design/citadels-catalog.md |
| engine-seams | core | done |  |  | c62f4a4 | orchestrate/citadels/briefs/engine-seams.md |
| engine-hooks | core | done |  |  | 13155e9 | orchestrate/citadels/briefs/engine-hooks.md |
| engine-district-resolvers | core | done |  |  | d666799 | orchestrate/citadels/briefs/engine-district-resolvers.md |
| chars-rank1 | characters | done |  |  | 2a72864 | orchestrate/citadels/briefs/unit-chars-rank1.md |
| chars-rank2 | characters | done |  |  | cccd128 | orchestrate/citadels/briefs/unit-chars-rank2.md |
| chars-rank3 | characters | done |  |  | 1daa707 | orchestrate/citadels/briefs/unit-chars-rank3.md |
| chars-rank4 | characters | done |  |  | 6cf31d1 | orchestrate/citadels/briefs/unit-chars-rank4.md |
| chars-rank5 | characters | done |  |  | 4ffda58 | orchestrate/citadels/briefs/unit-chars-rank5.md |
| district-triggers-per-file | districts | done |  |  | cd9cfbf | orchestrate/citadels/briefs/district-triggers-per-file.md |
| chars-rank6 | characters | done |  |  | 945863d | orchestrate/citadels/briefs/unit-chars-rank6.md |
| chars-rank7 | characters | done |  |  | d56296e | orchestrate/citadels/briefs/unit-chars-rank7.md |
| chars-rank8 | characters | done |  |  | d8e84df | orchestrate/citadels/briefs/unit-chars-rank8.md |
| chars-rank9 | characters | done |  |  | 8c3db12 | orchestrate/citadels/briefs/unit-chars-rank9.md |
| dist-income | districts | partial |  |  | adde28f | orchestrate/citadels/briefs/unit-dist-income.md |
| dist-build | districts | partial |  |  | ae23e55 | orchestrate/citadels/briefs/unit-dist-build.md |
| dist-guard | districts | done |  |  | 01ed8ad | orchestrate/citadels/briefs/unit-dist-guard.md |
| dist-scoring | districts | partial |  |  | 2acbdaf | orchestrate/citadels/briefs/unit-dist-scoring.md |
| dist-actions | districts | done |  |  | 659236c | orchestrate/citadels/briefs/unit-dist-actions.md |
| dist-build-remainder | districts | abandoned |  |  |  | 1/8 done (factory); 7 blocked on the build seam |
| dist-scoring-remainder | districts | abandoned |  |  |  | 5/10 done; 5 blocked on the scoring seam |
| district-seams | core | done |  |  | e1827a3 | orchestrate/citadels/briefs/district-seams.md |
| dist-income-remainder | districts | done |  |  | ce923f9 | 3/6 done (gold-mine, park, poor-house); library/observatory/school-of-magic blocked on the draw hook |
| integration-full-game | verify | done |  |  | 42ec6a1 | orchestrate/citadels/briefs/integration-full-game.md |
| dist-build-a | districts | done |  |  | 11f4650 | orchestrate/citadels/briefs/unit-dist-build-a.md |
| dist-build-b | districts | done |  |  | 37c4cf0 | orchestrate/citadels/briefs/unit-dist-build-b.md |
| dist-score-a | districts | done |  |  | 5c37fc8 | orchestrate/citadels/briefs/unit-dist-score-a.md |
| dist-score-b | districts | done |  |  | 088f423 | orchestrate/citadels/briefs/unit-dist-score-b.md |
| dist-theater | districts | done |  |  | 2dfd6a5 | theater needs a round-start district hook (shared-file change) |
| codec-redaction | verify | done |  |  | 76474ee | orchestrate/citadels/briefs/codec-redaction.md |
| independent-verification | verify | done |  |  | 7547f8d | orchestrate/citadels/briefs/independent-verification.md |
| fix-engine | verify | done |  |  | 91a57df | D1 applyCall wires character effects; D7 duplicate rule; D8 completion order; D10 museum placement; D13 step totality; D14 discard leak |
| fix-scoring | verify | done |  |  | fdf9d20 | D2 beautify in cost sum; D3 secret vault in hand; D12 ivory tower vs declared unique |
| fix-warlord | verify | done |  |  | 04db150 | D4 great wall toll; D5 keep protection; D6 bishop shield; D9 warlord income declared type |
| fix-income | verify | done |  |  | e887390 | D9 income counters honour declared type (8 characters) |
| fix-den | verify | done |  |  | 7b1a1c9 | D11 thieves den mixed payment |
| independent-verification-2 | verify | done |  |  | 12f3aaf | orchestrate/citadels/briefs/independent-verification-2.md |
| fix2-drain | verify | abandoned |  |  |  | V2-1 blocking: drain must use windowOwed not owedFor; V2-2 blackmailer first-pass; V2-3 double end-turn |
| fix2-districts | verify | abandoned |  |  |  | V2-8 armory onDestroy; V2-9 museum decline; V2-4 thieves-den gold share |
| fix2-income | verify | abandoned |  |  |  | V2-5 trader+emperor declared type; V2-6 diplomat great wall toll; V2-7 alchemist refund |
| fix2-engine-tests | verify | abandoned |  |  |  | folded-game per-character tests so no window can silently die again |
| fix2-engine | verify | abandoned |  |  |  | orchestrate/citadels/briefs/fix2-engine.md |
| fix2-characters | verify | done |  |  |  | orchestrate/citadels/briefs/fix2-characters.md |
| fix2-regression | verify | done |  |  |  | orchestrate/citadels/briefs/fix2-regression.md |
| fix2-engine-tail | verify | done |  |  |  | finish V2-7 alchemist refund (verify+complete the zombie salvage in helpers.ts/alchemist.ts) and V2-8 armory onDestroy |
| fix2-verification-tests | verify | done |  |  |  | correct the 3 flawed counterexamples (folded-game policy, trader/emperor turn-phase setup, stale D10 keep) keeping their teeth |
| fix2-den-test | verify | done |  |  |  | correct the stale district-seams.test.ts card-payment assertion to the V2-4 rule (cards + gold share) |
| verify-3 | verify | done |  |  |  | third independent adversarial pass at e0ab5a4: predicate audit, teeth audit of engine-coverage guards via /tmp-copy revert probes, verification3.test.ts counterexamples |
| fix3-engine | verify | done |  |  |  | D3-1 navigator four-card branch reachable; D3-7 haunted-quarter type choice; owns helpers.ts + navigator.ts + haunted-quarter.ts |
| fix3-scoring | verify | done |  |  |  | D3-2 capitol declared type; D3-3 basilica beautify; D3-4 wishing-well + ivory-tower unique flag; owns the four district files |
| fix3-rules | verify | done |  |  |  | D3-5 draft over-removal; D3-6 winnerOf tie-break; owns setup.ts + scoring.ts (serialized shared) |
| fix3-guards | verify | done |  |  |  | harden engine-coverage guard rows the teeth audit found weak: Keep/GreatWall call-count rows, Trader declared-type row; owns engine-coverage.test.ts |
| fix3-tie-tests | verify | done |  |  |  | correct the 3 stale integration.test.ts tie-break assertions to the catalog revealed-rank rule + reconcile the Navigator summary string |
| verify-4 | verify | done |  |  |  | fourth independent adversarial pass at 69aae2e: predicate audit, teeth audit of the strengthened guards, verification4.test.ts counterexamples |
| fix4-engine | verify | done |  |  |  | D4-1/D4-1b witch held-turn build + triple gather; D4-2 tax-collector per-seat exemption; D4-3 destroyed museum cards; D4-4 blackmailer threat order; D4-7 card-paid den confiscate; owns helpers.ts + witch + blackmailer + warlord + museum + armory + thieves-den + magistrate |
| fix4-clauses | verify | done |  |  |  | D4-5 bishop shield read by marshal/diplomat; D4-6 ivory tower vs undeclared haunted quarter; owns marshal.ts + diplomat.ts + ivory-tower.ts |
| fix4-ivory-tests | verify | done |  |  |  | correct the 2 stale ivory-tower fixtures (fix-scoring D12, districts/ivory-tower.test.ts) to the catalog rule: undeclared HQ blocks the tower, declared non-unique HQ does not |
| fix4-guards | verify | done |  |  |  | strengthen the Navigator/Spy/Thief engine-coverage rows from wiring assertions to behavioral teeth |
| fix4-test-corrections | verify | done |  |  |  | correct the 10 stale fixtures the fix4 source fixes invalidated: hooks x2 + blackmailer.test.ts x6 (threat after gather), thieves-den.test.ts card-paid den, verification4.test.ts D4-1 re-aim |
| verify-5 | verify | done |  |  |  | fifth independent adversarial pass at a59355b: predicate audit, teeth audit incl the newly strengthened rows and the re-aimed D4-1, verification5.test.ts counterexamples |
| fix5-engine | verify | done |  |  |  | D5-1..4 witch resume runs the bewitched character ability + build limit; D5-5 threat after gather before build; D5-6 cardinal shortfall reachable; D5-7 school-of-magic declaration before income; owns helpers.ts + witch + cardinal + school-of-magic + king/emperor/trader |
| fix5-data | verify | done |  |  |  | D5-8 four stale character summaries (bishop, tax-collector, blackmailer, magician) reconciled to the implemented effects; owns characters.ts |
| fix5-last-fixture | verify | done |  |  |  | correct the coordinator-ruled stale D4-1b fixture in verification4.test.ts (the resume now pays the bewitched ability, so the fold totals +3) |
| verify-6 | verify | done |  |  |  | sixth independent adversarial pass at 32b9c1d (fully green head): predicate audit, teeth audit, verification6.test.ts counterexamples |
| fix6-turn-model | verify | done |  |  |  | D6-1 cardinal shortfall gift card conservation with duplicates; D6-2 turn model gather-then-build per spec citadels-full-game.md:107; owns helpers.ts + cardinal.ts |
| fix6-fixtures-districts | verify | done |  |  |  | re-frame the 22 red district fixtures (necropolis x4, framework x4, factory x4, park x3, poor-house x2, smithy, secret-vault, quarry, monument, laboratory) to the gather-then-build turn model |
| fix6-fixtures-guards | verify | done |  |  |  | re-frame engine-coverage x3 (alchemist, factory, poor-house), verification2 alchemist V2-7, fix-den-test split build; strengthen the T1-T4 guard gaps (school-of-magic turn-open, cardinal shortfall, blackmailer deferral, witch resume RESOLVE) |
| verify-7 | verify | done |  |  |  | seventh independent adversarial pass at fbf19a6 (post turn-model): predicate audit, teeth audit incl T1-T4 strengthened rows, verification7.test.ts counterexamples |
| fix7-acting-character | verify | done |  |  |  | D7-1..D7-6: seven per-character clauses read claimOf (seat first claim) instead of the acting character; sweep every claimOf reader; owns helpers.ts + blackmailer.ts + school-of-magic.ts |
| verify-8 | verify | done |  |  |  | eighth independent adversarial pass at 0ab24e2 (post acting-character fix): predicate audit, teeth audit, verification8.test.ts counterexamples |
| fix8-two-character | verify | done |  |  |  | D8-1 witch resume declares the School of Magic; D8-2 theatre lets a two-claim owner choose which character to give (+ fix the pinned fixture); add two-character-seat guard rows; owns helpers.ts + witch.ts + theatre.ts + theatre.test.ts + engine-coverage.test.ts |
| verify-9 | verify | done |  |  |  | ninth independent adversarial pass at 773ad39 (post two-character wave): predicate audit, teeth audit incl the new two-character rows, verification9.test.ts counterexamples |
| fix9-museum-offer | verify | done |  |  |  | D9-1 museum offer must not overwrite the alchemist settle pending (tagged routing); D9-2 the navigator branch reaches the museum offer; owns helpers.ts + engine-coverage.test.ts |
| verify-10 | verify | done |  |  |  | tenth independent adversarial pass at c867b2a (post museum-offer routing): predicate audit, teeth audit, verification10.test.ts counterexamples |
| fix10-threat-seam | verify | abandoned |  |  |  | D10-1/D10-3 threat resolves after the threatened seat gather/gain (splice above the resolve step); D10-2 the reveal must not wipe a pending a later step needs; owns helpers.ts + engine-coverage.test.ts |
| fix10-threat-seam-r2 | verify | failed |  |  |  | retry of fix10-threat-seam (predecessor died to a provider error mid-analysis, no commits): D10-1/D10-3 threat resolves after gather/gain, D10-2 reveal preserves the pending |
| fix10-threat-seam-r3 | verify | abandoned |  |  |  | fix10 retry #3 on pi/9Router-step-5 (user model switch): D10-1/D10-3 threat after gather/gain, D10-2 reveal preserves the pending, refuse-path guard; owns helpers.ts + engine-coverage.test.ts |
| fix10-threat-seam-r4 | verify | abandoned |  |  |  | fix10 retry #4 on pi/9Router-step-5 (user model switch; r3 interrupted by an aborted wait, probe file cleaned): D10-1/D10-3 threat after gather/gain, D10-2 reveal preserves the pending, refuse-path guard |
| fix10-threat-seam-r5 | verify | done |  |  |  | fix10 retry #5 on pi/9Router-step-5 (r4 interrupted by an aborted wait after isolating the root cause, no commits): implement the coordinator ruling immediately; owns helpers.ts + engine-coverage.test.ts |
| verify-11 | verify | done |  |  |  | eleventh independent adversarial pass at cd506d5 (post threat-seam fix): predicate audit, teeth audit incl the refuse-path rows, verification11.test.ts counterexamples |
| fix11-two-markers | verify | done |  |  |  | D11-1 record the flowered-lace identity at placement so a refused decoy is never looted; D11-2 the museum offer must not precede a threatened Navigator threat; owns blackmailer.ts + helpers.ts + engine-coverage.test.ts (state.ts only if reported and granted) |
| verify-12 | verify | done |  |  |  | twelfth independent adversarial pass at 262836a (post two-marker fix): predicate audit, teeth audit incl the both-marker rows, verification12.test.ts counterexamples |
| fix12-stack-reshapers | verify | failed |  |  |  | D12-1 Architect, D12-2 Alchemist, D12-3 Scholar build before the threat (stack reshaping moves the threat out of the rest[0] slot); owns helpers.ts + architect.ts + alchemist.ts + scholar.ts + engine-coverage.test.ts |
| fix12b-trader | verify | done |  |  |  | sweep the Trader case (D12-4): verify whether a threatened Trader still builds before its threat at 0fd4226; if real, fix in the same shape-independent seam |
| verify-13 | verify | done |  |  |  | thirteenth independent adversarial pass at f6cf5c9 (post the trader threat fix): predicate audit, full threatenable sweep, teeth audit, verification13.test.ts counterexamples |
| fix13-threat-above-abilities | verify | done |  |  |  | D13-1..D13-11: the threat window must sit above every window the character effect opens (gather -> threat -> abilities/build); owns helpers.ts + engine-coverage.test.ts |
| fix13b-p1-fixture | verify | failed |  |  |  | correct verification11.test.ts P1 emperor/museum bribe arithmetic to the post-relocation order (bribe on post-gather pre-ability gold); owns verification11.test.ts only |
| fix13b-p1-r2 | verify | failed |  |  |  | P1 correction retry: derive the bribe arithmetic from the purse measured at the threat frame, not from the plain end; owns verification11.test.ts only |
| fix13c-refuse-regression | verify | done |  |  | aa6f553 | D13 seam regression: a refused threatened seat loses its relocated ability windows (scholar draw); owns helpers.ts + windows.ts + verification11.test.ts |

## Verification ledger

Verdicts: unit-test-verified=49, verifier-failed=14

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
| 1 | cd9cfbf | unit-test-verified | citadels suite 202 passed at cd9cfbf |  | 2026-10-10T18:20:48.769Z |
| 1 | d8e84df | unit-test-verified | citadels suite 202 passed at d8e84df |  | 2026-10-10T18:20:48.775Z |
| 1 | 8c3db12 | unit-test-verified | citadels suite 202 passed at 8c3db12 |  | 2026-10-10T18:20:48.781Z |
| 1 | d56296e | unit-test-verified | all 27 characters implemented; citadels suite 330 passed |  | 2026-10-10T19:08:40.719Z |
| 1 | ae23e55 | unit-test-verified | factory green; 7 members proven blocked on a missing build seam |  | 2026-10-10T19:08:40.723Z |
| 1 | 2acbdaf | unit-test-verified | 5 scoring districts green; 5 proven blocked on a missing state-aware scoring seam |  | 2026-10-10T19:08:40.726Z |
| 1 | e1827a3 | unit-test-verified | citadels suite 348 passed; BuildTerms/BuildQuery/onDraw/state-aware scoring added |  | 2026-10-10T19:49:10.704Z |
| 1 | ce923f9 | unit-test-verified | library+observatory+school-of-magic green; suite 371 passed |  | 2026-10-10T20:11:58.104Z |
| 1 | 5c37fc8 | unit-test-verified | citadels suite 466 passed at 5c37fc8 |  | 2026-10-10T23:57:47.231Z |
| 1 | 226a0b6 | unit-test-verified | citadels suite 466 passed at 226a0b6 |  | 2026-10-10T23:57:47.238Z |
| 1 | 11f4650 | unit-test-verified | quarry+framework+necropolis+stables all implemented; suite 466 passed; provider error hit after the last commit |  | 2026-10-10T23:58:20.941Z |
| 1 | 088f423 | unit-test-verified | citadels suite 466 passed; haunted-quarter + museum |  | 2026-10-10T23:57:51.477Z |
| 1 | 37c4cf0 | unit-test-verified | monument+secret-vault+thieves-den green; suite 466 passed |  | 2026-10-11T00:05:37.061Z |
| 1 | 42ec6a1 | unit-test-verified | integration.test.ts 13 tests; full games terminal for 3-6 seats across 3 casts; redaction by keys; two peers converge byte-identical; suite 477 passed |  | 2026-10-11T00:28:50.686Z |
| 1 | 76474ee | unit-test-verified | codec-redaction 5 tests; mid-game round-trip, snapshot, redaction walk, digest sensitivity; no leaks; suite 496 passed |  | 2026-10-11T00:51:38.824Z |
| 1 | 2dfd6a5 | unit-test-verified | theater 14 tests; onRoundStart hook; all 30 districts implemented; suite 496 passed, tsc clean |  | 2026-10-11T00:54:06.420Z |
| 1 | 7547f8d | verifier-failed | orchestrate/citadels/verification.md + verification-report.test.ts: 14 counterexamples, all fail; D1 blocking (no character ability is ever invoked) |  | 2026-10-11T01:17:06.078Z |
| 1 | fdf9d20 | unit-test-verified | fix unit green; all 14 verifier counterexamples pass at 7b1a1c9 |  | 2026-10-11T02:28:50.778Z |
| 1 | 04db150 | unit-test-verified | fix unit green; all 14 verifier counterexamples pass at 7b1a1c9 |  | 2026-10-11T02:28:50.785Z |
| 1 | e887390 | unit-test-verified | fix unit green; all 14 verifier counterexamples pass at 7b1a1c9 |  | 2026-10-11T02:28:50.792Z |
| 1 | 7b1a1c9 | unit-test-verified | fix unit green; all 14 verifier counterexamples pass at 7b1a1c9 |  | 2026-10-11T02:28:50.799Z |
| 1 | 91a57df | unit-test-verified | all 14 verifier counterexamples pass; suite 531 passed; my own probe confirms character abilities now run and the crown moves |  | 2026-10-11T03:16:19.176Z |
| 1 | 12f3aaf | verifier-failed | orchestrate/citadels/verification-2.md + verification2.test.ts: 15 counterexamples; V2-1 blocking (any-windows dropped by drain) |  | 2026-10-11T04:05:56.435Z |
| 1 | 9c28701 | verifier-failed | 3 real defects remain (V2-4 den gold, V2-7 alchemist, V2-8 armory) + 3 flawed counterexamples; see orchestrate/citadels/HANDOFF.md |  | 2026-10-11T06:04:03.500Z |
| 20 | dcce09b | unit-test-verified | coordinator re-ran verification2.test.ts 15/15 and verification-report.test.ts 14/14 at dcce09b; git show confirms only the two owned test files changed and assertions were added, not weakened | coordinator-2fe386ea | 2026-10-11T07:01:23.140Z |
| 20 | d649c7f | unit-test-verified | coordinator re-ran at d649c7f: verification2.test.ts 15/15 (V2-7 alchemist refund, V2-8 armory onDestroy, V2-4 den gold share all pass), verification-report.test.ts 14/14; commit touches only owned alchemist.ts+helpers.ts | coordinator-2fe386ea | 2026-10-11T07:18:29.816Z |
| 20 | 857f556 | unit-test-verified | coordinator re-ran at 857f556: district-seams.test.ts 18/18; full citadels suite 74 files 547/547 passed | coordinator-2fe386ea | 2026-10-11T07:32:05.017Z |
| 20 | e0ab5a4 | verifier-failed | independent pass 3 at e0ab5a4: verification3.test.ts 8 failed / 2 passed; defects D3-1 navigator branch unreachable, D3-2 capitol catalog type, D3-3 basilica beautify, D3-4 wishing-well/ivory-tower unique flag, D3-5 draft over-removal, D3-6 winnerOf tie-break, D3-7 haunted-quarter type choice; guard weaknesses on Keep/GreatWall call-count rows and Trader declared-type row | verify-3-subagent | 2026-10-11T09:45:41.346Z |
| 20 | cc7d376 | unit-test-verified | coordinator re-ran at cc7d376: verification3.test.ts 6/10 (D3-2/3/4 green; remaining 4 are sibling D3-1/5/6/7); commit touches only capitol/basilica/wishing-well/ivory-tower | coordinator-2fe386ea | 2026-10-11T09:56:23.406Z |
| 20 | ba3aa44 | unit-test-verified | coordinator re-ran at ba3aa44: verification3.test.ts 10/10 (D3-1..D3-7 all green); commit touches only helpers.ts, characters/navigator.ts, districts/haunted-quarter.ts | coordinator-2fe386ea | 2026-10-11T11:48:43.337Z |
| 20 | b470dfd | unit-test-verified | coordinator re-ran at b470dfd: verification3.test.ts 10/10; suite 613/616 with the only reds the 3 stale integration tie-break assertions the unit flagged; commit touches only setup.ts + scoring.ts | coordinator-2fe386ea | 2026-10-11T11:48:43.350Z |
| 20 | 7274d0f | unit-test-verified | coordinator re-ran at 7274d0f: full citadels suite 76 files / 616 tests all green; commit touches only integration.test.ts + the Navigator summary string in characters.ts | coordinator-2fe386ea | 2026-10-11T11:58:27.296Z |
| 20 | 69aae2e | verifier-failed | independent pass 4 at 69aae2e: verification4.test.ts 9 failed / 0 passed (all counterexamples); 39 prior counterexamples all green; defects D4-1..D4-7 plus theater guards Navigator/Spy/Thief | verify-4-subagent | 2026-10-11T12:42:25.571Z |
| 20 | 5428f3d | unit-test-verified | coordinator re-ran at 5428f3d: verification4.test.ts 3/9 with only the 6 sibling engine counterexamples red; commits touch only marshal.ts + diplomat.ts + ivory-tower.ts; suite reds beyond siblings are exactly the 2 stale ivory-tower fixtures the unit flagged | coordinator-2fe386ea | 2026-10-11T13:14:44.492Z |
| 20 | 5af9fab | unit-test-verified | coordinator re-ran at 5af9fab: fix-scoring.test.ts + districts/ivory-tower.test.ts 9/9 green; suite red set exactly the 6 fix4-engine counterexamples; commit touches only the two owned fixture files | coordinator-2fe386ea | 2026-10-11T13:21:06.753Z |
| 20 | 20474d2 | unit-test-verified | coordinator re-ran at 20474d2: engine-coverage.test.ts 59/59; commit touches only engine-coverage.test.ts; each strengthened row quotes the red message its behavior-revert produces | coordinator-2fe386ea | 2026-10-11T13:42:38.844Z |
| 20 | b6150fa | unit-test-verified | coordinator re-ran at b6150fa: verification4.test.ts 8/9 (only the ruled-flawed D4-1 red); its six source defects fixed across owned files only; 9 stale fixtures enumerated and handed to the correction unit | coordinator-2fe386ea | 2026-10-11T14:37:05.593Z |
| 20 | a59355b | verifier-failed | independent pass 5 at a59355b: verification5.test.ts 8 failed / 0 passed; all 48 prior counterexamples green; defects D5-1..D5-8; teeth audit confirms every sampled guard (13 probes) turns red — the guard suite has no theater left | verify-5-subagent | 2026-10-11T15:45:18.812Z |
| 20 | 1d74da0 | unit-test-verified | coordinator re-ran at 1d74da0: verification5.test.ts shows only the 7 sibling engine counterexamples red (D5-8 green); commit touches only summary strings in characters.ts | coordinator-2fe386ea | 2026-10-11T16:02:22.638Z |
| 20 | c6cfee0 | unit-test-verified | coordinator re-ran at c6cfee0: verification5.test.ts 8/8 green; full citadels suite 633/634 with the only red the coordinator-ruled stale D4-1b fixture; commits touch only the four owned source files | coordinator-2fe386ea | 2026-10-11T17:24:49.385Z |
| 20 | 32b9c1d | verifier-failed | independent pass 6 at 32b9c1d: verification6.test.ts 2 failed / 3 passed; defects D6-1 (cardinal duplicate-card drop) and D6-2 (gather XOR build vs spec citadels-full-game.md:107); four guard-strength gaps T1-T4 reported | verify-6-subagent | 2026-10-11T18:19:39.241Z |
| 20 | 64420ca | unit-test-verified | coordinator re-ran at 64420ca: verification6.test.ts 5/5 green; all 27 character test files green (185 tests); the 27 remaining reds are the surveyed fixture-causation set the unit enumerated | coordinator-2fe386ea | 2026-10-11T19:30:20.806Z |
| 20 | c66a3bd | unit-test-verified | coordinator re-ran: all 22 district fixture reds green; diff from 64420ca touches only the ten owned district test files | coordinator-2fe386ea | 2026-10-11T19:41:51.118Z |
| 20 | fbf19a6 | verifier-failed | independent pass 7 at fbf19a6: verification7.test.ts 7 failed / 0 passed; defects D7-1..D7-6 all the claimOf-vs-acting-character family; teeth audit clean (19 probes all red) | verify-7-subagent | 2026-10-11T20:26:34.189Z |
| 20 | 0ab24e2 | verifier-failed | independent pass 8 at 0ab24e2: verification8.test.ts 2 failed / 3 passed; the seventh-pass family holds (differential across all 27 characters); defects D8-1 (witch resume school-of-magic declaration) and D8-2 (theatre owner choice with two claims); guard gap: no two-character-seat guard | verify-8-subagent | 2026-10-11T21:16:31.038Z |
| 20 | 773ad39 | unit-test-verified | coordinator re-ran: full citadels suite 81 files / 651 tests all green; verification8.test.ts green; commit list touches only the five owned files | coordinator-2fe386ea | 2026-10-11T21:50:45.615Z |
| 20 | f0b5725 | verifier-failed | independent pass 9 at f0b5725: verification9.test.ts 2 failed / 3 passed; defects D9-1 (alchemist refund lost under the Museum offer) and D9-2 (navigator never offered the Museum placement); 18 teeth probes all red; guard gap confirmed for Museum-owning turns | verify-9-subagent | 2026-10-11T22:18:23.954Z |
| 20 | c867b2a | verifier-failed | independent pass 10 at c867b2a: verification10.test.ts 3 failed / 3 passed; defects D10-1..D10-3 all in the threat-refuse seam; teeth audit 15 probes all red | verify-10-subagent | 2026-10-11T23:05:28.988Z |
| 20 | cd506d5 | verifier-failed | independent pass 11 at cd506d5: verification11.test.ts 2 failed / 2 passed; defects D11-1 (second marker inherits the lace) and D11-2 (museum offer precedes the threat for a threatened Navigator); both one clause beside the fix10 seam | verify-11-subagent | 2026-10-12T17:10:16.435Z |
| 20 | 262836a | verifier-failed | independent pass 12 at 262836a: verification12.test.ts 3 failed / 3 passed; defects D12-1..D12-3 (Architect/Alchemist/Scholar build before the threat via stack reshaping) | verify-12-subagent | 2026-10-12T18:00:32.492Z |
| 20 | 0fd4226 | unit-test-verified | coordinator re-ran at 0fd4226: verification12.test.ts 6/6; full citadels suite 85 files / 679 tests green except the P3 vitest 5000ms timeout (harness, routed separately); commits touch only helpers.ts + engine-coverage.test.ts | coordinator-2fe386ea | 2026-10-13T01:59:23.068Z |
| 20 | f6cf5c9 | verifier-failed | independent pass 13 at f6cf5c9: verification13.test.ts 11 failed; the D13 family (ability windows drain before the threat); teeth audit 13/15 red with 2 findings | verify-13-subagent | 2026-10-13T04:52:49.188Z |
| 20 | 2b6727c | unit-test-verified | coordinator re-ran at 2b6727c: verification13.test.ts 14/14; full citadels suite 86 files / 699 tests green except the coordinator-ruled stale P1 fixture; commits touch helpers.ts + windows.ts + engine-coverage.test.ts | coordinator-2fe386ea | 2026-10-13T05:30:11.578Z |
| 20 | aa6f553 | unit-test-verified | coordinator re-ran at aa6f553: verification11 5/5 (P1 green, new P3 single-close guard green) and verification13 14/14 (D13-9 corrected); full citadels suite 86 files / 700 tests green; commits touch helpers.ts + state.ts + windows.ts + verification11.test.ts + verification13.test.ts; teeth proven (revert the arm carry -> P1+D13-7+D13-9 red; revert endTurnThen -> P3 red, refused Smithy pays 4 for 6 instead of 2 for 3) | coordinator-85bd98d5 | 2026-10-13T08:39:39.088Z |

## Frontier

Generation: 0
Lowest unmerged: none

(none)

## Gates

(none)

<!-- orch-summary {"unitStates":{"abandoned":10,"done":73,"failed":4,"partial":3},"ledgerVerdicts":{"unit-test-verified":49,"verifier-failed":14},"frontierGeneration":0,"openGateIds":[]} -->
