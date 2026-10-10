import { expect, test } from "vitest";
import {
  DISTRICT_HOOKS,
  UNIQUE_DISTRICTS,
  type DistrictHook,
  type DistrictId,
} from "../../../lockstep/games/citadels/districts.ts";
import { UNIQUE_TRIGGERS } from "../../../lockstep/games/citadels/districts/effects.ts";
import { armoryTriggers } from "../../../lockstep/games/citadels/districts/armory.ts";
import { basilicaTriggers } from "../../../lockstep/games/citadels/districts/basilica.ts";
import { capitolTriggers } from "../../../lockstep/games/citadels/districts/capitol.ts";
import { dragonGateTriggers } from "../../../lockstep/games/citadels/districts/dragon-gate.ts";
import { factoryTriggers } from "../../../lockstep/games/citadels/districts/factory.ts";
import { frameworkTriggers } from "../../../lockstep/games/citadels/districts/framework.ts";
import { goldMineTriggers } from "../../../lockstep/games/citadels/districts/gold-mine.ts";
import { greatWallTriggers } from "../../../lockstep/games/citadels/districts/great-wall.ts";
import {
  hauntedQuarterTriggers,
} from "../../../lockstep/games/citadels/districts/haunted-quarter.ts";
import {
  imperialTreasuryTriggers,
} from "../../../lockstep/games/citadels/districts/imperial-treasury.ts";
import { ivoryTowerTriggers } from "../../../lockstep/games/citadels/districts/ivory-tower.ts";
import { keepTriggers } from "../../../lockstep/games/citadels/districts/keep.ts";
import { laboratoryTriggers } from "../../../lockstep/games/citadels/districts/laboratory.ts";
import { libraryTriggers } from "../../../lockstep/games/citadels/districts/library.ts";
import { mapRoomTriggers } from "../../../lockstep/games/citadels/districts/map-room.ts";
import { monumentTriggers } from "../../../lockstep/games/citadels/districts/monument.ts";
import { museumTriggers } from "../../../lockstep/games/citadels/districts/museum.ts";
import { necropolisTriggers } from "../../../lockstep/games/citadels/districts/necropolis.ts";
import { observatoryTriggers } from "../../../lockstep/games/citadels/districts/observatory.ts";
import { parkTriggers } from "../../../lockstep/games/citadels/districts/park.ts";
import { poorHouseTriggers } from "../../../lockstep/games/citadels/districts/poor-house.ts";
import { quarryTriggers } from "../../../lockstep/games/citadels/districts/quarry.ts";
import {
  schoolOfMagicTriggers,
} from "../../../lockstep/games/citadels/districts/school-of-magic.ts";
import { secretVaultTriggers } from "../../../lockstep/games/citadels/districts/secret-vault.ts";
import { smithyTriggers } from "../../../lockstep/games/citadels/districts/smithy.ts";
import { stablesTriggers } from "../../../lockstep/games/citadels/districts/stables.ts";
import { statueTriggers } from "../../../lockstep/games/citadels/districts/statue.ts";
import { theaterTriggers } from "../../../lockstep/games/citadels/districts/theater.ts";
import { thievesDenTriggers } from "../../../lockstep/games/citadels/districts/thieves-den.ts";
import { wishingWellTriggers } from "../../../lockstep/games/citadels/districts/wishing-well.ts";

/** Each trigger declaration, read straight from the district file that exports it. */
const DECLARED_IN_FILE: Record<DistrictId, readonly DistrictHook[]> = {
  armory: armoryTriggers,
  basilica: basilicaTriggers,
  capitol: capitolTriggers,
  "dragon-gate": dragonGateTriggers,
  factory: factoryTriggers,
  framework: frameworkTriggers,
  "gold-mine": goldMineTriggers,
  "great-wall": greatWallTriggers,
  "haunted-quarter": hauntedQuarterTriggers,
  "imperial-treasury": imperialTreasuryTriggers,
  "ivory-tower": ivoryTowerTriggers,
  keep: keepTriggers,
  laboratory: laboratoryTriggers,
  library: libraryTriggers,
  "map-room": mapRoomTriggers,
  monument: monumentTriggers,
  museum: museumTriggers,
  necropolis: necropolisTriggers,
  observatory: observatoryTriggers,
  park: parkTriggers,
  "poor-house": poorHouseTriggers,
  quarry: quarryTriggers,
  "school-of-magic": schoolOfMagicTriggers,
  "secret-vault": secretVaultTriggers,
  smithy: smithyTriggers,
  stables: stablesTriggers,
  statue: statueTriggers,
  theater: theaterTriggers,
  "thieves-den": thievesDenTriggers,
  "wishing-well": wishingWellTriggers,
};

test("UNIQUE_TRIGGERS is total over UNIQUE_DISTRICTS, with no extra rows", () => {
  const ids = UNIQUE_DISTRICTS.map((spec) => spec.id).sort();
  expect(ids).toHaveLength(30);
  expect(Object.keys(UNIQUE_TRIGGERS).sort()).toEqual(ids);
});

test("every declared hook is a member of DISTRICT_HOOKS", () => {
  for (const [id, hooks] of Object.entries(UNIQUE_TRIGGERS)) {
    for (const hook of hooks) {
      expect(DISTRICT_HOOKS, `${id} declares ${hook}`).toContain(hook);
    }
  }
});

/** The seam this unit exists for: a row is its district file’s own exported array. */
test("every row is the array its own district file exports", () => {
  for (const spec of UNIQUE_DISTRICTS) {
    expect(UNIQUE_TRIGGERS[spec.id]).toBe(DECLARED_IN_FILE[spec.id]);
  }
});
