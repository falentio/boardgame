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
  { seat: ANN, character: "merchant" },
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

/** Call the threatened character and resolve its threat window with a bribe or refusal. */
const resolveThreat = (state: CitadelsState, choice: "bribe" | "refuse"): CitadelsState =>
  advance(applyCall(state), (seat) => (seat === ANN ? { t: "choose", value: choice } : null));

/** The Blackmailer's reveal decision on the window its own file opens. */
const reveal = (state: CitadelsState, choice: "reveal" | "spare"): CitadelsState =>
  advance(state, (seat) => (seat === BOB ? { t: "choose", value: choice } : null));

test("the Blackmailer assigns two threat markers to two different characters, the first the flowered-lace target", () => {
  const next = assign("merchant", "thief");
  expect(next.threats).toEqual(["merchant", "thief"]);
});

test("a threatened player is called and resolves the threat before using abilities or building", () => {
  const armed: CitadelsState = { ...turnState(), callRank: 6, threats: ["merchant", "thief"] };
  const called = applyCall(armed);
  expect(topWindow(called).purpose).toBe("blackmailer-threat");
  expect(topWindow(called).seats).toEqual([ANN]);
  const purposes = called.steps.flatMap((s) => (s.kind === "window" ? [s.window.purpose] : []));
  expect(purposes.indexOf("blackmailer-threat")).toBeLessThan(purposes.indexOf("turn"));
});

test("a threatened player may bribe the Blackmailer by giving half their gold rounded down", () => {
  const armed: CitadelsState = {
    ...withGold(withGold(turnState(), ANN, 7), BOB, 0),
    callRank: 6,
    threats: ["merchant", "thief"],
  };
  const next = resolveThreat(armed, "bribe");
  // Half of 7 rounds down to 3 for BOB; the merchant's own income then adds 1.
  expect(rawGold(next, ANN)).toBe(5);
  expect(rawGold(next, BOB)).toBe(3);
  expect(next.threats).not.toContain("merchant");
});

test("a player with 1 gold gives 0 to bribe", () => {
  const armed: CitadelsState = {
    ...withGold(withGold(turnState(), ANN, 1), BOB, 0),
    callRank: 6,
    threats: ["merchant", "thief"],
  };
  const next = resolveThreat(armed, "bribe");
  // Half of 1 rounds down to 0 for BOB; the merchant's own income then adds 1.
  expect(rawGold(next, ANN)).toBe(2);
  expect(rawGold(next, BOB)).toBe(0);
  expect(next.threats).not.toContain("merchant");
});

test("a threatened player may refuse; the Blackmailer then reveals the flowered lace and takes all their gold", () => {
  const armed: CitadelsState = {
    ...withGold(withGold(turnState(), ANN, 6), BOB, 0),
    callRank: 6,
    threats: ["merchant", "thief"],
  };
  const refused = resolveThreat(armed, "refuse");
  expect(openPurpose(refused)).toBe("blackmailer-resolve");
  const next = reveal(refused, "reveal");
  expect(rawGold(next, ANN)).toBe(0);
  expect(rawGold(next, BOB)).toBe(6);
  expect(next.threats).not.toContain("merchant");
});

test("revealing a decoy marker takes no gold", () => {
  const armed: CitadelsState = {
    ...withGold(withGold(turnState(), ANN, 6), BOB, 0),
    callRank: 6,
    // The decoy (thief) is first, the flowered lace (merchant) second.
    threats: ["thief", "merchant"],
  };
  const next = reveal(resolveThreat(armed, "refuse"), "reveal");
  expect(rawGold(next, ANN)).toBe(6);
  expect(rawGold(next, BOB)).toBe(0);
});

test("the Blackmailer cannot threaten a rank 1 character", () => {
  const state = turnState();
  expect(canThreat(state, "assassin")).toBe(false);
  expect(assign("assassin", "thief").threats).not.toContain("assassin");
});

test("the Blackmailer cannot threaten the killed character", () => {
  const state: CitadelsState = { ...turnState(), skipped: ["merchant"] };
  expect(canThreat(state, "merchant")).toBe(false);
});

test("the Blackmailer cannot threaten the bewitched character", () => {
  const state: CitadelsState = { ...turnState(), bewitched: "merchant" };
  expect(canThreat(state, "merchant")).toBe(false);
});

test("the ability is not a no-op: two markers land and a refused threat moves the target's gold", () => {
  const assigned = assign("merchant", "thief");
  expect(assigned.threats).toHaveLength(2);
  const armed: CitadelsState = { ...withGold(withGold(assigned, ANN, 5), BOB, 0), callRank: 6 };
  const next = reveal(resolveThreat(armed, "refuse"), "reveal");
  expect(rawGold(next, ANN)).toBe(0);
  expect(rawGold(next, BOB)).toBe(5);
});
