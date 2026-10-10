import { expect, test } from "vitest";
import { alchemist, alchemistRefund } from "../../../../lockstep/games/citadels/characters/alchemist.ts";
import { specOfDistrict } from "../../../../lockstep/games/citadels/districts.ts";
import { emptyPending, tryBuild, withPending } from "../../../../lockstep/games/citadels/helpers.ts";
import type { CitadelsState } from "../../../../lockstep/games/citadels/state.ts";
import {
  ANN,
  BASE_CAST_IDS,
  SEATS3,
  rawGenesis,
  rawGold,
  rawPlayer,
  rawRandom,
  withGold,
  withHand,
} from "../driver.ts";

const ALCHEMIST_CAST = BASE_CAST_IDS;

const alchemistState = (): CitadelsState => ({
  ...rawGenesis(SEATS3, ALCHEMIST_CAST),
  claimed: [{ seat: ANN, character: "alchemist" }],
});

const ctxFor = (state: CitadelsState) => ({ state, seat: ANN, rest: [], rng: rawRandom() });

/** The turn-local record of gold the seat paid to build districts this turn. */
const withPaidToBuild = (state: CitadelsState, paid: number): CitadelsState =>
  withPending(state, { ...emptyPending(ANN, "alchemist"), gold: paid });

test("at the end of your turn, take back all the gold you paid to build districts this turn", () => {
  const state = withPaidToBuild(withGold(alchemistState(), ANN, 0), 5);
  const next = alchemist(ctxFor(state));
  expect(rawGold(next, ANN)).toBe(5);
  expect(next.pending).toBeNull();
});

test("but not gold paid for other reasons such as the Smithy or the Tax Collector", () => {
  // Two gold already gone to the Smithy, with no build this turn: nothing returns.
  const smithy = withPaidToBuild(withGold(alchemistState(), ANN, 1), 0);
  expect(rawGold(alchemist(ctxFor(smithy)), ANN)).toBe(1);
  // A build spend of three returns exactly three, no more.
  const built = withPaidToBuild(withGold(alchemistState(), ANN, 2), 3);
  expect(rawGold(alchemist(ctxFor(built)), ANN)).toBe(5);
});

test("you can only build what you could afford at the time", () => {
  // One gold cannot buy a five-cost Palace: no build, so no gold to take back.
  const broke = withHand(withGold(alchemistState(), ANN, 1), ANN, ["palace"]);
  const attempt = tryBuild(broke, ANN, 0, rawRandom());
  expect(rawPlayer(attempt, ANN).city).toHaveLength(0);
  expect(rawGold(attempt, ANN)).toBe(1);
  expect(rawGold(alchemist(ctxFor(attempt)), ANN)).toBe(1);

  // Five gold buys the Palace; the five paid come back at end of turn.
  const rich = withHand(withGold(alchemistState(), ANN, 5), ANN, ["palace"]);
  const builtState = tryBuild(rich, ANN, 0, rawRandom());
  const cost = specOfDistrict("palace").cost;
  expect(rawPlayer(builtState, ANN).city).toHaveLength(1);
  expect(rawGold(builtState, ANN)).toBe(5 - cost);
  const refunded = alchemist(ctxFor(withPaidToBuild(builtState, cost)));
  expect(rawGold(refunded, ANN)).toBe(5);
});

test("the ability is not a no-op: it raises the Alchemist's gold", () => {
  const state = withPaidToBuild(withGold(alchemistState(), ANN, 0), 4);
  expect(rawGold(alchemist(ctxFor(state)), ANN)).toBeGreaterThan(rawGold(state, ANN));
});

test("refunding no gold leaves the state untouched", () => {
  const state = withGold(alchemistState(), ANN, 3);
  expect(alchemistRefund(state, ANN, 0)).toBe(state);
});
