import { expect, test } from "vitest";
import type { SeatId } from "../../../../index.ts";
import { merchant } from "../../../../lockstep/games/citadels/characters/merchant.ts";
import type { CitadelsState } from "../../../../lockstep/games/citadels/state.ts";
import {
  ANN,
  BASE_CAST_IDS,
  SEATS3,
  rawGenesis,
  rawGold,
  rawHand,
  rawRandom,
  withGold,
  withHand,
} from "../driver.ts";

const MERCHANT_CAST = BASE_CAST_IDS;

const withCity = (state: CitadelsState, seat: SeatId, ids: readonly string[]): CitadelsState => ({
  ...state,
  players: state.players.map((player) =>
    player.seat === seat ? { ...player, city: ids.map((id) => ({ id, gold: 0 })) } : player,
  ),
});

const merchantState = (): CitadelsState => ({
  ...rawGenesis(SEATS3, MERCHANT_CAST),
  claimed: [{ seat: ANN, character: "merchant" }],
});

const ctxFor = (state: CitadelsState) => ({ state, seat: ANN, rest: [], rng: rawRandom() });

const gain = (state: CitadelsState): number =>
  rawGold(merchant(ctxFor(state)), ANN) - rawGold(state, ANN);

test("gain 1 gold per trade district in your city", () => {
  const none = withCity(merchantState(), ANN, ["manor"]);
  const one = withCity(merchantState(), ANN, ["tavern", "manor"]);
  const two = withCity(merchantState(), ANN, ["tavern", "market", "manor"]);
  // Each trade district adds exactly 1 gold over the previous city.
  expect(gain(one) - gain(none)).toBe(1);
  expect(gain(two) - gain(one)).toBe(1);
});

test("plus 1 extra gold", () => {
  const state = withCity(merchantState(), ANN, ["manor", "castle"]);
  expect(gain(state)).toBe(1);
});

test("usable regardless of which resource you gathered this turn", () => {
  const city = ["tavern", "market", "docks"];
  const gatheredGold = withGold(withCity(merchantState(), ANN, city), ANN, 7);
  const drewCards = withHand(withCity(merchantState(), ANN, city), ANN, [
    "tavern",
    "market",
    "docks",
    "harbor",
    "temple",
    "church",
  ]);
  expect(gain(gatheredGold)).toBe(4);
  expect(gain(drewCards)).toBe(4);
  expect(gain(gatheredGold)).toBe(gain(drewCards));
});

test("a killed Merchant takes no income", () => {
  const state = {
    ...withCity(merchantState(), ANN, ["tavern", "market"]),
    skipped: ["merchant"],
  };
  expect(rawGold(merchant(ctxFor(state)), ANN)).toBe(rawGold(state, ANN));
});

test("a bewitched Merchant's income belongs to the Witch, not the Merchant", () => {
  const state = {
    ...withCity(merchantState(), ANN, ["tavern", "market"]),
    bewitched: "merchant",
  };
  expect(rawGold(merchant(ctxFor(state)), ANN)).toBe(rawGold(state, ANN));
  expect(rawHand(merchant(ctxFor(state)), ANN)).toEqual(rawHand(state, ANN));
});

test("the ability is not a no-op: it raises the Merchant's gold", () => {
  const state = withCity(merchantState(), ANN, ["tavern", "market"]);
  const next = merchant(ctxFor(state));
  expect(rawGold(next, ANN)).toBeGreaterThan(rawGold(state, ANN));
});
