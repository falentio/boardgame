import { expect, test } from "vitest";
import { act } from "../../../../index.ts";
import type { CharacterId } from "../../../../lockstep/games/citadels/characters.ts";
import { witch } from "../../../../lockstep/games/citadels/characters/witch.ts";
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
  rawPlayer,
  rawRandom,
} from "../driver.ts";

const CAST: readonly CharacterId[] = [
  "witch",
  "thief",
  "magician",
  "king",
  "bishop",
  "merchant",
  "architect",
  "warlord",
];

const CLAIMED: readonly Claim[] = [
  { seat: BOB, character: "witch" },
  { seat: ANN, character: "merchant" },
];

/** A turn-phase state: the draft is over and the rank cursor is armed. */
const turnState = (claimed: readonly Claim[]): CitadelsState => ({
  ...rawGenesis(SEATS3, CAST),
  phase: "turn",
  draft: null,
  claimed,
  callRank: 1,
  active: BOB,
  steps: [{ kind: "call" }, { kind: "end-round" }],
});

const topWindow = (state: CitadelsState): Window => {
  const top = state.steps[0];
  if (top === undefined || top.kind !== "window") throw new Error("no open window");
  return top.window;
};

const purposes = (state: CitadelsState): readonly string[] =>
  state.steps.flatMap((step) => (step.kind === "window" ? [step.window.purpose] : []));

/** The Witch's first pass: gather, then arm the naming window. */
const open = (state: CitadelsState): CitadelsState =>
  witch({ state, seat: BOB, rest: [], rng: rawRandom() });

/** Name `character` through the shared choose-character window, as the engine does. */
const name = (state: CitadelsState, character: CharacterId): CitadelsState => {
  const opened = open(state);
  const frame = rawFrame(0, [[BOB, act({ t: "name-character", character })]]);
  return resolveChooseCharacter({ state: opened, window: topWindow(opened), frame, rng: rawRandom() });
};

/** The Witch's commit pass: record the bewitched character. */
const commit = (state: CitadelsState): CitadelsState =>
  witch({ state, seat: BOB, rest: [], rng: rawRandom() });

test("the Witch gathers resources before naming", () => {
  const base = turnState(CLAIMED);
  const opened = open(base);
  expect(rawGold(opened, BOB)).toBe(rawGold(base, BOB) + 2);
});

test("the Witch calls the name of another character to bewitch", () => {
  const opened = open(turnState(CLAIMED));
  expect(openPurpose(opened)).toBe("choose-character");
  expect(opened.pending?.character).toBe("witch");
  const committed = commit(name(turnState(CLAIMED), "merchant"));
  expect(committed.bewitched).toBe("merchant");
});

test("the Witch's turn is put on hold and she cannot build", () => {
  // The naming pass opens only the choose-character window: no turn window, so
  // no build. A no-op effect would open nothing at all.
  const opened = open(turnState(CLAIMED));
  expect(purposes(opened)).toEqual(["choose-character"]);
});

test("when the bewitched character is called its owner gathers and its turn immediately ends", () => {
  const armed: CitadelsState = { ...turnState(CLAIMED), callRank: 6, bewitched: "merchant" };
  const called = applyCall(armed);
  expect(topWindow(called).purpose).toBe("witch-takeover");
  expect(topWindow(called).seats).toEqual([BOB]);
  const afterGather = advance(called, () => null);
  expect(rawGold(afterGather, ANN)).toBe(rawGold(called, ANN) + 2);
});

test("the bewitched character's owner takes no build and no character ability", () => {
  const armed: CitadelsState = { ...turnState(CLAIMED), callRank: 6, bewitched: "merchant" };
  const called = applyCall(armed);
  expect(purposes(called)).not.toContain("turn");
});

test("the Witch then resumes her turn as the bewitched character", () => {
  const armed: CitadelsState = { ...turnState(CLAIMED), callRank: 6, bewitched: "merchant" };
  const afterGather = advance(applyCall(armed), () => null);
  expect(topWindow(afterGather).purpose).toBe("witch-resume");
  expect(topWindow(afterGather).seats).toEqual([BOB]);
  const resumed = advance(afterGather, () => null);
  expect(topWindow(resumed).purpose).toBe("turn");
  expect(topWindow(resumed).seats).toEqual([BOB]);
});

test("the resumed turn uses the Witch's own hand, gold, and city", () => {
  const base = turnState(CLAIMED);
  const armed: CitadelsState = { ...base, callRank: 6, bewitched: "merchant" };
  const witchHand = rawPlayer(base, BOB).hand;
  const witchGold = rawGold(base, BOB);
  const afterGather = advance(applyCall(armed), () => null);
  expect(rawPlayer(afterGather, BOB).hand).toEqual(witchHand);
  expect(rawGold(afterGather, BOB)).toBe(witchGold);
  expect(rawPlayer(afterGather, BOB).city).toEqual([]);
});

test("if the bewitched character is not in play this round, the Witch does not resume", () => {
  // `warlord` is in the cast but unclaimed, so it is not in play this round.
  const armed: CitadelsState = { ...turnState(CLAIMED), callRank: 6, bewitched: "warlord" };
  const called = applyCall(armed);
  expect(purposes(called)).not.toContain("witch-takeover");
  expect(purposes(called)).not.toContain("witch-resume");
});

test("the ability is not a no-op: a passive Witch would not gather or bewitch", () => {
  const base = turnState(CLAIMED);
  const opened = open(base);
  expect(rawGold(opened, BOB)).toBeGreaterThan(rawGold(base, BOB));
  const committed = commit(name(base, "merchant"));
  expect(committed.bewitched).toBe("merchant");
  const called = applyCall({ ...committed, callRank: 6 });
  expect(purposes(called)).toContain("witch-takeover");
});
