import { expect, test } from "vitest";
import { act } from "../../../../index.ts";
import type { CharacterId } from "../../../../lockstep/games/citadels/characters.ts";
import {
  blackmailer,
  blackmailerResolve,
  canThreat,
} from "../../../../lockstep/games/citadels/characters/blackmailer.ts";
import { applyCall } from "../../../../lockstep/games/citadels/helpers.ts";
import type { CitadelsState, Claim, Window } from "../../../../lockstep/games/citadels/state.ts";
import {
  ANN,
  BOB,
  SEATS3,
  advance,
  openPurpose,
  rawFrame,
  rawGenesis,
  rawGold,
  rawRandom,
  withGold,
} from "../driver.ts";

const BLACKMAILER_CAST: readonly CharacterId[] = [
  "assassin",
  "blackmailer",
  "magician",
  "king",
  "bishop",
  "merchant",
  "architect",
  "warlord",
];

/** BOB owns the Blackmailer; ANN owns the threatened character. */
const claimed: readonly Claim[] = [
  { seat: BOB, character: "blackmailer" },
  { seat: ANN, character: "king" },
];

/** A turn-phase state: the draft is over and the rank cursor is armed. */
const turnState = (): CitadelsState => ({
  ...rawGenesis(SEATS3, BLACKMAILER_CAST),
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

/** One pass of the Blackmailer's effect, with BOB as its owner. */
const pass = (state: CitadelsState): CitadelsState =>
  blackmailer({ state, seat: BOB, rest: [], rng: rawRandom() });

/** Resolve the open naming window with a named character. */
const nameVia = (state: CitadelsState, character: CharacterId): CitadelsState =>
  blackmailerResolve({
    state,
    window: topWindow(state),
    frame: rawFrame(0, [[BOB, act({ t: "name-character", character })]]),
    rng: rawRandom(),
  });

/** Threaten two characters: the first is the flowered-lace target, the second the decoy. */
const assign = (first: CharacterId, second: CharacterId): CitadelsState =>
  pass(nameVia(pass(nameVia(pass(turnState()), first)), second));

/**
 * Call the threatened character and settle on its turn window. `applyCall` arms
 * the character's resolve step above the turn window, so the first advance runs
 * the effect and leaves the turn window (the gather) on top.
 */
const onTurn = (state: CitadelsState): CitadelsState => advance(applyCall(state), () => null);

/**
 * Call the threatened character and resolve its threat. rules.json (blackmailer):
 * "When a threatened player is called, they must gather resources, then resolve
 * the threat." The called seat first answers the turn window with the gather,
 * which opens the threat window on the post-gather gold; the next advance answers
 * the threat with a bribe or a refusal.
 */
const resolveThreat = (state: CitadelsState, choice: "bribe" | "refuse"): CitadelsState =>
  advance(
    advance(onTurn(state), (seat) => (seat === ANN ? { t: "gold" } : null)),
    (seat) => (seat === ANN ? { t: "choose", value: choice } : null),
  );

/** The Blackmailer's reveal decision on the window its own file opens. */
const reveal = (state: CitadelsState, choice: "reveal" | "spare"): CitadelsState =>
  advance(state, (seat) => (seat === BOB ? { t: "choose", value: choice } : null));

/** The armed turn for the six threat-resolution fixtures: ANN (the King) is called at rank 4. */
const kingTurn = (gold: number, threats: readonly CharacterId[]): CitadelsState => ({
  ...withGold(withGold(turnState(), ANN, gold), BOB, 0),
  callRank: 4,
  threats,
});

test("the Blackmailer assigns two threat markers to two different characters, the first the flowered-lace target", () => {
  const next = assign("king", "thief");
  expect(next.threats).toEqual(["king", "thief"]);
});

test("a threatened player is called and resolves the threat before using abilities or building", () => {
  const armed = kingTurn(7, ["king", "thief"]);
  // rules.json (blackmailer): "When a threatened player is called, they must
  // gather resources, then resolve the threat." The turn window (the gather)
  // opens first and the threat is spliced directly below it, so the threat
  // resolves on the post-gather gold; answering the turn window with the gather
  // leaves the threat on top, so no build can land ahead of it.
  const turn = onTurn(armed);
  expect(topWindow(turn).purpose).toBe("turn");
  expect(topWindow(turn).seats).toEqual([ANN]);
  const gathered = advance(turn, (seat) => (seat === ANN ? { t: "gold" } : null));
  expect(topWindow(gathered).purpose).toBe("blackmailer-threat");
  expect(topWindow(gathered).seats).toEqual([ANN]);
});

test("a threatened player may bribe the Blackmailer by giving half their gold rounded down", () => {
  const armed = kingTurn(7, ["king", "thief"]);
  const next = resolveThreat(armed, "bribe");
  // The King gathers the turn's 2 gold (its own income is 0 on an empty city), so
  // the threat opens on 9: half of 9 rounds down to 4 for BOB.
  expect(rawGold(next, ANN)).toBe(5);
  expect(rawGold(next, BOB)).toBe(4);
  expect(next.threats).not.toContain("king");
});

test("a player with 1 gold gathers to 3 and bribes 1", () => {
  const armed = kingTurn(1, ["king", "thief"]);
  const next = resolveThreat(armed, "bribe");
  // Gather 2 onto the single gold: 3. Half of 3 rounds down to 1 for BOB.
  expect(rawGold(next, ANN)).toBe(2);
  expect(rawGold(next, BOB)).toBe(1);
  expect(next.threats).not.toContain("king");
});

test("a threatened player may refuse; the Blackmailer then reveals the flowered lace and takes all their gold", () => {
  const armed = kingTurn(6, ["king", "thief"]);
  const refused = resolveThreat(armed, "refuse");
  expect(openPurpose(refused)).toBe("blackmailer-resolve");
  const next = reveal(refused, "reveal");
  // The refused player gathered to 8; revealing the flowered lace takes all of it.
  expect(rawGold(next, ANN)).toBe(0);
  expect(rawGold(next, BOB)).toBe(8);
  expect(next.threats).not.toContain("king");
});

test("revealing a decoy marker takes no gold", () => {
  const armed = kingTurn(6, ["thief", "king"]);
  const next = reveal(resolveThreat(armed, "refuse"), "reveal");
  // The decoy (thief) is first, the flowered lace (king) second: the reveal moves
  // nothing, so the gathered 8 stays with ANN.
  expect(rawGold(next, ANN)).toBe(8);
  expect(rawGold(next, BOB)).toBe(0);
});

test("the Blackmailer cannot threaten a rank 1 character", () => {
  const state = turnState();
  expect(canThreat(state, "assassin")).toBe(false);
  expect(assign("assassin", "thief").threats).not.toContain("assassin");
});

test("the Blackmailer cannot threaten the killed character", () => {
  const state: CitadelsState = { ...turnState(), skipped: ["king"] };
  expect(canThreat(state, "king")).toBe(false);
});

test("the Blackmailer cannot threaten the bewitched character", () => {
  const state: CitadelsState = { ...turnState(), bewitched: "king" };
  expect(canThreat(state, "king")).toBe(false);
});

test("the ability is not a no-op: two markers land and a refused threat moves the target's gold", () => {
  const assigned = assign("king", "thief");
  expect(assigned.threats).toHaveLength(2);
  const armed: CitadelsState = { ...withGold(withGold(assigned, ANN, 5), BOB, 0), callRank: 4 };
  const next = reveal(resolveThreat(armed, "refuse"), "reveal");
  // The gather lands before the threat: 5 gathers to 7, and the flowered lace
  // takes all 7.
  expect(rawGold(next, ANN)).toBe(0);
  expect(rawGold(next, BOB)).toBe(7);
});
