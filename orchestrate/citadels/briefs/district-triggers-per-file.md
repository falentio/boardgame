# Unit: district-triggers-per-file (SERIALIZED shared-file change)

## GOAL
Move each unique district's trigger declaration out of the shared
`UNIQUE_TRIGGERS` table in districts/effects.ts and into that district's own
file, so a district worker edits only its own file.

## WHY
The district briefs currently tell a worker to "set your own id's row in
UNIQUE_TRIGGERS". That is a shared-file edit: districts/effects.ts holds all 30
rows, so two district workers editing different rows still write the same file,
and the commit script stages whole paths, so one worker's commit sweeps the
sibling's half-written row. Encode the lesson in structure: the row lives in the
file that owns it.

## READ FIRST
- shared/core/lockstep/games/citadels/districts/effects.ts (the table you are removing)
- shared/core/lockstep/games/citadels/districts/keep.ts (a stub, the shape to change)
- shared/core/lockstep/games/citadels/helpers.ts (`runDistrictHooks`, which reads the table)
- shared/core/lockstep/games/citadels/districts.ts (`DistrictHook`)

## SCOPE (the files you own)
- shared/core/lockstep/games/citadels/districts/effects.ts
- shared/core/lockstep/games/citadels/districts/*.ts (all 30: add a `triggers` export)
- shared/core/tests/lockstep/citadels/district-triggers.test.ts (NEW)

## WHAT TO DO

1. Every `districts/<id>.ts` gains a third export:
   ```ts
   /** The engine hooks this district responds to; empty means never called. */
   export const <camel>Triggers: readonly DistrictHook[] = [];
   ```
   All 30 start empty. A district worker fills its own array.

2. In `districts/effects.ts`, replace the hand-written `UNIQUE_TRIGGERS` object
   with one derived from those per-file exports, keeping the same exported name
   and type so `helpers.ts` is untouched:
   ```ts
   export const UNIQUE_TRIGGERS: Record<DistrictId, readonly DistrictHook[]> = {
     armory: armoryTriggers,
     // ...one line per id, imported from its own file
   };
   ```

3. Add a test that the table is total over `UNIQUE_DISTRICTS` and that every value
   is a subset of `DISTRICT_HOOKS`.

## ACCEPTANCE (tests in district-triggers.test.ts)
- `Object.keys(UNIQUE_TRIGGERS)` covers every unique district id.
- Every declared hook is a member of `DISTRICT_HOOKS`.
- `npx tsc -p tsconfig.citadels.json` is clean; the citadels suite still passes.

## VERIFY
`scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/district-triggers.test.ts shared/core/tests/lockstep/citadels/scaffold.test.ts`

## FORBIDDEN
Standing orders apply. Do not implement any district effect body; only the
trigger seam.

## REPORT
status; files written; verify output; commit SHA; the exact new export name.

## STANDING ORDERS
<paste preferences.md verbatim>
