import { G54Error } from "../core/lockstep/games/g54/error.ts";
import { STARTER_ROLES, isRoleId, type RoleId } from "../core/lockstep/games/g54/roles.ts";
import { validateRoles, type G54Setup } from "../core/lockstep/games/g54/setup.ts";
import {
  BASE_CAST,
  isCharacterId,
  type CharacterId,
} from "../core/lockstep/games/citadels/characters.ts";
import { isDistrictId, type DistrictId } from "../core/lockstep/games/citadels/districts.ts";
import { CitadelsError } from "../core/lockstep/games/citadels/error.ts";
import { validateCast, type CitadelsSetup } from "../core/lockstep/games/citadels/setup.ts";

export type GameKind = "g54" | "citadels";

type SetupOf = { g54: G54Setup; citadels: CitadelsSetup };

/** A room's game kind is the `game` tag inside its setup. */
export type RoomSetup = { readonly [K in GameKind]: { readonly game: K } & SetupOf[K] }[GameKind];

export interface SeatBounds {
  readonly min: number;
  readonly max: number;
}

export interface RoomGame<Setup> {
  readonly seats: SeatBounds;
  readonly defaultSetup: () => Setup;
  readonly parseSetup: (raw: unknown) => Setup | null;
  readonly validateSetup: (setup: Setup) => string | null;
}

const fieldOf = (source: unknown, key: string): unknown =>
  typeof source === "object" && source !== null
    ? (source as Record<string, unknown>)[key]
    : undefined;

const parseG54Setup = (raw: unknown): G54Setup | null => {
  const roles = fieldOf(raw, "roles");
  if (!Array.isArray(roles)) return null;
  const parsed: RoleId[] = [];
  for (const role of roles) {
    if (typeof role !== "string" || !isRoleId(role)) return null;
    parsed.push(role);
  }
  const socialMedia = fieldOf(raw, "socialMedia");
  if (socialMedia !== undefined && typeof socialMedia !== "boolean") return null;
  return socialMedia === undefined ? { roles: parsed } : { roles: parsed, socialMedia };
};

const validateG54Setup = (setup: G54Setup): string | null => {
  try {
    validateRoles(setup.roles);
    return null;
  } catch (error) {
    if (!(error instanceof G54Error)) throw error;
    return error.message;
  }
};

const parseCitadelsSetup = (raw: unknown): CitadelsSetup | null => {
  const cast = fieldOf(raw, "cast");
  if (!Array.isArray(cast)) return null;
  const parsed: CharacterId[] = [];
  for (const character of cast) {
    if (typeof character !== "string" || !isCharacterId(character)) return null;
    parsed.push(character);
  }
  const uniques = fieldOf(raw, "uniques");
  if (uniques === undefined) return { cast: parsed };
  if (!Array.isArray(uniques)) return null;
  const districts: DistrictId[] = [];
  for (const district of uniques) {
    if (typeof district !== "string" || !isDistrictId(district)) return null;
    districts.push(district);
  }
  return { cast: parsed, uniques: districts };
};

const validateCitadelsSetup = (setup: CitadelsSetup): string | null => {
  try {
    validateCast(setup.cast);
    return null;
  } catch (error) {
    if (!(error instanceof CitadelsError)) throw error;
    return error.message;
  }
};

export const ROOM_GAMES = {
  g54: {
    seats: { min: 2, max: 7 },
    defaultSetup: () => ({ roles: STARTER_ROLES }),
    parseSetup: parseG54Setup,
    validateSetup: validateG54Setup,
  },
  citadels: {
    seats: { min: 2, max: 8 },
    defaultSetup: () => ({ cast: BASE_CAST }),
    parseSetup: parseCitadelsSetup,
    validateSetup: validateCitadelsSetup,
  },
} satisfies { readonly [K in GameKind]: RoomGame<SetupOf[K]> };

export const assertNever = (value: never): never => {
  throw new Error(`unhandled variant: ${String(value)}`);
};

export const isGameKind = (value: string): value is GameKind => Object.hasOwn(ROOM_GAMES, value);

export const boundsFor = (kind: GameKind): SeatBounds => ROOM_GAMES[kind].seats;

export const defaultSetupFor = (kind: GameKind): RoomSetup => {
  switch (kind) {
    case "g54":
      return { game: "g54", ...ROOM_GAMES.g54.defaultSetup() };
    case "citadels":
      return { game: "citadels", ...ROOM_GAMES.citadels.defaultSetup() };
    default:
      return assertNever(kind);
  }
};

export const validateRoomSetup = (setup: RoomSetup): string | null => {
  switch (setup.game) {
    case "g54":
      return ROOM_GAMES.g54.validateSetup(setup);
    case "citadels":
      return ROOM_GAMES.citadels.validateSetup(setup);
    default:
      return assertNever(setup);
  }
};

export const parseRoomSetup = (raw: unknown): RoomSetup | null => {
  const game = fieldOf(raw, "game");
  if (typeof game !== "string" || !isGameKind(game)) return null;
  switch (game) {
    case "g54": {
      const setup = ROOM_GAMES.g54.parseSetup(raw);
      return setup === null ? null : { game: "g54", ...setup };
    }
    case "citadels": {
      const setup = ROOM_GAMES.citadels.parseSetup(raw);
      return setup === null ? null : { game: "citadels", ...setup };
    }
    default:
      return assertNever(game);
  }
};
