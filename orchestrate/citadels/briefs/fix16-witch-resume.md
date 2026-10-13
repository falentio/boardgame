# Unit: fix16-witch-resume (D16-1: the Witch's resume turn double-gathers)

## GOAL
Fix D16-1: the D15 fix made the Witch's resumed turn gather a second time. Her held
turn gathers her fixed +2; the resume must gather nothing. Today the resume's gold
reaches 4 where the rule caps it at 2.

## HEAD
`b1382df` on `feat/citadels-game-definitions`, worktree
`/home/kevin/.t3/worktrees/boardgame/t3-a32da114`. The citadels suite is green except
the 2 D16-1 counterexamples in `verification16.test.ts` (2 red / 3 green).

## THE DEFECT (confirmed on the artifact)
`verification16.test.ts` D16-1 / D16-1b: measured gold trail
`0,2,2,2,2,2,2,2,4,4,4,4` (rule caps at 2); clean at `aa6f553`/`5305109`/`536f78d`
(all 2), appears at `e12a21c` (4). Blast radius: Thief, Magician, Wizard, Seer, Emperor,
Abbot, Cardinal, Scholar, Warlord, Diplomat, Marshal, Tax Collector (peak 4), Navigator
(6), Merchant (3).

**Mechanism.** The D15 relocation moves an effect's ability windows below the gather
turn window. The Witch's resume stack is `[RESOLVE, turn, ...]`
(`characters/witch.ts` `resumeStack`): the RESOLVE runs the bewitched effect, which
pushes its window above `turn`; the relocation then moves that window below `turn`,
carrying the ability's own pending (`warlord-pick`, the Scholar's pool, ...).
`resolveTurn` reads the resume marker off the incoming pending
(`incoming?.note === WITCH_RESUME_NOTE`); with the ability's pending standing there it
no longer recognizes the resume, so `resumedWitch` is false and the turn takes the
GATHER path.

## THE FIX (a coordinator prototype that passes; verify and own it)
`orchestrate/citadels/salvage/fix16-witch-lead.diff` is a validated lead (full suite
89 files / 720 tests green in a `/tmp` copy). It has two parts in `characters/witch.ts`:
1. `resumeStack` carries the resume pending on an explicit `arm` step directly above
   the turn window: `[RESOLVE, arm(resumePending), turn, ...]`.
2. `witchResolve` builds `resumePending` once and passes it to `resumeStack`.

Why it works: the `arm` step means "this turn window's gather already happened" (the
Witch's held-turn +2), which is exactly what the relocation's first-pass guard
(`hasArmAbove`) already reads, so the relocation skips and the resume's ability window
keeps its place; and the arm re-arms the resume pending so `resolveTurn` recognizes the
resume turn. This is the first of the two shapes verify-16 named ("the relocation must
not move the bewitched effect's window past the `witch-resume` turn window"); the second
("`resolveTurn` recognizes the resume from the stack") is an acceptable alternative if
you find it cleaner. Pick one, prove it, and do not special-case a character by name in
the relocation itself.

## ACCEPTANCE (each a checkable line)
1. `verification16.test.ts` D16-1 and D16-1b green; P1-P3 stay green.
2. Every prior counterexample green: verification-report, verification2..15 (15 files /
   125 tests).
3. The full citadels suite green (89 files / 720 tests). Every fixture that pinned the
   old resume shape is re-framed to the rule with a measured before/after and a rules.json
   citation; never delete an assertion.
4. **Guard gaps to close (from the verify-16 findings):**
   - The first-pass guard is load-bearing for five multi-pass effects (Spy, Assassin,
     Magistrate, Thief, Blackmailer) but only the Spy has an absolute-gold guard. Add a
     one-gather guard for the other four (or one parameterized guard over all five).
   - `verification14` D14-1 stays GREEN under the D15 relocation revert (it pins
     keep-before-build, blind to where the gather sits). Strengthen it so it reddens when
     the gather moves, or state in the report why the live guards (verification2 x6,
     verification15) suffice.
5. Teeth proven in a `/tmp` archive copy: revert the fix -> D16-1/D16-1b red; re-run each
   new/re-framed guard under a relevant neuter and record RED/GREEN.
6. `tsc -p tsconfig.citadels.json` clean.

## VERIFY
```
scripts/citadels-verify.sh \
  shared/core/tests/lockstep/citadels/verification16.test.ts \
  shared/core/tests/lockstep/citadels/verification15.test.ts \
  shared/core/tests/lockstep/citadels/verification14.test.ts \
  shared/core/tests/lockstep/citadels/characters/witch.test.ts \
  --own shared/core/lockstep/games/citadels/characters/witch.ts
vp test shared/core/tests/lockstep/citadels/
```
Gotchas: repo-wide `vp test`/`vp check` are red at baseline - never run them. The P3 fold
is ~5.5s; give a slow test an explicit timeout.

## CONTEXT
- `orchestrate/citadels/verification-16.md` (the finding) and `decisions.tsv` (the D15
  ruling).
- `characters/witch.ts` (the resume), `helpers.ts` `resolveTurn`/`relocateEffectBelowThreat`
  (the seam), `characters/witch.test.ts` and `verification5.test.ts` D5-1..4,
  `verification8.test.ts` D8-1 (the existing resume guards).
- r1/r2 history: `salvage/fix15-helpers.diff`, `briefs/fix15-plain-order-r2.md`.

## SCOPE (files you own this unit)
- `shared/core/lockstep/games/citadels/characters/witch.ts`
- `shared/core/lockstep/games/citadels/helpers.ts` (only if the stack-recognition
  alternative needs it; report if so)
- `shared/core/tests/lockstep/citadels/verification16.test.ts`,
  `verification14.test.ts`, `verification15.test.ts`, `engine-coverage.test.ts`
  (only to add a guard or re-frame a stale fixture)
- `orchestrate/citadels/verification-16.md` (append a correction note only if needed)

Do NOT edit any other character file, any district file, state.ts, actions.ts, or any
other test file. If a fix needs a file outside this list, report it and stop.

## FORBIDDEN
No rebase, no force-push, no amend, no --no-verify, no edits to
`shared/core/lockstep/games/g54/**` or the lockstep primitive
(`shared/core/lockstep/*.ts`), no new runtime dependencies. Never run
`git checkout`/`switch`/`stash`/`reset`/`rebase`/`branch` in the shared worktree.
Never weaken or delete an assertion to make a fixture pass.

## STANDING ORDERS
Read `orchestrate/citadels/preferences.md` (all 13) and
`/home/kevin/.pi/agent/skills/poteto-agent/SKILL.md` + `poteto-mode/SKILL.md` in full
before any work. One worktree, one branch. Commit ONLY through
`scripts/citadels-commit.sh "<message>" <path>...`.

## METHOD
Small commits, each ending green on the artifact. Teeth audit in `/tmp/citadels-f16`
(`git archive HEAD | tar -x -C`), patching the copy with a replace that ASSERTS the
pattern is present.

## REPORT
End with: status, files written, the exact verify command, its raw result, the commit
SHA(s), the measured before/after for each re-framed fixture and new guard, the teeth
probe table, and any deviation or shared-file change you need.
