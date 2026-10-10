import { expect, test } from "vitest";
import { trader } from "../../../../lockstep/games/citadels/characters/trader.ts";
import type { CitadelsState, Step } from "../../../../lockstep/games/citadels/state.ts";
import {
  ANN,
  BASE_CAST_IDS,
  SEATS3,
  advance,
  openPurpose,
  rawGenesis,
  rawGold,
  rawPlayer,
  rawRandom,
  withGold,
  withHand,
} from "../driver.ts";

const TRADER_CAST = BASE_CAST_IDS;

const withCity = (state: CitadelsState, ids: readonly string[]): CitadelsState => ({
  ...state,
  players: state.players.map((player) =>
    player.seat === ANN ? { ...player, city: ids.map((id) => ({ id, gold: 0 })) } : player,
  ),
});

const traderState = (): CitadelsState => ({
  ...rawGenesis(SEATS3, TRADER_CAST),
  claimed: [{ seat: ANN, character: "trader" }],
});

/** The Trader's own turn window: the limit build its extra window must not consume. */
const OWN_TURN: Step = { kind: "window", window: { kind: "turn", purpose: "turn", seats: [ANN] } };

const openTrader = (state: CitadelsState, rest: readonly Step[] = []): CitadelsState =>
  trader({ state, seat: ANN, rest, rng: rawRandom() });

const purposes = (state: CitadelsState): readonly string[] =>
  state.steps.flatMap((step) => (step.kind === "window" ? [step.window.purpose] : []));

const build = (state: CitadelsState, card: number): CitadelsState =>
  advance(state, () => ({ t: "build", card }));

const pass = (state: CitadelsState): CitadelsState => advance(state, () => null);

test("gain 1 gold per trade district in your city", () => {
  const state = withCity(traderState(), ["tavern", "market", "manor"]);
  const next = openTrader(state);
  expect(rawGold(next, ANN)).toBe(rawGold(state, ANN) + 2);
});

test("trade districts do not count toward your building limit: you may build any number of them", () => {
  const armed = withHand(
    withGold(withCity(traderState(), []), ANN, 20),
    ANN,
    ["tavern", "market", "docks", "harbor"],
  );
  let state = openTrader(armed, [OWN_TURN]);
  expect(openPurpose(state)).toBe("trader-build");
  state = build(state, 0);
  state = build(state, 0);
  state = build(state, 0);
  expect(rawPlayer(state, ANN).city.map((district) => district.id)).toEqual([
    "tavern",
    "market",
    "docks",
  ]);
  // The extra-build window is still open for more trade districts.
  expect(openPurpose(state)).toBe("trader-build");
  state = pass(state);
  expect(openPurpose(state)).not.toBe("trader-build");
});

test("the extra trade builds are in addition to your limit: the turn window stays open below", () => {
  const state = openTrader(withCity(traderState(), []), [OWN_TURN]);
  expect(purposes(state)).toContain("trader-build");
  expect(purposes(state)).toContain("turn");
  expect(purposes(state).indexOf("trader-build")).toBeLessThan(purposes(state).indexOf("turn"));
});

test("the trader-build window admits only trade districts", () => {
  const armed = withHand(withGold(withCity(traderState(), []), ANN, 20), ANN, ["manor"]);
  const after = build(openTrader(armed, [OWN_TURN]), 0);
  expect(rawPlayer(after, ANN).city).toHaveLength(0);
  expect(openPurpose(after)).toBe("turn");
});

test("a trade district you cannot afford is not built and closes the window", () => {
  const armed = withHand(withGold(withCity(traderState(), []), ANN, 0), ANN, ["harbor"]);
  const after = build(openTrader(armed, [OWN_TURN]), 0);
  expect(rawPlayer(after, ANN).city).toHaveLength(0);
  expect(openPurpose(after)).toBe("turn");
});

test("a killed Trader takes no income and opens no window", () => {
  const state = { ...withCity(traderState(), ["tavern", "market"]), skipped: ["trader"] };
  const next = openTrader(state);
  expect(rawGold(next, ANN)).toBe(rawGold(state, ANN));
  expect(openPurpose(next)).toBeNull();
});

test("the ability is not a no-op: it raises gold and opens the extra-build window", () => {
  const state = withCity(traderState(), ["tavern", "market"]);
  const next = openTrader(state);
  expect(rawGold(next, ANN)).toBeGreaterThan(rawGold(state, ANN));
  expect(openPurpose(next)).toBe("trader-build");
});
