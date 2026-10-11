# Unit: fix2-engine (V2-1 blocking, V2-2, V2-3, V2-4, V2-7, V2-8)

## GOAL
Repair the engine seams the second verification pass found. V2-1 is blocking: six
characters are still dead in a real game.

## THE DEFECTS (read each counterexample in verification2.test.ts)
- **V2-1 (blocking).** `drain` in windows.ts:69 decides whether to stop at a
  window with `owedFor(next, top.window)`, which filters the window's explicit
  `seats`. The Assassin, Witch, Magistrate, Thief, Spy, and Blackmailer open
  `choose-character`/`choose-seat`/`choose-type` windows built with
  `winStep(purpose, [])` (empty seats, `kind: "any"`). `owedFor` returns [] for
  those, so `drain` pops them before anyone answers. `stepState` already uses
  `windowOwed` (which expands `any` to `liveSeats`); `drain` must use it too. A
  folded base-cast game must then record a kill, a rob, or a bewitch.
- **V2-2.** `blackmailer` distinguishes its first pass by `pending === null`, but
  `applyCall` now arms `pending` before the effect runs, so the effect takes its
  second-pass branch immediately and never assigns threat markers. Fix the
  effect's pass test (use a `pending.note` marker like the other two-pass effects).
- **V2-3.** The turn continuation is `[RESOLVE, turn, END_TURN, CALL, ...rest]`, and
  `resolveTurn` returns `[END_TURN, ...rest]` where `rest` still holds the
  continuation's `END_TURN`, so `applyEndTurn` runs twice and every end-of-turn
  district (Laboratory, Smithy, Park, Poor House) fires twice. Fix the stack so one
  `END_TURN` fires per turn.
- **V2-4.** `tryBuild` charges no gold when `payCards > 0`, so the Thieves' Den's
  gold share is never debited. Charge the gold remainder and spend the cards.
- **V2-7.** The Alchemist reads `pending.gold` for the turn's build spend, but no
  build path writes it. Record the gold a build paid in the turn-local pending, so
  the Alchemist's end-of-turn refund returns it.
- **V2-8.** `armoryTriggers` declares `onDestroy`, but `runDistrictHooks` is never
  called with `onDestroy`. Fire `onDestroy` for the acting seat's city when it
  takes its turn, so the Armory offers its destroy window.

## SCOPE (the files you own)
- shared/core/lockstep/games/citadels/windows.ts
- shared/core/lockstep/games/citadels/helpers.ts
- shared/core/lockstep/games/citadels/characters/blackmailer.ts
- shared/core/lockstep/games/citadels/characters/alchemist.ts
- shared/core/lockstep/games/citadels/districts/armory.ts
- shared/core/lockstep/games/citadels/districts/thieves-den.ts

A sibling owns characters/trader.ts, emperor.ts, diplomat.ts and
districts/museum.ts; do not touch those.

## ACCEPTANCE
The counterexamples V2-1 (and its per-character cases), V2-2, V2-3, V2-4, V2-7,
V2-8 pass. The whole citadels suite is green.

## VERIFY
`scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification2.test.ts --own shared/core/lockstep/games/citadels/windows.ts --own shared/core/lockstep/games/citadels/helpers.ts --own shared/core/lockstep/games/citadels/characters/blackmailer.ts --own shared/core/lockstep/games/citadels/characters/alchemist.ts --own shared/core/lockstep/games/citadels/districts/armory.ts --own shared/core/lockstep/games/citadels/districts/thieves-den.ts`
Then `vp test shared/core/tests/lockstep/citadels/` and report both.

## HOW TO WORK
The second verifier wrote executable counterexamples at
shared/core/tests/lockstep/citadels/verification2.test.ts. Your fixes are done when
YOUR assigned counterexamples in that file pass and the whole citadels suite is
green. Read each counterexample first; it is the spec. Fix the source, not the test.
If a counterexample encodes a wrong rule, report it and stop.

Do NOT edit verification2.test.ts or verification-report.test.ts. Do NOT edit a
file outside your SCOPE. Commit through scripts/citadels-commit.sh.

## REPORT
status; files written; verify output including the whole suite; commit SHA; the
exact V2-1 line changed; the new END_TURN shape; anything the fixes introduced.

## STANDING ORDERS
1. WORKTREE. All agents share ONE worktree and ONE branch: /home/kevin/.t3/worktrees/boardgame/t3-a32da114 on feat/citadels-game-definitions. There is no per-agent worktree. Never run `git checkout`, `git switch`, `git stash`, `git reset`, `git rebase`, or `git branch`.
2. COMMITS. Commit ONLY through `scripts/citadels-commit.sh "<message>" <path> [<path>...]`, which takes a lock on the shared git index. Never run bare `git commit` or `git add`. Stage only the paths you own; the script refuses a path that does not exist.
3. VERIFY. Your gate is `scripts/citadels-verify.sh <your test file> --own <each source file you edited>`. Pass `--own` for every source file you edit; without it the script derives only from existing test names. Do not run repo-wide `vp test` or `vp check`: both are red at baseline for unrelated reasons.
4. SCOPE. Write only the files named in your brief. Never edit a sibling's file, and never edit a shared file (state.ts, actions.ts, windows.ts, helpers.ts, setup.ts, scoring.ts, index.ts, characters.ts, districts.ts, characters/index.ts, districts/effects.ts). If you need a shared-file change, report it and stop; the coordinator serializes it.
... 8 more; narrow with state/track filters or limit
