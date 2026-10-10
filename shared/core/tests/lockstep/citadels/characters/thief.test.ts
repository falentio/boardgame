import { expect, test } from "vitest";
import { act } from "../../../../index.ts";
import type { CharacterId } from "../../../../lockstep/games/citadels/characters.ts";
import { canRob, thief } from "../../../../lockstep/games/citadels/characters/thief.ts";
import { applyCall, resolveChooseCharacter } from "../../../../lockstep/games/citadels/helpers.ts";
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

const THIEF_CAST: readonly CharacterId[] = [
  "assassin",
  "thief",
  "magician",
  "king",
  "bishop",
  "merchant",
  "architect",
  "warlord",
];

/** A turn-phase state: the draft is over and the rank cursor is armed. */
const turnState = (claimed: readonly Claim[]): CitadelsState => ({
  ...rawGenesis(SEATS3, THIEF_CAST),
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

/** BOB owns the Thief; run the effect's first pass, which opens the naming window. */
const open = (state: CitadelsState): CitadelsState =>
  thief({ state, seat: BOB, rest: [], rng: rawRandom() });

/** Name `character` through the shared choose-character window, as the engine does. */
const name = (state: CitadelsState, character: CharacterId): CitadelsState => {
  const opened = open(state);
  const frame = rawFrame(0, [[BOB, act({ t: "name-character", character })]]);
  return resolveChooseCharacter({ state: opened, window: topWindow(opened), frame, rng: rawRandom() });
};

/** The effect's commit pass: read the named character and record the mark. */
const commit = (state: CitadelsState): CitadelsState =>
  thief({ state, seat: BOB, rest: [], rng: rawRandom() });

test("the Thief opens the choose-character window to call the name of another character", () => {
  const next = open(turnState([]));
  expect(openPurpose(next)).toBe("choose-character");
  expect(next.pending?.actor).toBe(BOB);
});

test("naming a character records it in robbed so the engine robs its owner when it is called", () => {
  const committed = commit(name(turnState([]), "merchant"));
  expect(committed.robbed).toBe("merchant");
  expect(committed.pending).toBeNull();
});

test("when the named character is called the Thief immediately takes all of its owner's gold", () => {
  const claimed: readonly Claim[] = [
    { seat: BOB, character: "thief" },
    { seat: ANN, character: "merchant" },
  ];
  const armed: CitadelsState = {
    ...withGold(withGold(turnState(claimed), ANN, 7), BOB, 1),
    callRank: 6,
    robbed: "merchant",
  };
  const called = applyCall(armed);
  expect(topWindow(called).purpose).toBe("thief-rob");
  const next = advance(called, () => null);
  expect(rawGold(next, ANN)).toBe(0);
  expect(rawGold(next, BOB)).toBe(8);
});

test("the Thief cannot rob a rank 1 character", () => {
  const state = turnState([]);
  expect(canRob(state, "assassin")).toBe(false);
  expect(commit(name(state, "assassin")).robbed).toBeNull();
});

test("the Thief cannot rob the killed character", () => {
  const state: CitadelsState = { ...turnState([]), skipped: ["merchant"] };
  expect(canRob(state, "merchant")).toBe(false);
  expect(commit(name(state, "merchant")).robbed).toBeNull();
});

test("the Thief cannot rob the bewitched character", () => {
  const state: CitadelsState = { ...turnState([]), bewitched: "merchant" };
  expect(canRob(state, "merchant")).toBe(false);
  expect(commit(name(state, "merchant")).robbed).toBeNull();
});

test("the Thief cannot name itself: the rule is another character", () => {
  expect(canRob(turnState([]), "thief")).toBe(false);
  expect(commit(name(turnState([]), "thief")).robbed).toBeNull();
});
