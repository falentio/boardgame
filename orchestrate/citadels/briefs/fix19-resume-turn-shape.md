# Unit: fix19-resume-turn-shape (the resume arms the bewitched character's OWN turn shape)

## GOAL
Close D18-1 and D18-2: the Witch's resume currently arms a hard-coded generic turn
template, but a resumed turn is the BEWITCHED CHARACTER'S turn and must use that
character's own turn shape, exactly as `applyCall` arms an ordinary turn.

## HEAD
`4329155` on `feat/citadels-game-definitions`, worktree
`/home/kevin/.t3/worktrees/boardgame/t3-a32da114`. The suite is green except the 2
D18 counterexamples in `verification18.test.ts` (2 red / 5 green).

## THE DEFECTS (confirmed on the artifact)
- **D18-1**: the Alchemist's resume loses its end-of-turn build refund. Resume purse 5
  vs plain 7. `alchemist` (characters/alchemist.ts) detects its turn-open pass with
  `atTurnTop(ctx.rest)`, which requires `ctx.rest[0]` to be a `turn` window. The resume
  stack is `[RESOLVE, arm, turn, ...]`, so `ctx.rest[0]` is the `arm` step, `atTurnTop`
  is false, the turn-open pass is skipped, and the settle resolve never runs - the
  refund is 0.
- **D18-2**: the Navigator's resume never offers the four-gold-or-four-cards choice. The
  Navigator's turn window IS its gain choice, and its effect runs BELOW the turn window
  reading the choice from `pending.note` (`applyCall` arms it `[turn, RESOLVE, ...]`).
  The resume arms `[RESOLVE, arm, turn, ...]`, so the effect runs ABOVE the turn window
  and reads the wrong note; no choice window opens after `witch-resume`.

## ROOT CAUSE
`applyCall` (helpers.ts ~1191) arms the turn shape:
`character === "navigator" ? [turn, RESOLVE, END_TURN, CALL, ...rest] : [RESOLVE, turn,
END_TURN, CALL, ...rest]`. `witchResolve` (characters/witch.ts `resumeStack`) reimplements
this as a fixed `[RESOLVE, arm(resumePending), turn, ...rest]`, which is neither shape
for the two characters whose turn shape differs (the Alchemist keys on `ctx.rest[0]`, the
Navigator arms turn-above-resolve). The resume must reuse the SAME arming.

## THE FIX (reuse, do not re-implement)
1. Extract `applyCall`'s turn-shape arming into one helper (e.g.
   `armCharacterTurn(character, seat, rest)` in helpers.ts) returning the
   `[turn, RESOLVE, END_TURN, ...]` / `[RESOLVE, turn, END_TURN, ...]` shape WITHOUT the
   trailing `CALL` (the resume does not advance the rank cursor). `applyCall` keeps its
   `...CALL, ...rest` tail; the resume uses the same helper with `rest` = the round's
   continuation after the resume.
2. `witchResolve`/`resumeStack` calls that helper instead of hand-building the stack, so
   the Alchemist sees `ctx.rest[0]` as its turn window and the Navigator's effect runs
   below its turn window.
3. The `arm` step fix16 planted above the resume turn window is no longer needed for the
   identity (that is owned by `state.resume` now). Remove it if the helper's shape makes
   it redundant, BUT keep the plain-turn relocation correct: verify the resume still
   reads `state.resume` (not the arm) for `resumedWitch`, and that the ability windows
   still drain after the gather (D15) and the resume never gathers (D16/D17). Measure; if
   the arm step is still load-bearing for the relocation's first-pass guard, keep it in a
   position that does NOT sit at `ctx.rest[0]` (below the turn window, not above it).
4. `RESUME_WINDOW_TAG` on that arm step is inert (no engine decision reads it) and is
   being retired in `fix18-drop-locator-tag`; do not reintroduce a dependency on it.

## ACCEPTANCE
1. `verification18.test.ts` D18-1 and D18-2 green; P1-P5 stay green.
2. Every prior counterexample green: verification-report + verification2..17 (17 files /
   138 tests). Expect to re-frame none if the fix is a true reuse; report any re-frame.
3. Full citadels suite green (`vp test shared/core/tests/lockstep/citadels/`).
4. D13/D14/D15/D16/D17 keep holding.
5. Teeth proven in a /tmp copy: revert the arming reuse -> D18-1/D18-2 red.
6. `tsc -p tsconfig.citadels.json` clean.

## SCOPE (files you own)
- `shared/core/lockstep/games/citadels/helpers.ts` (the extracted arming helper; applyCall
  and the resume call it)
- `shared/core/lockstep/games/citadels/characters/witch.ts` (resumeStack/witchResolve)
- `shared/core/tests/lockstep/citadels/verification18.test.ts` (only to correct a
  counterexample that is itself wrong)

Do NOT edit any other character file (alchemist.ts/navigator.ts must be correct as-is -
the defect is the resume's arming, not those effects), any district file, or any other
test file. If a character effect genuinely needs a change, report it and stop.

## FORBIDDEN
No rebase, force-push, amend, --no-verify; no edits to the lockstep primitive
(`shared/core/lockstep/*.ts`) or `games/g54/**`; no new runtime deps. Never
`git checkout`/`switch`/`stash`/`reset`/`rebase`/`branch` in the shared worktree.

## STANDING ORDERS
Read `orchestrate/citadels/preferences.md` (all 13) and the poteto-agent + poteto-mode
skills in full. Commit only through `scripts/citadels-commit.sh`.

## REPORT
End with: status, files written, the exact verify command, its raw result, the commit
SHA, the measured D18 before/after, the teeth table, and any deviation.
