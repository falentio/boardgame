# Unit: engine-district-resolvers (SERIALIZED shared-file change)

## GOAL
Add the district analogue of CHARACTER_RESOLVERS, so a district that opens a
window (Armory, Theater) can resolve it from its own file. Closes the gap the
engine-hooks unit flagged.

## PRECONDITION
engine-hooks landed (commit 13155e9): state.ts has the five new window purposes,
including `armory-destroy` and `theatre-swap`, currently wired to
`resolveGeneric` because no district resolver seam exists.

## READ FIRST
- shared/core/lockstep/games/citadels/districts/effects.ts (the district registry)
- shared/core/lockstep/games/citadels/characters/index.ts (the CHARACTER_RESOLVERS pattern to mirror)
- shared/core/lockstep/games/citadels/helpers.ts (WindowCtx, WindowResolver, resolveGeneric)
- shared/core/lockstep/games/citadels/windows.ts (the resolver dispatch in stepState)
- shared/core/lockstep/games/citadels/districts/armory.ts, theatre.ts (the stubs)
- docs/design/citadels-catalog.md (the Armory and Theater effects)

## SCOPE (the files you own)
- shared/core/lockstep/games/citadels/districts/effects.ts
- shared/core/lockstep/games/citadels/districts/armory.ts
- shared/core/lockstep/games/citadels/districts/theatre.ts
- shared/core/lockstep/games/citadels/windows.ts (only the resolver lookup line)
- shared/core/tests/lockstep/citadels/district-windows.test.ts (NEW)

## WHAT TO ADD

1. In `districts/effects.ts`, export:
   ```ts
   export const DISTRICT_RESOLVERS: Partial<Record<WindowPurpose, WindowResolver>> = {
     "armory-destroy": armoryResolve,
     "theatre-swap": theatreResolve,
   };
   ```
   Each `districts/<id>.ts` gains a third export `<id>Resolve: WindowResolver`,
   starting as a stub that pops the window, exactly like the character stubs.

2. In `windows.ts`'s `stepState`, the resolver lookup becomes:
   `CHARACTER_RESOLVERS[purpose] ?? DISTRICT_RESOLVERS[purpose] ?? resolveGeneric`.

3. The two stubs must be real no-ops that pop the window, so a game with Armory or
   Theater still terminates. Their effect workers fill the bodies later.

## ACCEPTANCE (tests in district-windows.test.ts)
- `DISTRICT_RESOLVERS["armory-destroy"]` and `["theatre-swap"]` are defined.
- A game whose cast includes a seat holding Armory still reaches terminal with the
  stub resolver in place (no infinite loop).
- `npx tsc -p tsconfig.citadels.json` is clean; scaffold + hooks tests still pass.

## VERIFY
`scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/district-windows.test.ts shared/core/tests/lockstep/citadels/hooks.test.ts`

## FORBIDDEN
Standing orders apply. Do not implement the Armory or Theater effects themselves;
only the seam and the stubs.

## REPORT
status; files written; verify output; commit SHA; the exact lookup line you changed.

## STANDING ORDERS
<paste preferences.md verbatim>
