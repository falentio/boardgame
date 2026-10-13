# Unit: fix18-drop-locator-tag (retire the inert resume locator tag)

## GOAL
Remove the last piece of legacy resume plumbing: the inert `RESUME_WINDOW_TAG` locator
on the resume window's arm step, kept only because an out-of-scope test still reads it.
Migrate that caller to the owned `state.resume` record, then delete the tag (migrate
callers, then delete the legacy API, in one wave).

## HEAD
`<VERIFY18_SHA>` on `feat/citadels-game-definitions`, worktree
`/home/kevin/.t3/worktrees/boardgame/t3-a32da114`. The suite is green.

## THE LOOSE END
`fix17-resume-token` owned the Witch's resume identity in `state.resume` and deleted the
`WITCH_RESUME_NOTE` pending marker, but kept `RESUME_WINDOW_TAG = "witch-resume"`
(`characters/witch.ts:33`) on the resume window's arm step because
`shared/core/tests/lockstep/citadels/verification4.test.ts:147` locates the resume turn by
`state.pending?.note === "witch-resume"`. No engine decision reads the tag; it exists
only to satisfy that test. That is the classic legacy-marker smell: migrate the caller,
then delete the marker.

## WHAT TO DO
1. Re-aim `verification4.test.ts` D4-1 to locate the resume turn from the owned record
   (`state.resume !== null`, or `state.resume.seat === ANN`), not `pending.note`. Keep
   the assertion's teeth: the test must still redden if the resume turn stops being
   recognized (its teeth rely on the held turn building nothing and the resume building
   exactly once).
2. Delete `RESUME_WINDOW_TAG` from `characters/witch.ts` and drop the `note:` on the
   resume arm step, so the arm carries a clean `emptyPending(witchSeat, bewitched)`.
   Confirm nothing else reads the tag (grep the module and the suite).
3. Confirm the resume still opens on a clean pending for the Spy/Blackmailer (they
   dispatch on `pending.note`; the arm step must not seed a foreign note).

## ACCEPTANCE
1. Full citadels suite green (`vp test shared/core/tests/lockstep/citadels/`).
2. `verification4.test.ts` D4-1 green and teeth-proven: in a /tmp copy, neuter the resume
   recognition (`resumedWitch = false` in helpers.ts) and confirm D4-1 reddens.
3. `grep -rn "witch-resume" shared/core/lockstep/games/citadels/` returns only the
   `WindowPurpose` entry and the window purpose string - no lingering `note:` tag.
4. `tsc -p tsconfig.citadels.json` clean.

## SCOPE (files you own)
- `shared/core/lockstep/games/citadels/characters/witch.ts`
- `shared/core/tests/lockstep/citadels/verification4.test.ts`

Do NOT edit helpers.ts, state.ts, or any other file.

## FORBIDDEN
No rebase, force-push, amend, --no-verify; no edits to the lockstep primitive or
`games/g54/**`; no new runtime deps. Never `git checkout`/`switch`/`stash`/`reset`/
`rebase`/`branch` in the shared worktree.

## STANDING ORDERS
Read `orchestrate/citadels/preferences.md` (all 13) and the poteto-agent + poteto-mode
skills in full. Commit only through `scripts/citadels-commit.sh`.

## REPORT
End with: status, files written, the exact verify command, its raw result, the commit
SHA, the D4-1 teeth result, and any deviation.
