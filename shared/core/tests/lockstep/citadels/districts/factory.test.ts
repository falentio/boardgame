import { expect, test } from "vitest";
import type { SeatId } from "../../../../index.ts";
import { specOfDistrict } from "../../../../lockstep/games/citadels/districts.ts";
import { scoreGame } from "../../../../lockstep/games/citadels/scoring.ts";
import type { CitadelsState } from "../../../../lockstep/games/citadels/state.ts";
import {
  ANN,
  BASE_CAST_IDS,
  SEATS3,
  advance,
  rawGenesis,
  rawGold,
  withGold,
  withHand,
} from "../driver.ts";

const withCity = (state: CitadelsState, seat: SeatId, ids: readonly string[]): CitadelsState => ({
  ...state,
  players: state.players.map((player) =>
    player.seat === seat ? { ...player, city: ids.map((id) => ({ id, gold: 0 })) } : player,
  ),
});

/** ANN's turn window is open; ANN holds `hand` and `gold`, and `city` stands built. */
const turnState = (
  city: readonly string[],
  hand: readonly string[],
  gold: number,
): CitadelsState =>
  withGold(
    withHand(
      withCity(
        {
          ...rawGenesis(SEATS3, BASE_CAST_IDS),
          phase: "turn",
          draft: null,
          active: ANN,
          steps: [
            { kind: "window", window: { kind: "turn", purpose: "turn", seats: [ANN] } },
            { kind: "end-round" },
          ],
        },
        ANN,
        city,
      ),
      ANN,
      hand,
    ),
    ANN,
    gold,
  );

/** Build hand card 0 through the real turn window and return the settled state. */
const build = (state: CitadelsState): CitadelsState =>
  advance(state, () => ({ t: "build", card: 0 }));

const cityOf = (state: CitadelsState, seat: SeatId): readonly string[] =>
  (state.players.find((p) => p.seat === seat)?.city ?? []).map((district) => district.id);

test("your other unique districts cost one less gold to build", () => {
  const withFactory = turnState(["factory"], ["dragon-gate"], 10);
  const withoutFactory = turnState([], ["dragon-gate"], 10);
  const paid = rawGold(build(withFactory), ANN);
  const paidWithout = rawGold(build(withoutFactory), ANN);
  // Dragon Gate lists at 6; the Factory brings the net spend down to 5.
  expect(specOfDistrict("dragon-gate").cost).toBe(6);
  // Each turn gathers 2 gold first (commit 64420ca); the Factory then trims 1 off
  // the Dragon Gate's 6.
  expect(paidWithout).toBe(10 + 2 - 6);
  expect(paid).toBe(10 + 2 - 6 + 1);
});

test("the discount applies to each of your other unique districts, not just one", () => {
  for (const id of ["ivory-tower", "gold-mine", "thieves-den"] as const) {
    const cost = specOfDistrict(id).cost;
    const withFactory = turnState(["factory"], [id], 20);
    const withoutFactory = turnState([], [id], 20);
    expect(rawGold(build(withFactory), ANN)).toBe(20 + 2 - cost + 1);
    expect(rawGold(build(withoutFactory), ANN)).toBe(20 + 2 - cost);
    expect(cityOf(build(withFactory), ANN)).toContain(id);
  }
});

test("a basic district is not discounted", () => {
  const state = turnState(["factory"], ["watchtower"], 10);
  const next = build(state);
  // Watchtower lists at 1; the Factory discounts only unique districts. The turn
  // gathered 2 gold first.
  expect(rawGold(next, ANN)).toBe(10 + 2 - specOfDistrict("watchtower").cost);
  expect(cityOf(next, ANN)).toContain("watchtower");
});

test("the Factory does not discount its own build", () => {
  const state = turnState([], ["factory"], 10);
  const next = build(state);
  expect(specOfDistrict("factory").cost).toBe(5);
  // The Factory is the card being built, so no discount; the turn gathered 2.
  expect(rawGold(next, ANN)).toBe(10 + 2 - 5);
  expect(cityOf(next, ANN)).toContain("factory");
});

test("the discount is not a no-op: a Factory in the city saves exactly one gold", () => {
  const withFactory = turnState(["factory"], ["keep"], 20);
  const withoutFactory = turnState([], ["keep"], 20);
  const saved = rawGold(build(withFactory), ANN) - rawGold(build(withoutFactory), ANN);
  expect(saved).toBe(1);
});

test("the Factory scores no extra points on a crafted city", () => {
  const city = [
    { id: "factory", gold: 0 },
    { id: "watchtower", gold: 0 },
  ];
  const state = withCity({ ...rawGenesis(SEATS3, BASE_CAST_IDS), completed: [ANN] }, ANN, [
    "factory",
    "watchtower",
  ]);
  const score = scoreGame(state).find((entry) => entry.seat === ANN);
  // Cost sum only: 5 + 1; the Factory adds nothing at end of game.
  expect(score?.districts).toBe(6);
  expect(score?.unique).toBe(0);
  expect(city).toHaveLength(2);
});
