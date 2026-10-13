# Unit: fix17-resume-token (collapse unit if the arena keeps dying)

## GOAL
Close the D17 family (D17-1..5) in ONE seam change: the Witch's resume identity must
be owned by immutable state, never the shared clobberable `pending` slot, and the
resume turn window must be recognizable independent of what an effect prepends.

## HEAD
`6dfbbd9` on `feat/citadels-game-definitions`, worktree
`/home/kevin/.t3/worktrees/boardgame/t3-a32da114`. The suite is green except the 6
D17 counterexamples in `verification17.test.ts` (6 red / 4 green).

## THE MECHANISM (verified from source; see design/resume-seam/GROUNDING-NOTE.md)
`seatHolding` (helpers.ts:106) returns the Witch's seat for the bewitched character
only while `pending.note === WITCH_RESUME_NOTE`. Every effect that runs on the resume
opens by writing its OWN `pending.note`, erasing the marker:
- `abbot.ts:69` -> `ownerOf` falls back to the real holder -> income on the holder's
  city (D17-2).
- `emperor.ts:51` -> the reward lands on the holder (D17-5).
- `spy.ts:39` -> dispatch sees an unknown note, falls to the apply branch, runs
  nothing (D17-3).
- `blackmailer.ts:54` -> the commit branch runs with `namedCharacter` null, no
  markers (D17-4).
And `withBuildLimit` (scholar.ts:34, architect.ts:29) filters and re-prepends `turn`
windows ABOVE the fix16 arm step, so the visited turn window carries note null and
gathers a second time (D17-1).

## THE FIX SHAPE (a dedicated state field; the smallest surface)
1. Add to `CitadelsState` (state.ts) a non-clobberable resume record, e.g.
   `readonly resume?: { readonly seat: SeatId; readonly character: CharacterId | null } | null`.
   Round-trip it in `encode`/`decode` (state.ts) exactly like `bewitched`/`threats`.
2. `witchResolve` (characters/witch.ts) sets `state.resume = { seat: witchSeat,
   character: bewitched }` when it opens the resume, and clears it at the resume's
   end (`applyEndTurn` clears it, or `resolveTurn` clears it as the resume closes).
3. `seatHolding` and `buildLimit` (helpers.ts) read the resume identity from
   `state.resume` instead of `pending.note`. `resolveTurn` sets `resumedWitch` from
   `state.resume !== null` (and no longer from the incoming pending).
4. Keep the resume turn window recognized by POSITION, independent of what the
   effect prepends: the resume turn window is the one below the RESOLVE step the
   `resumeStack` pushes; mark it so `withBuildLimit`'s re-seating cannot defeat it
   (e.g. give the resume window its own purpose or a resume flag the window carries,
   and exempt it from `withBuildLimit`). Choose the shape that keeps the 27 character
   files untouched.
5. Delete the now-dead `WITCH_RESUME_NOTE` pending-marker plumbing once nothing reads
   it (migrate every reader, then remove it in the same change - no legacy path).

## ACCEPTANCE
1. `verification17.test.ts` D17-1, D17-1b, D17-2, D17-3, D17-4, D17-5 all green.
2. Every prior pass counterexample green: verification-report + verification2..16
   (16 files / 131 tests).
3. Full citadels suite green (vp test shared/core/tests/lockstep/citadels/).
4. D13/D14/D15/D16 keep holding (their counterexamples are in the 131).
5. Codec round-trip test for the new field (a mid-resume snapshot encode/decode
   restores the resume identity).
6. `tsc -p tsconfig.citadels.json` clean.
7. Teeth proven in a /tmp copy: neuter the resume field -> D17-1..5 red.

## SCOPE (files you own)
- `shared/core/lockstep/games/citadels/state.ts` (the field + codec)
- `shared/core/lockstep/games/citadels/helpers.ts` (seatHolding, buildLimit,
  resolveTurn, activeCharacterOf)
- `shared/core/lockstep/games/citadels/characters/witch.ts` (resumeStack/witchResolve)
- `shared/core/lockstep/games/citadels/characters/scholar.ts` / `architect.ts` ONLY if
  the withBuildLimit exemption needs it (report if so)
- `shared/core/tests/lockstep/citadels/verification17.test.ts` (only to correct a
  counterexample that is itself wrong)

Do NOT edit the other 25 character files, any district file, or any other test file.

## FORBIDDEN
No rebase, force-push, amend, --no-verify; no edits to the lockstep primitive
(`shared/core/lockstep/*.ts`) or `games/g54/**`; no new runtime deps. Never
`git checkout`/`switch`/`stash`/`reset`/`rebase`/`branch` in the shared worktree.

## STANDING ORDERS
Read `orchestrate/citadels/preferences.md` (all 13) and the poteto-agent + poteto-mode
skills in full. Commit only through `scripts/citadels-commit.sh`.

## REPORT
End with: status, files written, the exact verify command, its raw result, the commit
SHA, the measured D17 before/after, the teeth table, and any deviation.
