# Unit: fix15-plain-order (the D15 family: a plain turn gathers before its ability)

## GOAL
Make the plain turn order **gather -> abilities -> build**, so a refused threatened
seat ends exactly where its plain turn ends. Today the engine arms a plain turn as
`[RESOLVE, turn, END_TURN, ...]`: the effect runs at the resolve step ABOVE the
gather window and prepends its windows there, so a plain seat's ability drains on the
PRE-gather purse. A threatened seat drains the same windows BELOW the threat (D13),
i.e. POST-gather. Every purse-gated ability therefore diverges (D15-1..3).

## HEAD
`f4621ed` on `feat/citadels-game-definitions`, worktree
`/home/kevin/.t3/worktrees/boardgame/t3-a32da114`. The full citadels suite is green
at 88 files / 714 tests **except** the 3 D15 counterexamples in
`verification15.test.ts` (3 red / 6 green).

## THE RULE (authoritative - do not re-litigate)
- `docs/design/citadels-full-game.md`, rules of record: "A turn: gather (2 gold, or
  draw 2 keep 1), then optionally build one district."
- `rules.json` blackmailer: "When a threatened player is called, they must gather
  resources, then resolve the threat ... A threatened player must resolve the threat
  before using abilities or building."
- The threatened order is therefore fixed: **gather -> threat -> abilities -> build**.
  The threat is spliced INTO the seat's own turn, so the plain turn must be
  **gather -> abilities -> build** (the same order with no threat standing).
- The pinned contract that makes this load-bearing: a refused threat leaves every
  character exactly where an unthreatened turn ends
  (`verification11.test.ts` P1, `verification14.test.ts` P1, `verification15.test.ts` P1).

## WHAT TO CHANGE (helpers.ts + windows.ts only; both are shared, you own them this unit)
`relocateEffectBelowThreat` (helpers.ts ~732, called from windows.ts ~51) already
relocates an effect's windows below the threat on a threatened turn. Extend it:

1. **Relocate on a plain turn too.** Today it returns early when no threat window
   stands (`threatAt < 0`). Instead, when there is no threat, relocate the effect's
   windows below the **gather turn window** itself, so the stack reads
   `[turn(gather), arm, ...abilityWindows, END_TURN, ...]`. Keep the Witch exemption
   (her naming window drives her resume pairing) and keep the threatened path's
   behaviour byte-identical.
2. **Place the build window after the relocated abilities.** In `resolveTurn`'s
   gather path (the final `action?.t === "draw"` / gold branch, helpers.ts ~1000),
   the continuation `rest` now holds `[arm, ...abilityWindows, END_TURN, ...]`. Put the
   turn's `buildWindow` **after** the ability windows and **above** the turn's own
   `END_TURN`, exactly as the threatened branch already does (mirror the
   `leadsWithResolve` / `endAt` / `rearm` shape at helpers.ts ~945).
   - An effect resolve that must run AFTER the build (the **Alchemist's** settle
     refund) leads the continuation instead: there the build window stays directly
     below the gather and that resolve stays beneath it.
   - The Alchemist's turn-open pass (`alchemist.ts`) injects a `RESOLVE` between the
     turn window and its rest; make sure it still ends with the settle refund after
     the build and the build limit still re-offers.
3. **A hand-built stack with no `end-turn`** (many unit fixtures build
   `steps: [turn, end-round]` by hand) must keep working: when the continuation has no
   `end-turn`, place the build window directly below the gather and let
   `endTurnThen` supply the close, so those fixtures are unchanged. Only a real turn
   (which always carries its own `END_TURN`) takes the new ability-before-build order.
4. The `arm` step kind already carries an effect's pending payload below the threat;
   reuse it for the plain relocation (the gather and the ability windows both read
   `pending`, so the payload must ride an arm step exactly as it does post-threat).
   `state.ts` `encodeStep/decodeStep` already round-trip `arm` - do not change it.

## ACCEPTANCE (each a checkable line)
1. `verification15.test.ts` D15-1, D15-2, D15-3 all green; P1-P6 stay green.
2. Every prior pass's counterexamples stay green: verification-report, verification2
   through verification14 (14 files / 115 tests).
3. The full citadels suite is green (88 files / 714 tests) with every fixture that
   pinned the old ability-before-gather order re-framed to the rule, not weakened.
   Expect re-frames in at least: `verification2.test.ts` (6 window rows),
   `engine-coverage.test.ts` (reachability rows), the district fixtures that drive a
   real turn, and any `verificationN` row that asserts a window position. Re-frame
   each with a measured before/after number and a rules.json citation; never delete an
   assertion to make it pass.
4. Teeth proven: in a `/tmp` archive copy, reverting the relocation reddens D15-1..3
   (and the re-framed guards); reverting the build placement reddens the build-order
   guards. Record RED/GREEN per probe.
5. `tsc -p tsconfig.citadels.json` clean.

## VERIFY
```
scripts/citadels-verify.sh \
  shared/core/tests/lockstep/citadels/verification15.test.ts \
  shared/core/tests/lockstep/citadels/verification14.test.ts \
  shared/core/tests/lockstep/citadels/verification11.test.ts \
  shared/core/tests/lockstep/citadels/verification13.test.ts \
  --own shared/core/lockstep/games/citadels/helpers.ts \
  --own shared/core/lockstep/games/citadels/windows.ts
vp test shared/core/tests/lockstep/citadels/
```
Known gotchas: repo-wide `vp test`/`vp check` are red at baseline (unrelated) - never
run them. The P3 fold is ~5.5s; give any slow test an explicit timeout.

## CONTEXT
- The D15 report: `orchestrate/citadels/verification-15.md` (read the "Fix shape"
  section; the verifier deferred the shape to the coordinator and its own suggestion
  was self-contradictory - the rule text above decides).
- The D13/D14 seam rulings: `orchestrate/citadels/decisions.tsv` tail, and
  `verification-13.md` / `verification-14.md`.
- The prior orchestrator's own analysis reached this same shape ("approach A") and
  looped without committing; the ruling is recorded in `decisions.tsv` this session.
- Coordinator prototype (a rough sketch, NOT authoritative - it had its own build-path
  bug): relocating the windows alone reddens 15 tests, mostly fixture re-frames plus 2
  engine-coverage reachability rows from the incomplete build placement. Measure the
  real blast radius yourself.

## SCOPE (files you own this unit)
- `shared/core/lockstep/games/citadels/helpers.ts`
- `shared/core/lockstep/games/citadels/windows.ts`
- `shared/core/tests/lockstep/citadels/verification15.test.ts`
- `shared/core/tests/lockstep/citadels/verification2.test.ts`, `verification11.test.ts`,
  `verification13.test.ts`, `verification14.test.ts`, `engine-coverage.test.ts`
  (only to re-frame a stale fixture to the new order)
- `orchestrate/citadels/verification-15.md` (append a "coordinator fix" note only if you
  need to correct its fix-shape section)

Do NOT edit any character file, any district file, `state.ts`, `actions.ts`, or any
other test file. If a re-frame needs a file outside this list, report it and stop.

## FORBIDDEN
No rebase, no force-push, no amend, no `--no-verify`, no edits to
`shared/core/lockstep/games/g54/**`, no edits to the lockstep primitive
(`shared/core/lockstep/*.ts`), no new runtime dependencies. Never run
`git checkout`/`switch`/`stash`/`reset`/`rebase`/`branch` in the shared worktree.
Never weaken or delete an assertion to make a fixture pass.

## STANDING ORDERS
Read `orchestrate/citadels/preferences.md` (all 13) and
`/home/kevin/.pi/agent/skills/poteto-agent/SKILL.md` + `poteto-mode/SKILL.md` in full
before any work. One worktree, one branch. Commit ONLY through
`scripts/citadels-commit.sh "<message>" <path>...`. Stage only paths you own.

## METHOD
Work in small commits, each ending green on the artifact. Re-frame fixtures as you
break them, not in a final sweep. For the teeth audit, copy the worktree with
`git archive HEAD | tar -x -C /tmp/citadels-f15`, patch the copy with a replace that
ASSERTS the pattern is present, run the named guard, record RED/GREEN, restore from the
shared worktree by copy.

## REPORT
End with: status, files written, the exact verify command, its raw result, the commit
SHA(s), the measured before/after for each re-framed fixture, the teeth probe table,
and any deviation or shared-file change you need.
