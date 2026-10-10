1. WORKTREE. All agents share ONE worktree and ONE branch: /home/kevin/.t3/worktrees/boardgame/t3-a32da114 on feat/citadels-game-definitions. There is no per-agent worktree. Never run `git checkout`, `git switch`, `git stash`, `git reset`, `git rebase`, or `git branch`.
2. COMMITS. Commit ONLY through `scripts/citadels-commit.sh "<message>" <path> [<path>...]`, which takes a lock on the shared git index. Never run bare `git commit` or `git add`. Stage only the paths you own; the script refuses a path that does not exist.
3. VERIFY. Your gate is `scripts/citadels-verify.sh <your test file>`. It runs `vp test` on that file plus `tsc -p tsconfig.citadels.json`. Report its raw output. Do not run repo-wide `vp test` or `vp check`: both are red at baseline for unrelated reasons (5 pre-existing failures in server/modules/rooms/tests/http.test.ts, and repo-wide formatting).
4. SCOPE. Write only the files named in your brief. Never edit a sibling's file. If a sibling's file is broken and blocks your test, report it and stop; do not fix it.
5. FORBIDDEN. No rebase, no force-push, no amend, no `--no-verify`, no edits to `shared/core/lockstep/games/g54/**`, no edits to the lockstep primitive (`shared/core/lockstep/*.ts`), no new runtime dependencies.
6. PERSONA. Read /home/kevin/.pi/agent/skills/poteto-agent/SKILL.md, then /home/kevin/.pi/agent/skills/poteto-mode/SKILL.md in full, before any work.
7. TESTS ARE THE PRODUCT. Every behavioral claim needs a test that would fail if the behavior were wrong. A test that only asserts "it does not throw" is not a test.
8. REPORT. End with: status, files written, the exact verify command, its raw result, the commit SHA, and any deviation from the brief.
9. ONE WRITER PER FILE. The scaffold pre-registers all character and district effects so a worker edits only its own file. Never edit a shared registry.
10. STACKER. The coordinator is the only actor that rebases or retargets. Workers never do.
11. BASELINE IS RED. 5 pre-existing failures in server/modules/rooms/tests/http.test.ts and repo-wide formatting failures predate this branch. Do not try to fix them.
