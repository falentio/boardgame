import type { Random, SeatId } from "../../../index.ts";
import {
  UNIQUE_DISTRICTS,
  type BuildQuery,
  type DistrictHook,
  type DistrictId,
} from "../districts.ts";
import type { WindowResolver } from "../helpers.ts";
import type { CitadelsState, PlacedDistrict, Step, WindowPurpose } from "../state.ts";
import { armoryTriggers, armory, armoryResolve, armoryScoring, armoryBuild } from "./armory.ts";
import { basilicaTriggers, basilica, basilicaScoring, basilicaBuild } from "./basilica.ts";
import { capitolTriggers, capitol, capitolScoring, capitolBuild } from "./capitol.ts";
import { dragonGateTriggers, dragonGate, dragonGateScoring, dragonGateBuild } from "./dragon-gate.ts";
import { factoryTriggers, factory, factoryScoring, factoryBuild } from "./factory.ts";
import { frameworkTriggers, framework, frameworkScoring, frameworkBuild } from "./framework.ts";
import { goldMineTriggers, goldMine, goldMineScoring, goldMineBuild } from "./gold-mine.ts";
import { greatWallTriggers, greatWall, greatWallScoring, greatWallBuild } from "./great-wall.ts";
import {
  hauntedQuarterTriggers,
  hauntedQuarter,
  hauntedQuarterScoring,
  hauntedQuarterBuild,
} from "./haunted-quarter.ts";
import {
  imperialTreasuryTriggers,
  imperialTreasury,
  imperialTreasuryScoring,
  imperialTreasuryBuild,
} from "./imperial-treasury.ts";
import { ivoryTowerTriggers, ivoryTower, ivoryTowerScoring, ivoryTowerBuild } from "./ivory-tower.ts";
import { keepTriggers, keep, keepScoring, keepBuild } from "./keep.ts";
import { laboratoryTriggers, laboratory, laboratoryScoring, laboratoryBuild } from "./laboratory.ts";
import { libraryTriggers, library, libraryScoring, libraryBuild } from "./library.ts";
import { mapRoomTriggers, mapRoom, mapRoomScoring, mapRoomBuild } from "./map-room.ts";
import { monumentTriggers, monument, monumentScoring, monumentBuild } from "./monument.ts";
import { museumTriggers, museum, museumScoring, museumBuild } from "./museum.ts";
import { necropolisTriggers, necropolis, necropolisScoring, necropolisBuild } from "./necropolis.ts";
import { observatoryTriggers, observatory, observatoryScoring, observatoryBuild } from "./observatory.ts";
import { parkTriggers, park, parkScoring, parkBuild } from "./park.ts";
import { poorHouseTriggers, poorHouse, poorHouseScoring, poorHouseBuild } from "./poor-house.ts";
import { quarryTriggers, quarry, quarryScoring, quarryBuild } from "./quarry.ts";
import { schoolOfMagicTriggers, schoolOfMagic, schoolOfMagicScoring, schoolOfMagicBuild } from "./school-of-magic.ts";
import { secretVaultTriggers, secretVault, secretVaultScoring, secretVaultBuild } from "./secret-vault.ts";
import { smithyTriggers, smithy, smithyScoring, smithyBuild } from "./smithy.ts";
import { stablesTriggers, stables, stablesScoring, stablesBuild } from "./stables.ts";
import { statueTriggers, statue, statueScoring, statueBuild } from "./statue.ts";
import { theaterTriggers, theater, theaterResolve, theaterScoring, theaterBuild } from "./theater.ts";
import { thievesDenTriggers, thievesDen, thievesDenScoring, thievesDenBuild } from "./thieves-den.ts";
import { wishingWellTriggers, wishingWell, wishingWellScoring, wishingWellBuild } from "./wishing-well.ts";

/** The context a district effect reads and writes. */
export interface DistrictCtx {
  readonly state: CitadelsState;
  readonly owner: SeatId;
  readonly city: readonly PlacedDistrict[];
  readonly rest: readonly Step[];
  readonly rng: Random;
}

export type DistrictEffect = (ctx: DistrictCtx) => CitadelsState;

/**
 * End-game points a unique district adds to its owner's score. `state` is the
 * whole game state, so a scorer may read gold, hand, the crown, or the cards
 * attached to a district.
 */
export type DistrictScoring = (
  district: PlacedDistrict,
  city: readonly PlacedDistrict[],
  seat: SeatId,
  state: CitadelsState,
) => number;

/**
 * One effect per unique district, each imported from its own `districts/<id>.ts`.
 * A district worker edits only its own file; this registry is written once.
 */
export const UNIQUE_EFFECTS: Record<DistrictId, DistrictEffect> = {
  armory: armory,
  basilica: basilica,
  capitol: capitol,
  "dragon-gate": dragonGate,
  factory: factory,
  framework: framework,
  "gold-mine": goldMine,
  "great-wall": greatWall,
  "haunted-quarter": hauntedQuarter,
  "imperial-treasury": imperialTreasury,
  "ivory-tower": ivoryTower,
  keep: keep,
  laboratory: laboratory,
  library: library,
  "map-room": mapRoom,
  monument: monument,
  museum: museum,
  necropolis: necropolis,
  observatory: observatory,
  park: park,
  "poor-house": poorHouse,
  quarry: quarry,
  "school-of-magic": schoolOfMagic,
  "secret-vault": secretVault,
  smithy: smithy,
  stables: stables,
  statue: statue,
  theater: theater,
  "thieves-den": thievesDen,
  "wishing-well": wishingWell,
};

/**
 * The engine trigger each unique district responds to, read from that
 * district own file. A district worker declares its triggers in its own file
 * and edits nothing here; an empty list means the engine never calls it.
 */
export const UNIQUE_TRIGGERS: Record<DistrictId, readonly DistrictHook[]> = {
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

/** End-game scoring for every unique; a stub returns zero until its worker fills it. */
export const UNIQUE_SCORING: Record<DistrictId, DistrictScoring> = {
  armory: armoryScoring,
  basilica: basilicaScoring,
  capitol: capitolScoring,
  "dragon-gate": dragonGateScoring,
  factory: factoryScoring,
  framework: frameworkScoring,
  "gold-mine": goldMineScoring,
  "great-wall": greatWallScoring,
  "haunted-quarter": hauntedQuarterScoring,
  "imperial-treasury": imperialTreasuryScoring,
  "ivory-tower": ivoryTowerScoring,
  keep: keepScoring,
  laboratory: laboratoryScoring,
  library: libraryScoring,
  "map-room": mapRoomScoring,
  monument: monumentScoring,
  museum: museumScoring,
  necropolis: necropolisScoring,
  observatory: observatoryScoring,
  park: parkScoring,
  "poor-house": poorHouseScoring,
  quarry: quarryScoring,
  "school-of-magic": schoolOfMagicScoring,
  "secret-vault": secretVaultScoring,
  smithy: smithyScoring,
  stables: stablesScoring,
  statue: statueScoring,
  theater: theaterScoring,
  "thieves-den": thievesDenScoring,
  "wishing-well": wishingWellScoring,
};

/**
 * One resolver per window purpose a district owns: the Armory and Theater open
 * windows at the start of the round, and each points at its own district's
 * `<id>Resolve`. Every other purpose is a character window or an engine window,
 * so a district worker never edits a shared registry.
 */
export const DISTRICT_RESOLVERS: Partial<Record<WindowPurpose, WindowResolver>> = {
  "armory-destroy": armoryResolve,
  "theatre-swap": theaterResolve,
};

/**
 * The pre-build answer for every unique, read from that district's own file. The
 * engine folds the rows of the builder's city and the card being built; a stub
 * row returns `{}`, the engine's default terms.
 */
export const UNIQUE_BUILD: Record<DistrictId, BuildQuery> = {
  armory: armoryBuild,
  basilica: basilicaBuild,
  capitol: capitolBuild,
  "dragon-gate": dragonGateBuild,
  factory: factoryBuild,
  framework: frameworkBuild,
  "gold-mine": goldMineBuild,
  "great-wall": greatWallBuild,
  "haunted-quarter": hauntedQuarterBuild,
  "imperial-treasury": imperialTreasuryBuild,
  "ivory-tower": ivoryTowerBuild,
  keep: keepBuild,
  laboratory: laboratoryBuild,
  library: libraryBuild,
  "map-room": mapRoomBuild,
  monument: monumentBuild,
  museum: museumBuild,
  necropolis: necropolisBuild,
  observatory: observatoryBuild,
  park: parkBuild,
  "poor-house": poorHouseBuild,
  quarry: quarryBuild,
  "school-of-magic": schoolOfMagicBuild,
  "secret-vault": secretVaultBuild,
  smithy: smithyBuild,
  stables: stablesBuild,
  statue: statueBuild,
  theater: theaterBuild,
  "thieves-den": thievesDenBuild,
  "wishing-well": wishingWellBuild,
};

/** Every unique district id, in catalog order. */
export const UNIQUE_IDS: readonly DistrictId[] = UNIQUE_DISTRICTS.map((spec) => spec.id);
