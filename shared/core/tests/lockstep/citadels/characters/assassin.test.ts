import { expect, test } from "vitest";
import { act } from "../../../../index.ts";
import type { CharacterId } from "../../../../lockstep/games/citadels/characters.ts";
import { assassin, canKill } from "../../../../lockstep/games/citadels/characters/assassin.ts";
import { applyCall, resolveChooseCharacter } from "../../../../lockstep/games/citadels/helpers.ts";
import type { CitadelsState, Claim, Window } from "../../../../lockstep/games/citadels/state.ts";
import {
  ANN,
  BOB,
  SEATS3,
  openPurpose,
  rawFrame,
  rawGenesis,
  rawRandom,
} from "../driver.ts";

const BASE: readonly CharacterId[] = [
  "assassin",
  "thief",
  "magician",
  "king",
  "bishop",
  "merchant",
  "architect",
  "warlord",
];

const CLAIMED: readonly Claim[] = [
  { seat: ANN, character: "assassin" },
  { seat: BOB, character: "merchant" },
];

/** A turn-phase state: the draft is over and the rank cursor is armed. */
const turnState = (claimed: readonly Claim[]): CitadelsState => ({
  ...rawGenesis(SEATS3, BASE),
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

const purposes = (state: CitadelsState): readonly string[] =>
  state.steps.flatMap((step) => (step.kind === "window" ? [step.window.purpose] : []));

/** The Assassin's first pass: arm the commit and open the naming window. */
const open = (state: CitadelsState): CitadelsState =>
  assassin({ state, seat: ANN, rest: [], rng: rawRandom() });

/** Name `character` through the shared choose-character window, as the engine does. */
const name = (state: CitadelsState, character: CharacterId): CitadelsState => {
  const opened = open(state);
  const frame = rawFrame(0, [[ANN, act({ t: "name-character", character })]]);
  return resolveChooseCharacter({ state: opened, window: topWindow(opened), frame, rng: rawRandom() });
};

/** The Assassin's commit pass: read the named character and record the kill. */
const commit = (state: CitadelsState): CitadelsState =>
  assassin({ state, seat: ANN, rest: [], rng: rawRandom() });

test("the Assassin calls the name of another character", () => {
  const opened = open(turnState(CLAIMED));
  expect(openPurpose(opened)).toBe("choose-character");
  expect(opened.pending?.actor).toBe(ANN);
  expect(opened.pending?.character).toBe("assassin");
  const named = name(turnState(CLAIMED), "merchant");
  expect(named.pending?.namedCharacter).toBe("merchant");
});

test("when the killed character is called it must remain silent and skip its entire turn", () => {
  const killed = commit(name(turnState(CLAIMED), "merchant"));
  expect(killed.skipped).toContain("merchant");
  const called = applyCall({ ...killed, callRank: 6, active: ANN });
  expect(called.callRank).toBe(7);
  expect(purposes(called)).toHaveLength(0);
});

test("the killed character skips without revealing its card", () => {
  const killed = commit(name(turnState(CLAIMED), "merchant"));
  const called = applyCall({ ...killed, callRank: 6, active: ANN });
  // No window names the killed owner, so its hidden claim never becomes public.
  expect(called.steps.some((step) => step.kind === "window" && step.window.seats.includes(BOB))).toBe(
    false,
  );
  expect(called.claimed).toEqual(killed.claimed);
});

test("a character not killed is called normally: the skip is specific", () => {
  const called = applyCall({ ...turnState(CLAIMED), callRank: 6, active: ANN });
  expect(called.active).toBe(BOB);
  expect(openPurpose(called)).toBe("turn");
});

test("the Assassin cannot name itself: the rule is another character", () => {
  expect(canKill(turnState(CLAIMED), "assassin")).toBe(false);
  expect(commit(name(turnState(CLAIMED), "assassin")).skipped).toEqual([]);
});

test("the Assassin takes its own turn after naming", () => {
  const opened = open(turnState(CLAIMED));
  expect(purposes(opened)).toContain("turn");
  expect(opened.steps.some((s) => s.kind === "window" && s.window.seats[0] === ANN)).toBe(true);
});

test("the kill is not a no-op: without it the named character would take a turn", () => {
  const killed = commit(name(turnState(CLAIMED), "merchant"));
  const called = applyCall({ ...killed, callRank: 6, active: ANN });
  expect(called.skipped).toContain("merchant");
  expect(purposes(called)).not.toContain("turn");
  expect(called.callRank).toBe(7);
});
