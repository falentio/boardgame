# Coordinator grounding note: why the resume identity must leave `pending`

## The exact clobber points (measured from source)
`seatHolding(state, character)` (helpers.ts:106) returns `pending.actor` for the
bewitched character only while `pending.note === WITCH_RESUME_NOTE`. Every effect that
runs on the resume opens by writing its OWN `pending.note`, which erases the marker:

- `abbot.ts:69` writes `note: "abbot-split"` -> `ownerOf` (abbot.ts:23) falls back to
  the real holder -> income counted on the holder's city (D17-2).
- `emperor.ts:51` writes `note: "emperor-target"` -> `emperorResolve` keys on the real
  holder -> crown reward to the holder (D17-5).
- `spy.ts:39` writes `note: SEAT_NOTE` -> the effect's dispatch sees a note that is
  neither null nor its own tags, falls through to the apply branch with no target ->
  no naming, no loot (D17-3).
- `blackmailer.ts:54` writes `note: THREAT_1` -> the commit branch runs with
  `namedCharacter` null -> no markers (D17-4).

And the re-seating clobber (D17-1): `withBuildLimit` (scholar.ts:34, architect.ts:29)
filters out `turn` windows and re-prepends its own ABOVE the fix16 `arm` step, so the
turn window `resolveTurn` visits is not the one the arm marked.

## The invariant any fix must restore
The resume identity is read by `seatHolding`/`buildLimit`/`resolveTurn` while a character
effect is executing. The effect runs at a bare `resolve` step (no window), so the
identity must live in STATE at that moment - either a dedicated field no effect writes,
or a stack token that `resolveTurn` copies into state before the resolve step runs. It
must NOT be re-derived from `pending`, because `pending` is the slot every effect
legitimately writes for its own sub-state.

## What the picker should check
- Does the resume identity survive an effect that writes `pending.note` AND re-seats
  `turn` windows (the Scholar, the Architect)?
- Is the new state codec-round-tripped (encodeStep/decodeStep or encode/decode state)?
- Are the 27 character files untouched (no effect learns about the resume)?
- Do D13/D14/D15/D16 still hold?
