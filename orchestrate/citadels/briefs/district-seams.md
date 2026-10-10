# Unit: district-seams (SERIALIZED shared-file change; unblocks 15 district members)

## GOAL
Widen the district contract so the remaining 15 unique districts can be
implemented each in its own file. Three units proved by probe that the current
seams cannot express their rules. This unit fixes the seams once.

## EVIDENCE (three independent units, each proved its block by probe)
- dist-build: 7 blocked. `tryBuild` charges `specOfDistrict(id).cost`, commits the
  district, then runs `onBuild`, discarding the hook's returned steps. So a
  district cannot change its own cost, cannot gate legality, cannot pay
  alternatively, cannot open a choice window, and there is no build-limit counter.
- dist-scoring: 5 blocked. `DistrictScoring = (district, city, seat) => number`
  never sees `CitadelsState`, so a scorer cannot read gold, hand, crown, or a
  district's attached cards.
- dist-income: 3 blocked. The gather-draw path in `resolveTurn` never calls
  `runDistrictHooks`, so Library/Observatory/School of Magic cannot modify the draw.

## READ FIRST
- shared/core/lockstep/games/citadels/helpers.ts (`tryBuild`, `resolveTurn`, `runDistrictHooks`)
- shared/core/lockstep/games/citadels/scoring.ts (`uniquePoints`, `colourBonus`)
- shared/core/lockstep/games/citadels/districts.ts, districts/effects.ts (the contracts)
- shared/core/lockstep/games/citadels/state.ts (PlacedDistrict, CitadelsState)
- shared/core/tests/lockstep/citadels/districts/factory.test.ts (the one working build-hook example)
- docs/design/citadels-catalog.md (the effects these seams must express)

## SCOPE (the files you own)
- shared/core/lockstep/games/citadels/districts.ts
- shared/core/lockstep/games/citadels/districts/effects.ts
- shared/core/lockstep/games/citadels/helpers.ts
- shared/core/lockstep/games/citadels/scoring.ts
- shared/core/lockstep/games/citadels/state.ts (only `PlacedDistrict` and a build counter)
- shared/core/tests/lockstep/citadels/district-seams.test.ts (NEW)

## WHAT TO ADD

### 1. A pre-build query, mirroring UNIQUE_TRIGGERS
In `districts.ts`:
```ts
export interface BuildTerms {
  /** The cost to charge, defaulting to the catalog cost. */
  readonly cost?: number;
  /** Cards from hand the build consumes in place of gold, at 1 card = 1 gold. */
  readonly payCards?: number;
  /** A district in the builder's own city the build destroys instead of paying. */
  readonly destroy?: boolean;
  /** False when the district may not be built now (Monument below five districts). */
  readonly legal?: boolean;
  /** False when this build must not consume the turn's build limit (Stables). */
  readonly countsAsBuild?: boolean;
}
export type BuildQuery = (ctx: {
  readonly state: CitadelsState;
  readonly seat: SeatId;
  readonly card: DistrictId;
  readonly city: readonly PlacedDistrict[];
}) => BuildTerms;
```
In `districts/effects.ts`, add `UNIQUE_BUILD: Record<DistrictId, BuildQuery>`, one
row per id imported from that district's own file, each defaulting to `() => ({})`.
Every `districts/<id>.ts` gains `export const <camel>Build: BuildQuery = () => ({});`.

### 2. `tryBuild` honors the query
Compute the terms by folding every unique in the builder's city plus the card
being built (so a card can price itself: Framework, Necropolis, Thieves' Den, and
a city card can discount it: Factory). Then: reject when `legal === false`;
charge `terms.cost ?? catalog cost`; consume `payCards` from hand and `destroy` a
city district when set; keep the district's build running the `onBuild` hook;
record whether the build was paid and whether it counts toward the limit.

### 3. A build-limit counter
Add `readonly builtThisTurn: number` to `CitadelsState` (optional, default 0).
`tryBuild` increments it when `countsAsBuild !== false`. `resolveTurn` allows
another build when the character's limit is not yet reached. Character limits:
Architect 3, Seer 2, Scholar 2, Trader unlimited for trade districts, Navigator 0,
everyone else 1. Reset it in `applyEndTurn`.

### 4. A gather-draw hook
In `resolveTurn`'s `action.t === "draw"` path, run `runDistrictHooks(state, "onDraw", seat, ...)`
before dealing, and let a hook adjust the draw count or keep count. Add `"onDraw"`
to `DistrictHook`. Library keeps 2 of 2, Observatory draws 3 keeps 1, School of
Magic substitutes its own type for a colour count.

### 5. State-aware scoring
Widen `DistrictScoring` to
`(district: PlacedDistrict, city: readonly PlacedDistrict[], seat: SeatId, state: CitadelsState) => number`
and pass `state` from `uniquePoints`. This unblocks Imperial Treasury (gold),
Map Room (hand), Statue (crown), Museum (attached cards).

### 6. A district card store
Add `readonly cards?: readonly DistrictId[]` to `PlacedDistrict` for the Museum's
attachments, and encode/decode it in `stateCodec`.

### 7. A type-substitution seam for Haunted Quarter
Let a scorer or a colour count consult a per-district declared type. The simplest
honest shape: a `HauntedQuarterChoice` recorded in state (the type the owner
chose), defaulting to `"unique"`, set by a `haunted-quarter` window or at scoring
time. If a scoring-time choice window is too large for this unit, implement the
rulebook default (counts as its declared type, default unique) and report the
choice window as a follow-up.

## ACCEPTANCE (tests in district-seams.test.ts)
- A crafted district whose `UNIQUE_BUILD` returns `{ cost: 2 }` is charged 2, not its catalog cost.
- A crafted district returning `{ legal: false }` cannot be built.
- `{ countsAsBuild: false }` leaves `builtThisTurn` unchanged and permits a second build.
- `{ payCards: 2 }` consumes two hand cards and no gold.
- `{ destroy: true }` removes a chosen own district instead of charging gold.
- A scorer receiving `state` can read gold and hand.
- `PlacedDistrict.cards` round-trips through `stateCodec`.
- The whole citadels suite still passes; every currently-green district test stays green.

## VERIFY
`scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/district-seams.test.ts --own <each file you edited>`
Then run the whole citadels suite: `vp test shared/core/tests/lockstep/citadels/` and report it.

## FORBIDDEN
Standing orders apply. Do not implement any district's actual effect body beyond
the test doubles you craft; the district workers do that next. Keep every existing
public name working.

## REPORT
status; files written; verify output including the full suite; commit SHA; the
exact new type names and their fields; which of the 15 blocked members each seam
now unblocks; anything still unrepresentable.

## STANDING ORDERS
<paste preferences.md verbatim>
