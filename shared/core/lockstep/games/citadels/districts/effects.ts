import type { Random, SeatId } from "../../../index.ts";
import { UNIQUE_DISTRICTS, type DistrictHook, type DistrictId } from "../districts.ts";
import type { WindowResolver } from "../helpers.ts";
import type { CitadelsState, PlacedDistrict, Step, WindowPurpose } from "../state.ts";
import { armoryTriggers, armory, armoryResolve, armoryScoring } from "./armory.ts";
import { basilicaTriggers, basilica, basilicaScoring } from "./basilica.ts";
import { capitolTriggers, capitol, capitolScoring } from "./capitol.ts";
import { dragonGateTriggers, dragonGate, dragonGateScoring } from "./dragon-gate.ts";
import { factoryTriggers, factory, factoryScoring } from "./factory.ts";
import { frameworkTriggers, framework, frameworkScoring } from "./framework.ts";
import { goldMineTriggers, goldMine, goldMineScoring } from "./gold-mine.ts";
import { greatWallTriggers, greatWall, greatWallScoring } from "./great-wall.ts";
import {
  hauntedQuarterTriggers,
  hauntedQuarter,
  hauntedQuarterScoring,
} from "./haunted-quarter.ts";
import {
  imperialTreasuryTriggers,
  imperialTreasury,
  imperialTreasuryScoring,
} from "./imperial-treasury.ts";
import { ivoryTowerTriggers, ivoryTower, ivoryTowerScoring } from "./ivory-tower.ts";
import { keepTriggers, keep, keepScoring } from "./keep.ts";
import { laboratoryTriggers, laboratory, laboratoryScoring } from "./laboratory.ts";
import { libraryTriggers, library, libraryScoring } from "./library.ts";
import { mapRoomTriggers, mapRoom, mapRoomScoring } from "./map-room.ts";
import { monumentTriggers, monument, monumentScoring } from "./monument.ts";
import { museumTriggers, museum, museumScoring } from "./museum.ts";
import { necropolisTriggers, necropolis, necropolisScoring } from "./necropolis.ts";
import { observatoryTriggers, observatory, observatoryScoring } from "./observatory.ts";
import { parkTriggers, park, parkScoring } from "./park.ts";
import { poorHouseTriggers, poorHouse, poorHouseScoring } from "./poor-house.ts";
import { quarryTriggers, quarry, quarryScoring } from "./quarry.ts";
import { schoolOfMagicTriggers, schoolOfMagic, schoolOfMagicScoring } from "./school-of-magic.ts";
import { secretVaultTriggers, secretVault, secretVaultScoring } from "./secret-vault.ts";
import { smithyTriggers, smithy, smithyScoring } from "./smithy.ts";
import { stablesTriggers, stables, stablesScoring } from "./stables.ts";
import { statueTriggers, statue, statueScoring } from "./statue.ts";
import { theaterTriggers, theater, theaterResolve, theaterScoring } from "./theater.ts";
import { thievesDenTriggers, thievesDen, thievesDenScoring } from "./thieves-den.ts";
import { wishingWellTriggers, wishingWell, wishingWellScoring } from "./wishing-well.ts";

/** The context a district effect reads and writes. */
export interface DistrictCtx {
  readonly state: CitadelsState;
  readonly owner: SeatId;
  readonly city: readonly PlacedDistrict[];
  readonly rest: readonly Step[];
  readonly rng: Random;
}

export type DistrictEffect = (ctx: DistrictCtx) => CitadelsState;

/** End-game points a unique district adds to its owner's score. */
export type DistrictScoring = (
  district: PlacedDistrict,
  city: readonly PlacedDistrict[],
  seat: SeatId,
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

/** Every unique district id, in catalog order. */
export const UNIQUE_IDS: readonly DistrictId[] = UNIQUE_DISTRICTS.map((spec) => spec.id);
