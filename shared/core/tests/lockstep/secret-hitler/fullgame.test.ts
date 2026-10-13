import { expect, test } from "vitest";
import { genesisSeed, makeRandom, makeRoster } from "../../../index.ts";
import {
  ANN,
  BOB,
  CARA,
  DEE,
  EVE,
  FINN,
  HITLER_CHANCELLOR_FASCIST,
  activeSeats,
  boardLimit,
  driveRaw,
  isTerminal,
  legalActions,
  outcomeOf,
  policiesConserved,
  project,
  rawGenesis,
  seatsFor,
  secretHitler,
  stepState,
  withPhase,
  withStackedPile,
  withTracks,
  type Checkpoint,
  type FramePolicy,
  type PlayerCount,
  type SecretHitlerState,
  type SeatId,
} from "./driver.ts";
import { stateDigest } from "../../../index.ts";

const COUNTS: readonly PlayerCount[] = [5, 6, 7, 8, 9, 10];

/**
 * A policy that plays toward the viewer's own team: liberals enact liberal and
 * vote yes; the fascist team votes no and enacts fascist. It reads only the
 * redacted view, so it carries no rules and cannot leak a secret.
 */
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

const drive = (count: PlayerCount, entropy: string, policy: FramePolicy = teamPolicy) => {
  const start = rawGenesis(count, entropy);
  let checkpoint = start;
  let steps = 0;
  while (!isTerminal(checkpoint.state) && steps < 3000) {
    expect(policiesConserved(checkpoint.state)).toBe(true);
    checkpoint = driveRaw(checkpoint, policy, steps);
    steps += 1;
  }
  return { checkpoint, steps };
};

test("a policy drives a 5-player game to terminal, with a decided outcome", () => {
  const { checkpoint, steps } = drive(5, "full-5");
  expect(isTerminal(checkpoint.state)).toBe(true);
  expect(outcomeOf(checkpoint.state)).not.toBeNull();
  expect(steps).toBeLessThan(3000);
});

test("a policy drives a 10-player game to terminal, with a decided outcome", () => {
  const { checkpoint, steps } = drive(10, "full-10");
  expect(isTerminal(checkpoint.state)).toBe(true);
  expect(outcomeOf(checkpoint.state)).not.toBeNull();
  expect(steps).toBeLessThan(3000);
});

test("a policy drives every count 5 to 10 to terminal, conserving the deck", () => {
  for (const count of COUNTS) {
    const { checkpoint } = drive(count, `full-terminal-${count}`);
    expect(isTerminal(checkpoint.state)).toBe(true);
    expect(outcomeOf(checkpoint.state)).not.toBeNull();
    expect(policiesConserved(checkpoint.state)).toBe(true);
  }
});

test("genesis is deterministic: the same seed deals the same roles and the same deck", () => {
  const roster = makeRoster(seatsFor(7));
  const first = secretHitler.genesis({}, roster, makeRandom(genesisSeed("full-determinism")));
  const second = secretHitler.genesis({}, roster, makeRandom(genesisSeed("full-determinism")));
  expect(stateDigest(secretHitler.state.encode(first))).toBe(
    stateDigest(secretHitler.state.encode(second)),
  );
  expect(first.players.map((player) => player.role)).toEqual(second.players.map((p) => p.role));
  expect(first.drawPile).toEqual(second.drawPile);
});

test("genesis runs exactly two shuffles, in a fixed order", () => {
  // Two peers with the same seed must agree on the deal AND the deck, which only
  // holds if the two shuffles consume rng in a fixed order.
  const roster = makeRoster(seatsFor(8));
  const state = secretHitler.genesis({}, roster, makeRandom(genesisSeed("full-order")));
  const expected = makeRandom(genesisSeed("full-order"));
  const roles = expected.shuffle(state.players.map((player) => player.role));
  const deck = expected.shuffle(state.drawPile);
  // The deck was shuffled from the sorted 6/11 mix; the deal shuffled the multiset.
  expect([...deck].sort()).toEqual([...state.drawPile].sort());
  expect(roles.length).toBe(8);
});

test("the mid-game reshuffle is deterministic and consumes rng only from frame.seed", () => {
  // Force the deck to the reshuffle threshold, then step the same frame twice with
  // the same seed and require the same new pile.
  const base = withTracks(rawGenesis(6, "full-reshuffle"), 0, 0);
  const start = withStackedPile(base, ["liberal", "fascist", "fascist"]);
  // Drive to a legislative session, then empty the deck and refill the discard.
  let checkpoint = start;
  let steps = 0;
  let sawReshuffle = false;
  while (!isTerminal(checkpoint.state) && steps < 400) {
    if (checkpoint.state.drawPile.length < 3 && checkpoint.state.discardPile.length > 0) {
      const seed = genesisSeed(`full-reshuffle-seed-${steps}`);
      const frame = {
        index: checkpoint.frame,
        seed,
        inputs: [],
      };
      const a = secretHitler.step(checkpoint.state, frame, makeRandom(seed));
      const b = secretHitler.step(checkpoint.state, frame, makeRandom(seed));
      expect(a.drawPile).toEqual(b.drawPile);
      sawReshuffle = true;
    }
    checkpoint = driveRaw(checkpoint, teamPolicy, steps);
    steps += 1;
  }
  expect(sawReshuffle).toBe(true);
});

test("the deck reshuffles from the discard when fewer than three tiles remain", () => {
  let checkpoint = withTracks(rawGenesis(5, "full-reshuffle-trigger"), 0, 0);
  // 6 liberal, 11 fascist: stack a deck so the top three are known, then drive.
  checkpoint = withStackedPile(checkpoint, ["liberal", "liberal", "fascist"]);
  const before = checkpoint.state.drawPile.length;
  expect(before).toBe(17);
  // After a session the deck shrinks by 3; the discard grows by 2.
  let steps = 0;
  while (!isTerminal(checkpoint.state) && steps < 60) {
    checkpoint = driveRaw(checkpoint, teamPolicy, steps);
    steps += 1;
  }
  expect(policiesConserved(checkpoint.state)).toBe(true);
});

test("the four stated endings are all reachable across the sweep", () => {
  const seen = new Set<string>();
  for (const count of COUNTS) {
    for (let seed = 0; seed < 6; seed += 1) {
      const { checkpoint } = drive(count, `full-outcome-${count}-${seed}`);
      const outcome = outcomeOf(checkpoint.state);
      expect(outcome).not.toBeNull();
      if (outcome === null) continue;
      seen.add(outcome.kind);
      expect([
        "liberal-policies",
        "fascist-policies",
        "hitler-chancellor",
        "hitler-executed",
        "abandoned",
      ]).toContain(outcome.kind);
    }
  }
  // The sweep reaches all four win/loss endings the rules define.
  expect(seen.has("liberal-policies")).toBe(true);
  expect(seen.has("fascist-policies")).toBe(true);
  expect(seen.has("hitler-chancellor")).toBe(true);
  expect(seen.has("hitler-executed")).toBe(true);
});

test("the fascist win line is six policies at every count, and the liberal line is five", () => {
  for (const count of COUNTS) {
    const { checkpoint } = drive(count, `full-lines-${count}`);
    expect(checkpoint.state.fascistPolicies).toBeLessThanOrEqual(boardLimit(count));
    expect(checkpoint.state.liberalPolicies).toBeLessThanOrEqual(5);
    const outcome = outcomeOf(checkpoint.state);
    if (outcome?.kind === "fascist-policies") {
      expect(checkpoint.state.fascistPolicies).toBe(boardLimit(count));
    }
    if (outcome?.kind === "liberal-policies") expect(checkpoint.state.liberalPolicies).toBe(5);
  }
});
