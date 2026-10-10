import type { Random, SeatId } from "../../../index.ts";
import { UNIQUE_DISTRICTS, type DistrictHook, type DistrictId } from "../districts.ts";
import type { CitadelsState, PlacedDistrict, Step } from "../state.ts";
import { keep, keepScoring } from "./keep.ts";
import { laboratory, laboratoryScoring } from "./laboratory.ts";
import { smithy, smithyScoring } from "./smithy.ts";
import { graveyard, graveyardScoring } from "./graveyard.ts";
import { library, libraryScoring } from "./library.ts";
import { schoolOfMagic, schoolOfMagicScoring } from "./school-of-magic.ts";
import { dragonGate, dragonGateScoring } from "./dragon-gate.ts";
import { university, universityScoring } from "./university.ts";
import { observatory, observatoryScoring } from "./observatory.ts";
import { greatWall, greatWallScoring } from "./great-wall.ts";
import { imperialTreasury, imperialTreasuryScoring } from "./imperial-treasury.ts";
import { wharf, wharfScoring } from "./wharf.ts";
import { thievesDen, thievesDenScoring } from "./thieves-den.ts";
import { bellTower, bellTowerScoring } from "./bell-tower.ts";
import { factory, factoryScoring } from "./factory.ts";
import { museum, museumScoring } from "./museum.ts";
import { park, parkScoring } from "./park.ts";
import { poorHouse, poorHouseScoring } from "./poor-house.ts";
import { statue, statueScoring } from "./statue.ts";
import { theatre, theatreScoring } from "./theatre.ts";
import { hauntedQuarter, hauntedQuarterScoring } from "./haunted-quarter.ts";
import { wishingWell, wishingWellScoring } from "./wishing-well.ts";
import { ivoryTower, ivoryTowerScoring } from "./ivory-tower.ts";
import { quarry, quarryScoring } from "./quarry.ts";
import { ballroom, ballroomScoring } from "./ballroom.ts";
import { triumphalArch, triumphalArchScoring } from "./triumphal-arch.ts";
import { clockTower, clockTowerScoring } from "./clock-tower.ts";
import { menagerie, menagerieScoring } from "./menagerie.ts";
import { cathedral, cathedralScoring } from "./cathedral.ts";
import { scriptorium, scriptoriumScoring } from "./scriptorium.ts";

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
  keep: keep,
  laboratory: laboratory,
  smithy: smithy,
  graveyard: graveyard,
  library: library,
  "school-of-magic": schoolOfMagic,
  "dragon-gate": dragonGate,
  university: university,
  observatory: observatory,
  "great-wall": greatWall,
  "imperial-treasury": imperialTreasury,
  wharf: wharf,
  "thieves-den": thievesDen,
  "bell-tower": bellTower,
  factory: factory,
  museum: museum,
  park: park,
  "poor-house": poorHouse,
  statue: statue,
  theatre: theatre,
  "haunted-quarter": hauntedQuarter,
  "wishing-well": wishingWell,
  "ivory-tower": ivoryTower,
  quarry: quarry,
  ballroom: ballroom,
  "triumphal-arch": triumphalArch,
  "clock-tower": clockTower,
  menagerie: menagerie,
  cathedral: cathedral,
  scriptorium: scriptorium,
};

/**
 * The engine trigger each unique district responds to. A district that acts on
 * income, a build, the end of a turn, scoring, or a destroy declares it in its
 * own file and lists it here; empty means the engine never calls the effect.
 */
export const UNIQUE_TRIGGERS: Record<DistrictId, readonly DistrictHook[]> = {
  keep: [],
  laboratory: [],
  smithy: [],
  graveyard: [],
  library: [],
  "school-of-magic": [],
  "dragon-gate": [],
  university: [],
  observatory: [],
  "great-wall": [],
  "imperial-treasury": [],
  wharf: [],
  "thieves-den": [],
  "bell-tower": [],
  factory: [],
  museum: [],
  park: [],
  "poor-house": [],
  statue: [],
  theatre: [],
  "haunted-quarter": [],
  "wishing-well": [],
  "ivory-tower": [],
  quarry: [],
  ballroom: [],
  "triumphal-arch": [],
  "clock-tower": [],
  menagerie: [],
  cathedral: [],
  scriptorium: [],
};

/** End-game scoring for every unique; a stub returns zero until its worker fills it. */
export const UNIQUE_SCORING: Record<DistrictId, DistrictScoring> = {
  keep: keepScoring,
  laboratory: laboratoryScoring,
  smithy: smithyScoring,
  graveyard: graveyardScoring,
  library: libraryScoring,
  "school-of-magic": schoolOfMagicScoring,
  "dragon-gate": dragonGateScoring,
  university: universityScoring,
  observatory: observatoryScoring,
  "great-wall": greatWallScoring,
  "imperial-treasury": imperialTreasuryScoring,
  wharf: wharfScoring,
  "thieves-den": thievesDenScoring,
  "bell-tower": bellTowerScoring,
  factory: factoryScoring,
  museum: museumScoring,
  park: parkScoring,
  "poor-house": poorHouseScoring,
  statue: statueScoring,
  theatre: theatreScoring,
  "haunted-quarter": hauntedQuarterScoring,
  "wishing-well": wishingWellScoring,
  "ivory-tower": ivoryTowerScoring,
  quarry: quarryScoring,
  ballroom: ballroomScoring,
  "triumphal-arch": triumphalArchScoring,
  "clock-tower": clockTowerScoring,
  menagerie: menagerieScoring,
  cathedral: cathedralScoring,
  scriptorium: scriptoriumScoring,
};

/** Every unique district id, in catalog order. */
export const UNIQUE_IDS: readonly DistrictId[] = UNIQUE_DISTRICTS.map((spec) => spec.id);
