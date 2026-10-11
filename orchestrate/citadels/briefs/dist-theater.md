# Unit: dist-theater

## GOAL
Implement the Theater unique district. It is the last district stub. It needs a
round-start district hook, which is a small shared-file change; make it once and
keep it generic.

## READ FIRST
- docs/design/citadels-catalog.md (the Theater effect)
- shared/core/lockstep/games/citadels/districts/theater.ts (the stub you own)
- shared/core/lockstep/games/citadels/districts.ts (DistrictHook)
- shared/core/lockstep/games/citadels/helpers.ts (`applyEndRound`, `runDistrictHooks`, `resolveGeneric`)
- shared/core/lockstep/games/citadels/districts/effects.ts (DISTRICT_RESOLVERS)
- shared/core/tests/lockstep/citadels/district-seams.test.ts (the seam test style)

## THE EFFECT (official rulebook text; the spec)
At the start of the round you may exchange your character card for a random
character card from another player. You choose the player blindly, without
looking at anyone's character card. Exchanged cards are not revealed until they
are called. In 2-3 player games you choose which of your two characters to give
and randomly take one of your opponent's.

## SCOPE (the files you own)
- shared/core/lockstep/games/citadels/districts/theater.ts
- shared/core/lockstep/games/citadels/districts.ts (add one hook name only)
- shared/core/lockstep/games/citadels/helpers.ts (add the round-start hook call site)
- shared/core/tests/lockstep/citadels/districts/theater.test.ts (NEW)

## WHAT TO DO
1. Add `"onRoundStart"` to the `DistrictHook` union and `DISTRICT_HOOKS`.
2. In `applyEndRound` in helpers.ts, before the new round's draft is built, call
   `runDistrictHooks(state, "onRoundStart", seat, [], rng)` for each seat that owns a
   district declaring it. Keep the existing draft build after it.
3. `theaterTriggers = ["onRoundStart"]`. `theater` opens a `theatre-swap` window
   naming the Theater's owner; `theaterResolve` reads a `target` action, picks one
   of the target's claimed characters at random with `rng`, swaps it with the
   owner's lowest-rank claimed character, and pops. An illegal or absent target
   leaves both claim sets untouched.
4. The swap must operate on `state.claimed` (the per-round character assignments),
   so a swapped card is what gets called. Read `Claim` in state.ts first.

## ACCEPTANCE (tests in theater.test.ts)
- A Theater owner can swap their claimed character with a random one from a chosen
  rival, and the swap is visible in `claimed` afterwards.
- The rival is chosen blindly: no character identity is read from the target before the swap.
- An illegal target (self, absent, resigned) leaves `claimed` unchanged.
- The effect is not a no-op: the owner's claimed character differs after a swap.
- The whole citadels suite passes, and `vp test shared/core/tests/lockstep/citadels/` is green.

## VERIFY
`scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/districts/theater.test.ts --own shared/core/lockstep/games/citadels/districts/theater.ts --own shared/core/lockstep/games/citadels/districts.ts --own shared/core/lockstep/games/citadels/helpers.ts`
Then run the whole citadels suite and report it.

## FORBIDDEN
Standing orders apply. No other shared-file change. Keep every existing public name.

## REPORT
status; files written; verify output including the whole suite; commit SHA; the
exact hook name added and the call site line; any clause you could not represent.

## STANDING ORDERS
<paste preferences.md verbatim>
