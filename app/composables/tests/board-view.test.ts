import { expect, test } from "vitest";
import {
  act,
  frameIndex,
  genesisSeed,
  makeRandom,
  makeRoster,
  type Frame,
} from "#shared/core/lockstep/index.ts";
import { g54, type G54Action, type G54View } from "#shared/core/lockstep/games/g54/index.ts";
import { seatId, type SeatId } from "#shared/rooms/ids.ts";
import { boardOf, type SeatIdentity } from "../board-view.ts";

const ANN = seatId("ann");
const BOB = seatId("bob");
const CARA = seatId("cara");
const SEATS = [ANN, BOB, CARA];
const ROLES = ["banker", "director", "guerrilla", "politician", "peacekeeper"] as const;
const SEED = genesisSeed("board-view-tests");

const genesis = () =>
  g54.genesis({ roles: [...ROLES] }, makeRoster(SEATS), makeRandom(SEED));

const view = (): G54View => g54.project(genesis(), ANN);

/** Fold one frame where only ANN acts, opening a window the whole table owes. */
const afterAnnClaimsBanker = (): G54View => {
  const frame: Frame<G54Action> = {
    index: frameIndex(0),
    seed: SEED,
    inputs: [[ANN, act<G54Action>({ t: "claim", role: "banker", target: null })]],
  };
  return g54.project(g54.step(genesis(), frame, makeRandom(SEED)), ANN);
};

const identities = (): ReadonlyMap<SeatId, SeatIdentity> =>
  new Map([
    [ANN, { name: "Ada", image: "https://example.test/ada.png" }],
    [BOB, { name: "Bo", image: null }],
    [CARA, { name: "Cy", image: null }],
  ]);

test("boardOf maps one row per player in roster order", () => {
  const board = boardOf(view(), identities());
  expect(board.seats.map((seat) => seat.seat)).toEqual(SEATS);
  expect(board.seats.map((seat) => seat.name)).toEqual(["Ada", "Bo", "Cy"]);
});

test("the viewer's hand is face-up and every rival's is face-down", () => {
  const projected = view();
  const board = boardOf(projected, identities());
  const mine = board.seats.find((seat) => seat.seat === ANN);
  const rival = board.seats.find((seat) => seat.seat === BOB);
  expect(mine?.hand).toEqual(projected.myHand);
  expect(mine?.handCount).toBe(0);
  expect(rival?.hand).toEqual([]);
  expect(rival?.handCount).toBe(projected.players.find((p) => p.seat === BOB)?.handCount);
});

test("the viewer's seat is flagged and the first turn seat is acting", () => {
  const board = boardOf(view(), identities());
  expect(board.seats.find((seat) => seat.seat === ANN)?.isMe).toBe(true);
  expect(board.seats.filter((seat) => seat.isMe)).toHaveLength(1);
  expect(board.seats.find((seat) => seat.seat === ANN)?.phase).toBe("acting");
});

test("a non-active seat the open window waits on reads as owing input", () => {
  const projected = afterAnnClaimsBanker();
  expect(projected.owedSeats).toContain(BOB);
  expect(projected.owedSeats).toContain(CARA);
  const board = boardOf(projected, identities());
  expect(board.seats.find((seat) => seat.seat === BOB)?.phase).toBe("owed");
  expect(board.seats.find((seat) => seat.seat === CARA)?.phase).toBe("owed");
});

test("the table carries the public counts and roles", () => {
  const projected = view();
  const board = boardOf(projected, identities());
  expect(board.table.roles).toEqual(projected.roles);
  expect(board.table.treasury).toBe(projected.treasury);
  expect(board.table.courtCount).toBe(projected.courtCount);
  expect(board.table.turn).toBe(projected.turn);
  expect(board.table.terminal).toBe(false);
  expect(board.table.pending).toBeNull();
});

test("a pending claim names the claimant, role, and target", () => {
  const board = boardOf(afterAnnClaimsBanker(), identities());
  expect(board.table.pending).toBe("Ada claims Banker");
});

test("a missing identity falls back to the seat id rather than dropping the row", () => {
  const board = boardOf(view(), new Map());
  expect(board.seats.map((seat) => seat.name)).toEqual([ANN, BOB, CARA]);
});
