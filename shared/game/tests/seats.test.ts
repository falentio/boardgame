import { expect, test } from "vitest";
import { genesisSeed, seatId } from "../../core/lockstep/index.ts";
import { BASE_CAST } from "../../core/lockstep/games/citadels/characters.ts";
import { STARTER_ROLES } from "../../core/lockstep/games/g54/roles.ts";
import { roomCode, userId } from "../../rooms/ids.ts";
import { genesisFor, occupantOf, rosterFor, seatOf, type RoomSeatLike } from "../seats.ts";

const ANN = userId("ann");
const BOB = userId("bob");

const SEATS: readonly RoomSeatLike[] = [
  { id: "room-1:seat:0", occupant: ANN },
  { id: "room-1:seat:1", occupant: null },
  { id: "room-1:seat:2", occupant: BOB },
];

test("roster is the occupied seats in room order", () => {
  const roster = rosterFor(SEATS);
  expect(roster.order).toEqual([seatId("room-1:seat:0"), seatId("room-1:seat:2")]);
});

test("seatOf maps a viewer to their seat, and null for a spectator", () => {
  expect(seatOf(SEATS, ANN)).toBe(seatId("room-1:seat:0"));
  expect(seatOf(SEATS, BOB)).toBe(seatId("room-1:seat:2"));
  expect(seatOf(SEATS, userId("cara"))).toBeNull();
});

test("occupantOf is the inverse of seatOf, and null for an empty or unknown seat", () => {
  expect(occupantOf(SEATS, seatId("room-1:seat:0"))).toBe(ANN);
  expect(occupantOf(SEATS, seatId("room-1:seat:2"))).toBe(BOB);
  expect(occupantOf(SEATS, seatId("room-1:seat:1"))).toBeNull();
  expect(occupantOf(SEATS, seatId("room-1:seat:9"))).toBeNull();
});

test("genesisFor seeds from the room code and carries the g54 setup", () => {
  const code = roomCode("BAWOLUTI");
  const genesis = genesisFor({
    code,
    setup: { game: "g54", roles: STARTER_ROLES },
    seats: SEATS,
    startedAt: null,
  });
  expect(genesis.seed).toBe(genesisSeed(code));
  expect(genesis.roster.order).toEqual([seatId("room-1:seat:0"), seatId("room-1:seat:2")]);
  expect(genesis.setup.game).toBe("g54");
  expect(genesis.setup.roles).toEqual([...STARTER_ROLES]);
});

test("genesisFor carries a citadels cast", () => {
  const code = roomCode("BAWOLUTI");
  const genesis = genesisFor({
    code,
    setup: { game: "citadels", cast: BASE_CAST },
    seats: SEATS,
    startedAt: null,
  });
  expect(genesis.seed).toBe(genesisSeed(code));
  expect(genesis.setup.game).toBe("citadels");
  expect(genesis.setup.cast).toEqual([...BASE_CAST]);
});
