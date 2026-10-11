# Unit: fix2-regression (encode the lesson: a folded-game test per character)

## GOAL
The root cause of both verification passes: every unit tested its own file in
isolation, and none tested that the ENGINE reaches it. 27 green character tests
missed that six characters were dead. Write the test that cannot miss it.

## WHAT TO WRITE
One new test file, shared/core/tests/lockstep/citadels/engine-coverage.test.ts,
that folds a real game and asserts the engine reaches each character and district
ability. This is the structural guard (encode-lessons-in-structure): a character
whose window never opens, or whose effect never runs, must fail here.

Concretely:
1. **Per-character reachability.** For each of the 27 characters, build a cast
   containing it, drive a game with a policy that uses its ability, and assert a
   visible effect: a window purpose opens, or a state field changes (gold, crown,
   skipped, robbed, bewitched, threats, warrants, claimed, hand). A character the
   engine never reaches must fail its assertion. Use the driver's helpers.
2. **The naming window specifically.** Assert that a folded game containing the
   Assassin records a kill, one containing the Thief records a rob, one containing
   the Witch records a bewitch, one containing the Blackmailer assigns a threat,
   one containing the Spy opens a peek. These are the V2-1/V2-2 cases; they must be
   covered by a folded game, not a hand-placed window.
3. **Per-district hook reachability.** For each unique district whose trigger is
   non-empty, build a city holding it, take a turn, and assert the hook fired
   (a window opened or a state change). Cover the Armory's onDestroy specifically.
4. **Once per turn.** Assert each end-of-turn district fires exactly once in a turn
   (the V2-3 guard), by counting the gold/cards it moves in one turn.

## PRECONDITION
The two sibling units fix2-engine and fix2-characters are fixing the defects this
test would catch. Write the tests; if a test fails because a sibling's fix has not
landed yet, note it and keep the test (it is the guard). Prefer to land after them;
if you land first, the suite may be red until they land, which is acceptable and
expected. Report which assertions were red at your commit.

## SCOPE (the files you own)
- shared/core/tests/lockstep/citadels/engine-coverage.test.ts (NEW)
- shared/core/tests/lockstep/citadels/driver.ts (extend only; keep every existing export)

Do not edit any source file. If a test reveals a source defect, report it; a sibling
fixes it.

## ACCEPTANCE
The file exists, covers all 27 characters and every hook-bearing district, and
passes once the sibling fixes land. Every assertion would fail if the engine
stopped reaching that ability.

## VERIFY
`scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/engine-coverage.test.ts --own shared/core/tests/lockstep/citadels/driver.ts`
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
per-character assertion shape; which characters or districts have no observable
engine effect and why; any assertion still red pending a sibling fix.

## STANDING ORDERS
1. WORKTREE. All agents share ONE worktree and ONE branch: /home/kevin/.t3/worktrees/boardgame/t3-a32da114 on feat/citadels-game-definitions. There is no per-agent worktree. Never run `git checkout`, `git switch`, `git stash`, `git reset`, `git rebase`, or `git branch`.
2. COMMITS. Commit ONLY through `scripts/citadels-commit.sh "<message>" <path> [<path>...]`, which takes a lock on the shared git index. Never run bare `git commit` or `git add`. Stage only the paths you own; the script refuses a path that does not exist.
3. VERIFY. Your gate is `scripts/citadels-verify.sh <your test file> --own <each source file you edited>`. Pass `--own` for every source file you edit; without it the script derives only from existing test names. Do not run repo-wide `vp test` or `vp check`: both are red at baseline for unrelated reasons.
4. SCOPE. Write only the files named in your brief. Never edit a sibling's file, and never edit a shared file (state.ts, actions.ts, windows.ts, helpers.ts, setup.ts, scoring.ts, index.ts, characters.ts, districts.ts, characters/index.ts, districts/effects.ts). If you need a shared-file change, report it and stop; the coordinator serializes it.
... 8 more; narrow with state/track filters or limit
