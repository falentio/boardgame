import { expect, test } from "vitest";
import { assassin } from "../../../../lockstep/games/citadels/characters/assassin.ts";
import type { CharacterId } from "../../../../lockstep/games/citadels/characters.ts";
import { applyCall } from "../../../../lockstep/games/citadels/helpers.ts";
import type { Claim, CitadelsState } from "../../../../lockstep/games/citadels/state.ts";
import { ANN, BOB, CARA, SEATS3, play, rawGenesis, rawRandom } from "../driver.ts";

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

const purposes = (state: CitadelsState): readonly string[] =>
  state.steps.flatMap((step) => (step.kind === "window" ? [step.window.purpose] : []));

const topPurpose = (state: CitadelsState): string | null => purposes(state)[0] ?? null;

test("the Assassin calls the name of another character", () => {
  const opened = assassin({ state: turnState(CLAIMED), seat: ANN, rest: [], rng: rawRandom() });
  expect(topPurpose(opened)).toBe("choose-character");
  expect(opened.pending?.actor).toBe(ANN);
  expect(opened.pending?.character).toBe("assassin");
  const named = play(opened, [[ANN, { t: "name-character", character: "merchant" }]]);
  expect(named.skipped).toContain("merchant");
  expect(named.pending?.namedCharacter).toBe("merchant");
});

test("the Assassin takes its own turn after naming", () => {
  const opened = assassin({ state: turnState(CLAIMED), seat: ANN, rest: [], rng: rawRandom() });
  const named = play(opened, [[ANN, { t: "name-character", character: "merchant" }]]);
  expect(named.steps[0]).toMatchObject({
    kind: "window",
    window: { purpose: "turn", seats: [ANN] },
  });
});

test("naming yourself is not another character, so nothing is killed", () => {
  const opened = assassin({ state: turnState(CLAIMED), seat: ANN, rest: [], rng: rawRandom() });
  const named = play(opened, [[ANN, { t: "name-character", character: "assassin" }]]);
  expect(named.skipped).toEqual([]);
});

test("when the killed character is called it remains silent and skips its entire turn", () => {
  const state: CitadelsState = {
    ...turnState(CLAIMED),
    callRank: 6,
    active: CARA,
    skipped: ["merchant"],
  };
  const next = applyCall(state);
  expect(next.callRank).toBe(7);
  expect(purposes(next)).toHaveLength(0);
});

test("a killed character is skipped without revealing its card", () => {
  const state: CitadelsState = {
    ...turnState(CLAIMED),
    callRank: 6,
    active: CARA,
    skipped: ["merchant"],
  };
  const next = applyCall(state);
  // The killed owner is never announced as active and is owed no window, so its
  // identity never leaves the hidden claim record.
  expect(next.active).toBe(CARA);
  expect(next.steps.some((step) => step.kind === "window" && step.window.seats.includes(BOB))).toBe(
    false,
  );
  expect(next.claimed).toEqual(state.claimed);
});

test("a live character is called normally: the skip is specific to the kill", () => {
  const state: CitadelsState = { ...turnState(CLAIMED), callRank: 6, active: CARA };
  const next = applyCall(state);
  expect(next.active).toBe(BOB);
  expect(topPurpose(next)).toBe("turn");
});

test("the kill is recorded: a no-op Assassin would not skip the character", () => {
  const opened = assassin({ state: turnState(CLAIMED), seat: ANN, rest: [], rng: rawRandom() });
  const named = play(opened, [[ANN, { t: "name-character", character: "merchant" }]]);
  const called = applyCall({ ...named, callRank: 6, active: CARA });
  expect(purposes(called)).not.toContain("turn");
  expect(called.callRank).toBe(7);
});
