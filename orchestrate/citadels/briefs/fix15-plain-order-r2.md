# Unit: fix15-plain-order-r2 (the D15 fix: plain turn gathers before its ability)

## GOAL
Land the D15 fix: the plain turn order is **gather -> abilities -> build**, so a refused
threatened seat ends exactly where its plain turn ends. r1 (fix15-plain-order) died to
"Provider finish_reason: error" mid-work with a substantial uncommitted salvage and one
real bug. You inherit the salvage; your job is to finish it correctly.

## SALVAGE (read it first)
`orchestrate/citadels/salvage/fix15-helpers.diff` is r1's uncommitted helpers.ts diff
(87+/26-, tsc clean, 705/714 green from a 711 baseline). It was reverted out of the
worktree so you start from a clean base; apply it as a starting point if useful
(`git apply`), but it carries the bug below. Read the diff in full.

## THE RULE (settled; do not re-litigate)
- `docs/design/citadels-full-game.md`: "A turn: gather (2 gold, or draw 2 keep 1), then
  optionally build one district."
- `rules.json` blackmailer: "they must gather resources, then resolve the threat ...
  before using abilities or building." The threat is spliced INTO the seat's own turn, so
  the plain turn is the same order with no threat standing: **gather -> abilities -> build**.
- Pinned contract: a refused threat leaves every character where an unthreatened turn
  ends (`verification11` P1, `verification14` P1, `verification15` P1).

## r1's approach (keep it) and its bug (fix it)
`relocateEffectBelowThreat` (helpers.ts ~732, called from windows.ts ~51) used to move a
threatened effect's windows below the Blackmailer threat. r1 extended it to move the
effect's windows below the **gather turn window** when no threat stands, so the stack
reads `[turn(gather), arm, ...abilityWindows, END_TURN, ...]`, and reworked
`resolveTurn`'s gather branch (`afterGather`) to place the build window after those
windows and above the turn's own END_TURN.

**The bug: the relocation runs on EVERY `resolve` step, not only the effect's first
pass.** Several characters are multi-pass effects (spy, assassin, thief, magistrate, seer,
...): each pass pushes another window above the turn window. On the SECOND pass the stack
is `[choose-type, RESOLVE, rearm, buildWindow, END_TURN, ...]` and the relocation hoists
the enclosing **build** turn window above the `rearm` arm step that arms its gather
marker, so the turn window gathers again. Measured on the spy guard: purposes
`[null,turn,choose-seat,turn,choose-type,turn,draft-pick]` (three gathers) and
`goldDelta` 6 where 4 is correct.

**The fix: relocate only for the effect's first pass** (the windows above the GATHER
window), never for a later pass (windows above the already-placed BUILD window). A placed
build window always has an `arm` step (the `rearm`, or the Alchemist's settle resolve)
directly above it, so one robust guard is: **skip the relocation when the segment above
the turn window already contains an `arm` step**, or equivalently when the step directly
above the turn window is an arm step. Consider the alternatives and pick the one that
holds for all 27 characters; do not special-case a character.

## ACCEPTANCE (each a checkable line)
1. `verification15.test.ts` D15-1/2/3 green, P1-P6 green. **Note D15-1's second
   assertion is STALE**: it asserts the plain Warlord "cannot" destroy the Barracks, which
   encoded the bug. Under the rule both plain and refused gather first, so both destroy and
   their end keys match. Re-frame that assertion to the rule with the measured numbers.
2. Every prior counterexample green: verification-report, verification2..14 (14 files /
   115 tests). Expect to re-frame: verification2's 6 window rows (they assert the ability
   window opens right after the call; now the gather window opens first), and
   verification14 D14-1 (its `purposes.indexOf("turn")` build proxy now matches the
   GATHER window, not the build - re-frame it to count the build correctly).
3. No double gather: every multi-pass effect folds with the correct gather count.
   `engine-coverage.test.ts`'s spy row (`goldDelta` 4) and every other character guard
   green. Add a probe that pins "exactly one gather per turn" for a multi-pass effect.
4. Full citadels suite green (88 files / 714 tests). Every re-framed fixture carries a
   measured before/after and a rules.json citation; never delete an assertion to pass.
5. Teeth proven in a `/tmp` archive copy: revert the relocation -> D15-1..3 red; revert
   the build placement -> the build-order guards red; re-run each re-framed guard under a
   neuter and record RED/GREEN.
6. `tsc -p tsconfig.citadels.json` clean.

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
Gotchas: repo-wide `vp test`/`vp check` are red at baseline - never run them. The P3 fold
is ~5.5s; give a slow test an explicit timeout.

## SCOPE (files you own this unit)
- `shared/core/lockstep/games/citadels/helpers.ts`, `.../windows.ts`
- `shared/core/tests/lockstep/citadels/verification15.test.ts`, `verification14.test.ts`,
  `verification2.test.ts`, `verification11.test.ts`, `verification13.test.ts`,
  `engine-coverage.test.ts` (only to re-frame a stale fixture to the new order)
- `orchestrate/citadels/verification-15.md` (append a correction note only if needed)

Do NOT edit any character file, any district file, state.ts, actions.ts, or any other test
file. If a re-frame needs a file outside this list, report it and stop.

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
Work in small commits, each ending green on the artifact. Re-frame fixtures as you break
them. Teeth audit in `/tmp/citadels-f15r2` (`git archive HEAD | tar -x -C`), patching the
copy with a replace that ASSERTS the pattern is present.

## REPORT
End with: status, files written, the exact verify command, its raw result, the commit
SHA(s), the measured before/after for each re-framed fixture, the teeth probe table, and
any deviation or shared-file change you need.
