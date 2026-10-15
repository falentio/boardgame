import { expect, test } from "vitest";
import { idle, type SeatId } from "../../../../index.ts";
import { queen, queenResolve } from "../../../../lockstep/games/citadels/characters/queen.ts";
import type { CharacterId } from "../../../../lockstep/games/citadels/characters.ts";
import type { CitadelsState } from "../../../../lockstep/games/citadels/state.ts";
import {
  ANN,
  BOB,
  CARA,
  DAN,
  EVE,
  SEATS3,
  SEATS4,
  SEATS5,
  rawFrame,
  rawGenesis,
  rawGold,
  rawRandom,
} from "../driver.ts";

const QUEEN_CAST: readonly CharacterId[] = [
  "assassin",
  "thief",
  "magician",
  "king",
  "bishop",
  "merchant",
  "architect",
  "warlord",
  "queen",
];

/** A table where ANN holds the Queen and `kingSeat` holds the rank-4 King. */
const queenState = (seats: readonly SeatId[], kingSeat: SeatId): CitadelsState => ({
  ...rawGenesis(seats, QUEEN_CAST),
  claimed: [
    { seat: kingSeat, character: "king" },
    { seat: ANN, character: "queen" },
  ],
});

const ctxFor = (state: CitadelsState) => ({ state, seat: ANN, rest: [], rng: rawRandom() });

const gain = (state: CitadelsState): number => rawGold(queen(ctxFor(state)), ANN) - rawGold(state, ANN);

test("gain three gold if you sit next to the player who revealed the rank 4 character", () => {
  // In a five-seat ring ANN's neighbours are EVE and BOB, not CARA or DAN.
  expect(gain(queenState(SEATS5, BOB))).toBe(3);
  expect(gain(queenState(SEATS5, EVE))).toBe(3);
  expect(gain(queenState(SEATS5, CARA))).toBe(0);
  expect(gain(queenState(SEATS5, DAN))).toBe(0);
});

test("gain three gold when the killed rank-4 card is revealed at end of round", () => {
  const state: CitadelsState = { ...queenState(SEATS5, BOB), skipped: ["king"] };
  expect(gain(state)).toBe(3);
  // A killed card two seats away still pays nothing.
  const far: CitadelsState = { ...queenState(SEATS5, CARA), skipped: ["king"] };
  expect(gain(far)).toBe(0);
});

test("not usable with fewer than five players", () => {
  expect(gain(queenState(SEATS4, BOB))).toBe(0);
  expect(gain(queenState(SEATS3, BOB))).toBe(0);
});

test("the Queen opens no window and its resolver pops the stack", () => {
  const state: CitadelsState = {
    ...queenState(SEATS5, BOB),
    steps: [
      { kind: "window", window: { kind: "oneOf", purpose: "queen-income", seats: [ANN] } },
      { kind: "end-round" },
    ],
  };
  const top = state.steps[0];
  if (top === undefined || top.kind !== "window") throw new Error("no open window");
  const resolved = queenResolve({
    state,
    window: top.window,
    frame: rawFrame(0, [[ANN, idle()]]),
    rng: rawRandom(),
  });
  expect(resolved.steps).toEqual([{ kind: "end-round" }]);
});

test("the ability is not a no-op: adjacency to the rank-4 holder pays exactly three gold", () => {
  const state = queenState(SEATS5, BOB);
  const next = queen(ctxFor(state));
  expect(rawGold(next, ANN)).toBe(rawGold(state, ANN) + 3);
});
