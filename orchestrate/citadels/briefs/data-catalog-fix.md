# Unit: data-catalog-fix (SERIALIZED, on the critical path)

## GOAL
Replace the scaffold's invented district catalog and mis-ranked characters with
the authoritative data in docs/design/citadels-catalog.md. Every downstream
worker reads the catalog this unit fixes, so it lands before any fan-out.

## READ FIRST
- docs/design/citadels-catalog.md  (the authoritative data; transcribe it, do not invent)
- docs/design/citadels-full-game.md (the rules of record)
- shared/core/lockstep/games/citadels/districts.ts, characters.ts,
  districts/effects.ts, characters/index.ts (the files you are correcting)
- shared/core/tests/lockstep/citadels/scaffold.test.ts (the tests you must keep green)
- shared/core/tests/lockstep/citadels/driver.ts

## THE TWO DEFECTS

### Defect 1: the district catalog was invented
The scaffold lists 54 basic districts as 54 DISTINCT cards with `copies: 1`, using
names that do not exist (Guardhouse, Armory, Battlefield, Citadel, War Academy,
Arsenal, Siege Works, Shrine, Baptistry, Abbey, Priory, Cloister, Sanctuary,
Grand Temple, Basilica, Holy See, Estate, Courtyard, Villa, Townhouse, Atrium,
Chateau, Mansion, Gallery, Conservatory, Shop, Cart, Peddler, Inn, Warehouse,
Bazaar, Storehouse, Caravan, Counting House, Fair, Exchange, Guildhall, Grand
Market, Emporium, Mint).

The real 54 basic districts are 17 distinct cards, each with several copies:
- Military (11): Watchtower 1 x3, Prison 2 x3, Barracks 3 x3, Fortress 5 x2
- Noble (12): Manor 3 x5, Castle 4 x4, Palace 5 x3
- Religious (11): Temple 1 x3, Church 2 x3, Monastery 3 x3, Cathedral 5 x2
- Trade (20): Tavern 1 x5, Market 2 x4, Trading Post 2 x3, Docks 3 x3,
  Harbor 4 x3, Town Hall 5 x2

The scaffold's unique list is also wrong: it has Bell Tower (not in the 2016 set),
Ballroom, Cathedral (as unique), Clock Tower, Graveyard, Menagerie, Scriptorium,
Triumphal Arch, University, Wharf (all invented), and it is missing Armory,
Basilica, Capitol, Framework, Gold Mine, Map Room, Monument, Necropolis, Secret
Vault, Stables.

The real 30 unique districts, exactly, are in docs/design/citadels-catalog.md
with id and cost. Use those ids verbatim.

### Defect 2: characters 1-3 are mis-ranked
The scaffold has:
  rank 1: assassin, witch, spy        -> WRONG, Spy is rank 2
  rank 2: thief, blackmailer, seer    -> WRONG, Seer is rank 3
  rank 3: magician, wizard, magistrate -> WRONG, Magistrate is rank 1
Correct:
  rank 1: assassin, witch, magistrate
  rank 2: thief, spy, blackmailer
  rank 3: magician, wizard, seer
Ranks 4-9 are correct.

Also fix the `income` field per docs/design/citadels-catalog.md: Patrician and
Cardinal take a CARD for their income, not gold; Abbot takes gold OR cards. Model
this honestly rather than as a gold boolean: extend `CharacterSpec.income` to
carry both what it counts and what it grants, or add a sibling field. Your choice,
but it must be able to express "1 card per religious district" and "gold or cards".

## SCOPE (the files you own)
- shared/core/lockstep/games/citadels/districts.ts
- shared/core/lockstep/games/citadels/characters.ts
- shared/core/lockstep/games/citadels/districts/effects.ts
- shared/core/lockstep/games/citadels/characters/index.ts
- shared/core/lockstep/games/citadels/districts/*.ts  (the 30 unique files: rename, add, delete)
- shared/core/lockstep/games/citadels/characters/*.ts (only if a rank fix changes an import; prefer not)
- shared/core/lockstep/games/citadels/setup.ts (only DEFAULT_UNIQUES and any cast validation the new ranks affect)
- shared/core/tests/lockstep/citadels/scaffold.test.ts (update the assertions that encoded the wrong data)
- shared/core/tests/lockstep/citadels/catalog.test.ts (NEW: the tests below)

Do NOT touch helpers.ts, state.ts, windows.ts, scoring.ts, actions.ts, index.ts,
or any other character/district effect body. If a fix seems to need one, report
and stop.

## ACCEPTANCE (tests in catalog.test.ts)
- `BASIC_DISTRICTS` has exactly 17 entries and sums to 54 copies.
- The per-type copy totals are military 11, noble 12, religious 11, trade 20.
- `UNIQUE_DISTRICTS` has exactly 30 entries, every one `copies: 1`, ids matching
  docs/design/citadels-catalog.md exactly (assert the sorted id list).
- No district id or name is duplicated across basic and unique.
- `buildDeck(DEFAULT_UNIQUES, rng)` has length 54 + 14 = 68.
- `charactersOfRank(1)` is exactly [assassin, witch, magistrate]; same exactness
  for ranks 2 and 3.
- Every rank 1-9 has exactly 3 characters; the catalog has 27.
- The income field expresses a card grant: Patrician's and Cardinal's income grant
  cards, Abbot's grants a choice.
- The scaffold's existing tests still pass (update the assertions that encoded
  the invented data, and say so in your report).

## VERIFY
`scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/scaffold.test.ts shared/core/tests/lockstep/citadels/catalog.test.ts`

## FORBIDDEN
Standing orders apply. Plus: do not rename any `WindowPurpose`, do not change the
`CharacterId` or `DistrictId` unions' spelling rules, do not implement any real
character or district effect body (that is the next wave's work).

## REPORT
status; the file list with renames/adds/deletes; the verify command and raw
output; the commit SHA; the exact shape you chose for the income field; every
assertion in scaffold.test.ts you had to change and why.

## STANDING ORDERS
<paste preferences.md verbatim>
