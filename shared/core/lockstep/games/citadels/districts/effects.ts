import type { Random, SeatId } from "../../../index.ts";
import { UNIQUE_DISTRICTS, type DistrictHook, type DistrictId } from "../districts.ts";
import type { CitadelsState, PlacedDistrict, Step } from "../state.ts";
import { armory, armoryScoring } from "./armory.ts";
import { basilica, basilicaScoring } from "./basilica.ts";
import { capitol, capitolScoring } from "./capitol.ts";
import { dragonGate, dragonGateScoring } from "./dragon-gate.ts";
import { factory, factoryScoring } from "./factory.ts";
import { framework, frameworkScoring } from "./framework.ts";
import { goldMine, goldMineScoring } from "./gold-mine.ts";
import { greatWall, greatWallScoring } from "./great-wall.ts";
import { hauntedQuarter, hauntedQuarterScoring } from "./haunted-quarter.ts";
import { imperialTreasury, imperialTreasuryScoring } from "./imperial-treasury.ts";
import { ivoryTower, ivoryTowerScoring } from "./ivory-tower.ts";
import { keep, keepScoring } from "./keep.ts";
import { laboratory, laboratoryScoring } from "./laboratory.ts";
import { library, libraryScoring } from "./library.ts";
import { mapRoom, mapRoomScoring } from "./map-room.ts";
import { monument, monumentScoring } from "./monument.ts";
import { museum, museumScoring } from "./museum.ts";
import { necropolis, necropolisScoring } from "./necropolis.ts";
import { observatory, observatoryScoring } from "./observatory.ts";
import { park, parkScoring } from "./park.ts";
import { poorHouse, poorHouseScoring } from "./poor-house.ts";
import { quarry, quarryScoring } from "./quarry.ts";
import { schoolOfMagic, schoolOfMagicScoring } from "./school-of-magic.ts";
import { secretVault, secretVaultScoring } from "./secret-vault.ts";
import { smithy, smithyScoring } from "./smithy.ts";
import { stables, stablesScoring } from "./stables.ts";
import { statue, statueScoring } from "./statue.ts";
import { theater, theaterScoring } from "./theater.ts";
import { thievesDen, thievesDenScoring } from "./thieves-den.ts";
import { wishingWell, wishingWellScoring } from "./wishing-well.ts";

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
 * The engine trigger each unique district responds to. A district that acts on
 * income, a build, the end of a turn, scoring, or a destroy declares it in its
 * own file and lists it here; empty means the engine never calls the effect.
 */
export const UNIQUE_TRIGGERS: Record<DistrictId, readonly DistrictHook[]> = {
  armory: [],
  basilica: [],
  capitol: [],
  "dragon-gate": [],
  factory: [],
  framework: [],
  "gold-mine": [],
  "great-wall": [],
  "haunted-quarter": [],
  "imperial-treasury": [],
  "ivory-tower": [],
  keep: [],
  laboratory: [],
  library: [],
  "map-room": [],
  monument: [],
  museum: [],
  necropolis: [],
  observatory: [],
  park: [],
  "poor-house": [],
  quarry: [],
  "school-of-magic": [],
  "secret-vault": [],
  smithy: [],
  stables: [],
  statue: [],
  theater: [],
  "thieves-den": [],
  "wishing-well": [],
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

/** Every unique district id, in catalog order. */
export const UNIQUE_IDS: readonly DistrictId[] = UNIQUE_DISTRICTS.map((spec) => spec.id);
