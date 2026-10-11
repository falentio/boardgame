# Unit: codec-redaction

## GOAL
Prove the citadels codec and redaction boundary hold at a mid-game point, not
just at genesis: a full state survives a snapshot round-trip, and no hidden
information crosses `project` for any seat.

## READ FIRST
- shared/core/lockstep/snapshot.ts (`encodeSnapshot`, `decodeSnapshot`)
- shared/core/lockstep/codec.ts (Codec)
- shared/core/lockstep/games/citadels/state.ts (stateCodec, CitadelsState)
- shared/core/lockstep/games/citadels/index.ts (project, CitadelsView)
- shared/core/tests/lockstep/snapshot.test.ts (the snapshot test style)
- shared/core/tests/lockstep/citadels/driver.ts and integration.test.ts (how to advance a real game)

## SCOPE (the files you own)
- shared/core/tests/lockstep/citadels/codec-redaction.test.ts (NEW)

## ACCEPTANCE (tests in codec-redaction.test.ts)
1. **Mid-game state round-trip.** Advance a real game several rounds, then assert
   `stateCodec.decode(stateCodec.encode(state))` deep-equals the state. Do this at
   three points: at genesis, mid-draft, and mid-turn-phase with a pending action.
2. **Snapshot round-trip.** Encode a mid-game snapshot and decode it; the restored
   session continues to the same terminal state as the original, the way
   shared/core/tests/lockstep/snapshot.test.ts proves it.
3. **Redaction by keys.** For a live mid-game state, for every seat, `project(seat)`
   exposes that seat's own hand and pick only. Assert the raw state carries `deck`
   and per-player `hand` keys (so their absence in the view is a real omission),
   then assert the view exposes neither. This is the non-vacuity guard.
4. **No hidden leak in any view field.** Walk every field of `CitadelsView` and
   assert no other seat's hand array and no deck array is reachable. A view field
   that carries a hidden card id is the bug this test exists to catch.
5. **Digest sensitivity.** Perturb a hidden field (a deck card) and assert
   `stateDigest` changes, so the digest commits to hidden state too.

## VERIFY
`scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/codec-redaction.test.ts`
Then run the whole citadels suite and report it.

## FORBIDDEN
Standing orders apply. Do not edit any file under shared/core/lockstep/games/citadels/.
If a test fails because the module leaks hidden information, report the exact leak
and stop; do not weaken the test.

## REPORT
status; files written; verify output including the whole suite; commit SHA; any
hidden-information leak you found; any state field that failed to round-trip.

## STANDING ORDERS
<paste preferences.md verbatim>
