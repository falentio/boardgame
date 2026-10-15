import { expect, test } from "vitest";
import {
  frameIndex,
  genesisSeed,
  makeRandom,
  makeRoster,
  type Checkpoint,
} from "../../../index.ts";
import { countPolicies, type Policy } from "../../../lockstep/games/secret-hitler/policies.ts";
import { isTerminal, outcomeOf } from "../../../lockstep/games/secret-hitler/reducer.ts";
import { phasePayload, type SecretHitlerState } from "../../../lockstep/games/secret-hitler/state.ts";
import type { PlayerCount } from "../../../lockstep/games/secret-hitler/roles.ts";
import { legalActions, project } from "../../../lockstep/games/secret-hitler/view.ts";
import {
  secretHitlerRebalanced,
  variantMixFor,
} from "../../../lockstep/games/secret-hitler-rebalanced/index.ts";
import { driveRaw, seatsFor, type FramePolicy } from "../secret-hitler/driver.ts";

const COUNTS: readonly PlayerCount[] = [5, 6, 7, 8, 9, 10];
const DELTA_COUNTS: readonly PlayerCount[] = [6, 7, 9];

/** A variant-aware conservation check: the base helper hard-codes the 6/11 mix. */
const variantConserved = (state: SecretHitlerState): boolean => {
  const mix = variantMixFor(state.players.length as PlayerCount);
  const all: readonly Policy[] = [
    ...state.drawPile,
    ...state.discardPile,
    ...Array<Policy>(state.liberalPolicies).fill("liberal"),
    ...Array<Policy>(state.fascistPolicies).fill("fascist"),
    ...phasePayload(state.phase),
  ];
  const counts = countPolicies(all);
  return counts.liberal === mix.liberal && counts.fascist === mix.fascist;
};

const variantGenesis = (count: PlayerCount, entropy: string): Checkpoint<SecretHitlerState> => {
  const roster = makeRoster(seatsFor(count));
  const seed = genesisSeed(entropy);
  return {
    state: secretHitlerRebalanced.genesis({}, roster, makeRandom(seed)),
    roster,
    frame: frameIndex(0),
    seed,
  };
};

const teamPolicy: FramePolicy = (state, seat) => {
  const view = project(state, seat);
  const options = legalActions(view);
  if (options.length === 0) return null;
  const liberal = view.myRole === "liberal";
  if (view.phase.kind === "vote") {
    const ja = options.find((action) => action.t === "vote" && action.ja);
    const nein = options.find((action) => action.t === "vote" && !action.ja);
    return liberal ? (ja ?? nein ?? null) : (nein ?? ja ?? null);
  }
  if (view.phase.kind === "president-discard" && view.myDrawn !== null) {
    const want = liberal ? "liberal" : "fascist";
    const index = view.myDrawn.findIndex((card) => card === want);
    return { t: "discard", index: index >= 0 ? index : 0 };
  }
  if (view.phase.kind === "chancellor-enact" && view.myOffered !== null) {
    const want = liberal ? "liberal" : "fascist";
    const index = view.myOffered.findIndex((card) => card === want);
    return { t: "enact", index: index >= 0 ? index : 0 };
  }
  return options[0] ?? null;
};

const drive = (count: PlayerCount, entropy: string) => {
  let checkpoint = variantGenesis(count, entropy);
  let steps = 0;
  while (!isTerminal(checkpoint.state) && steps < 3000) {
    expect(variantConserved(checkpoint.state)).toBe(true);
    checkpoint = driveRaw(checkpoint, teamPolicy, steps);
    steps += 1;
  }
  return { checkpoint, steps };
};

test("a policy drives a rebalanced 6-player game to terminal, conserving the variant deck", () => {
  const { checkpoint, steps } = drive(6, "variant-full-6");
  expect(isTerminal(checkpoint.state)).toBe(true);
  expect(outcomeOf(checkpoint.state)).not.toBeNull();
  expect(variantConserved(checkpoint.state)).toBe(true);
  expect(steps).toBeLessThan(3000);
});

test("a policy drives a rebalanced 7-player game to terminal, conserving the variant deck", () => {
  const { checkpoint, steps } = drive(7, "variant-full-7");
  expect(isTerminal(checkpoint.state)).toBe(true);
  expect(outcomeOf(checkpoint.state)).not.toBeNull();
  expect(variantConserved(checkpoint.state)).toBe(true);
  expect(steps).toBeLessThan(3000);
});

test("a policy drives a rebalanced 9-player game to terminal, conserving the variant deck", () => {
  const { checkpoint, steps } = drive(9, "variant-full-9");
  expect(isTerminal(checkpoint.state)).toBe(true);
  expect(outcomeOf(checkpoint.state)).not.toBeNull();
  expect(variantConserved(checkpoint.state)).toBe(true);
  expect(steps).toBeLessThan(3000);
});

test("a policy drives every count 5 to 10 to terminal under the variant", () => {
  for (const count of COUNTS) {
    const { checkpoint } = drive(count, `variant-full-${String(count)}`);
    expect(isTerminal(checkpoint.state)).toBe(true);
    expect(outcomeOf(checkpoint.state)).not.toBeNull();
    expect(variantConserved(checkpoint.state)).toBe(true);
  }
});

test("every rebalanced count reaches a decided win, never an abandoned table", () => {
  for (const count of DELTA_COUNTS) {
    const { checkpoint } = drive(count, `variant-decided-${String(count)}`);
    const outcome = outcomeOf(checkpoint.state);
    expect(outcome).not.toBeNull();
    expect(outcome?.kind).not.toBe("abandoned");
  }
});

test("the rebalanced sweep reaches all four rules endings", () => {
  const seen = new Set<string>();
  for (const count of COUNTS) {
    for (let seed = 0; seed < 6; seed += 1) {
      const { checkpoint } = drive(count, `variant-outcome-${String(count)}-${String(seed)}`);
      const outcome = outcomeOf(checkpoint.state);
      expect(outcome).not.toBeNull();
      if (outcome !== null) seen.add(outcome.kind);
    }
  }
  expect(seen.has("liberal-policies")).toBe(true);
  expect(seen.has("fascist-policies")).toBe(true);
  expect(seen.has("hitler-chancellor")).toBe(true);
  expect(seen.has("hitler-executed")).toBe(true);
});

test("the variant preserves its reduced fascist supply across a whole game", () => {
  for (const count of DELTA_COUNTS) {
    const { checkpoint } = drive(count, `variant-supply-${String(count)}`);
    const mix = variantMixFor(count);
    // Conservation makes the bound tight: the track plus the leftover tiles is the supply.
    expect(checkpoint.state.fascistPolicies).toBeLessThanOrEqual(mix.fascist);
    expect(variantConserved(checkpoint.state)).toBe(true);
  }
});
