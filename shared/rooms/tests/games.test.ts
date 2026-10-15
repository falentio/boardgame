import { expect, test } from "vitest";
import { BASE_CAST } from "../../core/lockstep/games/citadels/characters.ts";
import { STARTER_ROLES } from "../../core/lockstep/games/g54/roles.ts";
import {
  ROOM_GAMES,
  assertNever,
  boundsFor,
  defaultSetupFor,
  isGameKind,
  parseRoomSetup,
  validateRoomSetup,
  type GameKind,
  type RoomSetup,
} from "../games.ts";

const KINDS: readonly GameKind[] = ["g54", "citadels"];

test("boundsFor gives each game its own seat window", () => {
  expect(boundsFor("g54")).toEqual({ min: 2, max: 7 });
  expect(boundsFor("citadels")).toEqual({ min: 2, max: 8 });
  expect(ROOM_GAMES.g54.seats).toEqual({ min: 2, max: 7 });
  expect(ROOM_GAMES.citadels.seats).toEqual({ min: 2, max: 8 });
});

test("defaultSetupFor opens a legal room for every game", () => {
  expect(defaultSetupFor("g54")).toEqual({ game: "g54", roles: STARTER_ROLES });
  expect(defaultSetupFor("citadels")).toEqual({ game: "citadels", cast: BASE_CAST });
  for (const kind of KINDS) {
    const setup = defaultSetupFor(kind);
    expect(validateRoomSetup(setup)).toBeNull();
    expect(parseRoomSetup(setup)).toEqual(setup);
  }
});

test("defaultSetupFor round-trips through parseRoomSetup", () => {
  for (const kind of KINDS) {
    const setup = defaultSetupFor(kind);
    expect(parseRoomSetup(JSON.parse(JSON.stringify(setup)))).toEqual(setup);
  }
});

test("isGameKind accepts the two kinds and rejects anything else", () => {
  expect(isGameKind("g54")).toBe(true);
  expect(isGameKind("citadels")).toBe(true);
  expect(isGameKind("chess")).toBe(false);
  expect(isGameKind("")).toBe(false);
  expect(isGameKind("G54")).toBe(false);
});

test("each game's parseSetup rejects a payload of the wrong shape", () => {
  expect(ROOM_GAMES.g54.parseSetup({ roles: ["banker"] })).toEqual({ roles: ["banker"] });
  expect(ROOM_GAMES.g54.parseSetup({ roles: "banker" })).toBeNull();
  expect(ROOM_GAMES.g54.parseSetup({ roles: ["not-a-role"] })).toBeNull();
  expect(ROOM_GAMES.g54.parseSetup({ roles: [], socialMedia: "yes" })).toBeNull();
  expect(ROOM_GAMES.g54.parseSetup(null)).toBeNull();

  expect(ROOM_GAMES.citadels.parseSetup({ cast: BASE_CAST })).toEqual({ cast: BASE_CAST });
  expect(ROOM_GAMES.citadels.parseSetup({ cast: "assassin" })).toBeNull();
  expect(ROOM_GAMES.citadels.parseSetup({ cast: ["not-a-character"] })).toBeNull();
  expect(ROOM_GAMES.citadels.parseSetup({ cast: BASE_CAST, uniques: [1] })).toBeNull();
  expect(ROOM_GAMES.citadels.parseSetup(undefined)).toBeNull();
});

test("each game's validateSetup returns a reason for an illegal setup", () => {
  expect(ROOM_GAMES.g54.validateSetup({ roles: STARTER_ROLES })).toBeNull();
  expect(ROOM_GAMES.g54.validateSetup({ roles: ["banker"] })).toEqual(expect.any(String));

  expect(ROOM_GAMES.citadels.validateSetup({ cast: BASE_CAST })).toBeNull();
  expect(ROOM_GAMES.citadels.validateSetup({ cast: ["assassin"] })).toEqual(expect.any(String));
});

test("parseRoomSetup rejects a tagless payload and an unknown game", () => {
  expect(parseRoomSetup({ game: "chess", roles: STARTER_ROLES })).toBeNull();
  expect(parseRoomSetup({ roles: STARTER_ROLES })).toBeNull();
  expect(parseRoomSetup({ cast: BASE_CAST })).toBeNull();
  expect(parseRoomSetup(null)).toBeNull();
  expect(parseRoomSetup("g54")).toBeNull();
});

test("parseRoomSetup rejects a setup whose payload does not match its tag", () => {
  expect(parseRoomSetup({ game: "citadels", roles: STARTER_ROLES })).toBeNull();
  expect(parseRoomSetup({ game: "g54", cast: BASE_CAST })).toBeNull();
  expect(parseRoomSetup({ game: "g54", roles: ["not-a-role"] })).toBeNull();
  expect(parseRoomSetup({ game: "citadels", cast: ["not-a-character"] })).toBeNull();
});

test("parseRoomSetup tags each arm and round-trips it", () => {
  const g54: RoomSetup = { game: "g54", roles: STARTER_ROLES };
  const citadels: RoomSetup = { game: "citadels", cast: BASE_CAST };
  expect(parseRoomSetup(g54)).toEqual(g54);
  expect(parseRoomSetup(citadels)).toEqual(citadels);
  expect(parseRoomSetup(g54)?.game).toBe("g54");
  expect(parseRoomSetup(citadels)?.game).toBe("citadels");
});

test("validateRoomSetup rejects an illegal setup per game and accepts a legal one", () => {
  expect(validateRoomSetup({ game: "g54", roles: STARTER_ROLES })).toBeNull();
  expect(validateRoomSetup({ game: "g54", roles: ["banker"] })).toEqual(expect.any(String));
  expect(validateRoomSetup({ game: "citadels", cast: BASE_CAST })).toBeNull();
  expect(validateRoomSetup({ game: "citadels", cast: ["assassin"] })).toEqual(expect.any(String));
});

test("assertNever throws when an unhandled variant reaches it", () => {
  expect(() => assertNever("chess" as never)).toThrow(/unhandled variant/);
});
