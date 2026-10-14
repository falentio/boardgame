import { expect, test } from "vitest";
import { act, idle, type SeatId } from "../../../../index.ts";
import type { CharacterId } from "../../../../lockstep/games/citadels/characters.ts";
import {
  taxCollector,
  taxCollectorResolve,
} from "../../../../lockstep/games/citadels/characters/tax-collector.ts";
import { specOfDistrict } from "../../../../lockstep/games/citadels/districts.ts";
import { applyEndRound, tryBuild } from "../../../../lockstep/games/citadels/helpers.ts";
import type {
  CitadelsState,
  Claim,
  Window,
} from "../../../../lockstep/games/citadels/state.ts";
import type { CitadelsAction } from "../../../../lockstep/games/citadels/index.ts";
import {
  ANN,
  BASE_CAST_IDS,
  BOB,
  SEATS3,
  rawFrame,
  rawGenesis,
  rawGold,
  rawPlayer,
  rawRandom,
  withGold,
} from "../driver.ts";

const TAX_CAST: readonly CharacterId[] = [...BASE_CAST_IDS, "tax-collector"];

/** A turn-phase state: the draft is over and the rank cursor is armed. */
const turnState = (claimed: readonly Claim[]): CitadelsState => ({
  ...rawGenesis(SEATS3, TAX_CAST),
  phase: "turn",
  draft: null,
  claimed,
  callRank: 1,
  active: ANN,
  steps: [{ kind: "call" }, { kind: "end-round" }],
});

const topWindow = (state: CitadelsState): Window => {
  const top = state.steps[0];
  if (top === undefined || top.kind !== "window") throw new Error("no open window");
  return top.window;
};

const ctxFor = (state: CitadelsState) => ({ state, seat: ANN, rest: [], rng: rawRandom() });

const resolve = (state: CitadelsState, action: CitadelsAction | null): CitadelsState =>
  taxCollectorResolve({
    state,
    window: topWindow(state),
    frame: rawFrame(0, [[ANN, action === null ? idle<CitadelsAction>() : act(action)]]),
    rng: rawRandom(),
  });

/** The first hand card the seat can afford, with its cost. */
const firstAffordable = (
  state: CitadelsState,
  seat: SeatId,
): { readonly index: number; readonly cost: number } => {
  const player = rawPlayer(state, seat);
  for (let index = 0; index < player.hand.length; index += 1) {
    const id = player.hand[index];
    if (id === undefined) continue;
    const cost = specOfDistrict(id).cost;
    if (cost <= player.gold) return { index, cost };
  }
  throw new Error("no affordable card in hand");
};

test("immediately after any player builds a district they place one gold on the Tax Collector's token", () => {
  const claimed: readonly Claim[] = [{ seat: BOB, character: "tax-collector" }];
  const state = withGold(turnState(claimed), ANN, 20);
  const { index, cost } = firstAffordable(state, ANN);
  const next = tryBuild(state, ANN, index, rawRandom());
  expect(next.taxPot).toBe(1);
  expect(rawGold(next, ANN)).toBe(20 - cost - 1);
});

test("a player with no gold left after building pays nothing", () => {
  const armed = turnState([]);
  const probe = withGold(armed, ANN, 20);
  const { index, cost } = firstAffordable(probe, ANN);
  const state = withGold(armed, ANN, cost);
  const next = tryBuild(state, ANN, index, rawRandom());
  expect(next.taxPot).toBe(0);
  expect(rawGold(next, ANN)).toBe(0);
});

test("the Tax Collector pays no tax when it builds", () => {
  const claimed: readonly Claim[] = [{ seat: ANN, character: "tax-collector" }];
  const state = withGold(turnState(claimed), ANN, 20);
  const { index, cost } = firstAffordable(state, ANN);
  const next = tryBuild(state, ANN, index, rawRandom());
  expect(next.taxPot).toBe(0);
  expect(rawGold(next, ANN)).toBe(20 - cost);
});

test("at any time during your turn you may take all gold from the token", () => {
  const state: CitadelsState = {
    ...withGold(turnState([]), ANN, 3),
    taxPot: 4,
    claimed: [{ seat: ANN, character: "tax-collector" }],
  };
  const opened = taxCollector(ctxFor(state));
  expect(opened.steps[0]).toMatchObject({ kind: "window", window: { purpose: "tax-collect" } });
  const taken = resolve(opened, { t: "choose", value: "take" });
  expect(rawGold(taken, ANN)).toBe(3 + 4);
  expect(taken.taxPot).toBe(0);
  expect(taken.steps).toHaveLength(0);
});

test("you may pass and leave the token for a later turn", () => {
  const state: CitadelsState = { ...turnState([]), taxPot: 2 };
  const next = resolve(taxCollector(ctxFor(state)), { t: "pass" });
  expect(next.taxPot).toBe(2);
  expect(rawGold(next, ANN)).toBe(rawGold(state, ANN));
});

test("the tax is charged even in rounds where the Tax Collector is not in play", () => {
  // The Tax Collector is in the cast but claimed by nobody this round (discarded).
  const state = withGold(turnState([]), ANN, 20);
  expect(state.claimed.some((claim) => claim.character === "tax-collector")).toBe(false);
  const { index } = firstAffordable(state, ANN);
  const next = tryBuild(state, ANN, index, rawRandom());
  expect(next.taxPot).toBe(1);
});

test("leftover gold carries over between rounds", () => {
  const state: CitadelsState = { ...turnState([]), taxPot: 5, steps: [{ kind: "end-round" }] };
  const next = applyEndRound(state, rawRandom());
  expect(next.taxPot).toBe(5);
  expect(next.phase).toBe("draft");
});

test("the ability is not a no-op: taking the token moves its gold into your stash", () => {
  const state: CitadelsState = {
    ...turnState([]),
    taxPot: 3,
    claimed: [{ seat: ANN, character: "tax-collector" }],
  };
  const before = rawGold(state, ANN);
  const next = resolve(taxCollector(ctxFor(state)), { t: "gold" });
  expect(rawGold(next, ANN)).toBe(before + 3);
  expect(next.taxPot).toBe(0);
});
