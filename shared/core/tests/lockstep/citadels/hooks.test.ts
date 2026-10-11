import { expect, test } from "vitest";
import { type CharacterId } from "../../../lockstep/games/citadels/characters.ts";
import { specOfDistrict } from "../../../lockstep/games/citadels/districts.ts";
import { applyCall, applyEndRound, tryBuild } from "../../../lockstep/games/citadels/helpers.ts";
import { type SeatId } from "../../../index.ts";
import {
  type CitadelsState,
  type Claim,
  type Window,
} from "../../../lockstep/games/citadels/state.ts";
import {
  ANN,
  BASE_CAST_IDS,
  BOB,
  CARA,
  SEATS3,
  advance,
  rawGenesis,
  rawGold,
  rawPlayer,
  rawRandom,
  withGold,
} from "./driver.ts";

const WITCH_CAST: readonly CharacterId[] = [
  "witch",
  "thief",
  "magician",
  "king",
  "bishop",
  "merchant",
  "architect",
  "warlord",
];

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

const MAGISTRATE_CAST: readonly CharacterId[] = [
  "magistrate",
  "thief",
  "magician",
  "king",
  "bishop",
  "merchant",
  "architect",
  "warlord",
];

const TAX_CAST: readonly CharacterId[] = [...BASE_CAST_IDS, "tax-collector"];

/** A turn-phase state: the draft is over and the rank cursor is armed. */
const turnState = (cast: readonly CharacterId[], claimed: readonly Claim[]): CitadelsState => ({
  ...rawGenesis(SEATS3, cast),
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

const windowPurposes = (state: CitadelsState): readonly string[] =>
  state.steps.flatMap((step) => (step.kind === "window" ? [step.window.purpose] : []));

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

test("calling a robbed character opens thief-rob for the Thief's owner above its own turn", () => {
  const claimed: readonly Claim[] = [
    { seat: BOB, character: "thief" },
    { seat: ANN, character: "merchant" },
  ];
  const state: CitadelsState = {
    ...turnState(BASE_CAST_IDS, claimed),
    callRank: 6,
    robbed: "merchant",
  };
  const next = applyCall(state);
  expect(topWindow(next).purpose).toBe("thief-rob");
  expect(topWindow(next).seats).toEqual([BOB]);
  expect(next.steps[2]).toMatchObject({
    kind: "window",
    window: { purpose: "turn", seats: [ANN] },
  });
});

test("the Thief's window opens before the robbed owner takes their turn", () => {
  const claimed: readonly Claim[] = [
    { seat: BOB, character: "thief" },
    { seat: ANN, character: "merchant" },
  ];
  const state: CitadelsState = {
    ...turnState(BASE_CAST_IDS, claimed),
    callRank: 6,
    robbed: "merchant",
  };
  const next = applyCall(state);
  expect(windowPurposes(next).indexOf("thief-rob")).toBeLessThan(
    windowPurposes(next).indexOf("turn"),
  );
});

test("a bewitched character's own turn is suppressed and the Witch's window opens instead", () => {
  const claimed: readonly Claim[] = [
    { seat: BOB, character: "witch" },
    { seat: ANN, character: "merchant" },
  ];
  const state: CitadelsState = {
    ...turnState(WITCH_CAST, claimed),
    callRank: 6,
    bewitched: "merchant",
  };
  const next = applyCall(state);
  expect(topWindow(next).purpose).toBe("witch-takeover");
  expect(topWindow(next).seats).toEqual([BOB]);
  expect(windowPurposes(next)).not.toContain("turn");
});

test("bewitch beats rob: a character both bewitched and robbed yields only witch-takeover", () => {
  const claimed: readonly Claim[] = [
    { seat: BOB, character: "witch" },
    { seat: ANN, character: "merchant" },
  ];
  const state: CitadelsState = {
    ...turnState(WITCH_CAST, claimed),
    callRank: 6,
    bewitched: "merchant",
    robbed: "merchant",
  };
  const next = applyCall(state);
  expect(topWindow(next).purpose).toBe("witch-takeover");
  expect(windowPurposes(next)).not.toContain("thief-rob");
});

test("a threatened player's turn opens blackmailer-threat before their own window", () => {
  const claimed: readonly Claim[] = [
    { seat: BOB, character: "blackmailer" },
    { seat: ANN, character: "merchant" },
  ];
  const state: CitadelsState = {
    ...turnState(BLACKMAILER_CAST, claimed),
    callRank: 6,
    threats: ["merchant", "thief"],
  };
  const next = applyCall(state);
  expect(topWindow(next).purpose).toBe("blackmailer-threat");
  expect(topWindow(next).seats).toEqual([ANN]);
  expect(next.steps[2]).toMatchObject({
    kind: "window",
    window: { purpose: "turn", seats: [ANN] },
  });
});

test("a killed character opens nothing, exactly as before", () => {
  const claimed: readonly Claim[] = [
    { seat: BOB, character: "thief" },
    { seat: ANN, character: "merchant" },
  ];
  const state: CitadelsState = {
    ...turnState(BASE_CAST_IDS, claimed),
    callRank: 6,
    robbed: "merchant",
    skipped: ["merchant"],
  };
  const next = applyCall(state);
  expect(windowPurposes(next)).toHaveLength(0);
  expect(next.callRank).toBe(7);
});

test("the engine surfaces thief-rob through the stepState seam", () => {
  const claimed: readonly Claim[] = [
    { seat: BOB, character: "thief" },
    { seat: ANN, character: "merchant" },
  ];
  const armed: CitadelsState = {
    ...turnState(BASE_CAST_IDS, claimed),
    callRank: 6,
    robbed: "merchant",
    steps: [
      { kind: "window", window: { kind: "any", purpose: "choose-character", seats: [] } },
      { kind: "call" },
      { kind: "end-round" },
    ],
  };
  const next = advance(armed, () => null);
  expect(topWindow(next).purpose).toBe("thief-rob");
  expect(topWindow(next).seats).toEqual([BOB]);
});

test("building a district charges 1 gold to the Tax Collector's token", () => {
  const state = withGold(turnState(TAX_CAST, []), ANN, 20);
  const { index, cost } = firstAffordable(state, ANN);
  const next = tryBuild(state, ANN, index, rawRandom());
  expect(next.taxPot).toBe(1);
  expect(rawGold(next, ANN)).toBe(20 - cost - 1);
  expect(rawPlayer(next, ANN).city).toHaveLength(1);
});

test("a builder with no gold left after building pays no tax", () => {
  const armed = turnState(TAX_CAST, []);
  const probe = withGold(armed, ANN, 20);
  const { index, cost } = firstAffordable(probe, ANN);
  const state = withGold(armed, ANN, cost);
  const next = tryBuild(state, ANN, index, rawRandom());
  expect(rawGold(next, ANN)).toBe(0);
  expect(next.taxPot).toBe(0);
  expect(rawPlayer(next, ANN).city).toHaveLength(1);
});

test("the Tax Collector pays no tax when building", () => {
  const claimed: readonly Claim[] = [{ seat: ANN, character: "tax-collector" }];
  const state = withGold(turnState(TAX_CAST, claimed), ANN, 20);
  const { index, cost } = firstAffordable(state, ANN);
  const next = tryBuild(state, ANN, index, rawRandom());
  expect(next.taxPot).toBe(0);
  expect(rawGold(next, ANN)).toBe(20 - cost);
});

test("a paid build by the warranted player opens magistrate-confiscate for the Magistrate", () => {
  const claimed: readonly Claim[] = [
    { seat: ANN, character: "merchant" },
    { seat: BOB, character: "magistrate" },
  ];
  const state: CitadelsState = {
    ...withGold(turnState(MAGISTRATE_CAST, claimed), ANN, 20),
    warrants: ["merchant", "thief", "architect"],
  };
  const { index } = firstAffordable(state, ANN);
  const next = tryBuild(state, ANN, index, rawRandom());
  expect(topWindow(next).purpose).toBe("magistrate-confiscate");
  expect(topWindow(next).seats).toEqual([BOB]);
});

test("a build by an unwarranted player opens no magistrate-confiscate window", () => {
  const claimed: readonly Claim[] = [
    { seat: ANN, character: "merchant" },
    { seat: BOB, character: "magistrate" },
  ];
  const state: CitadelsState = {
    ...withGold(turnState(MAGISTRATE_CAST, claimed), ANN, 20),
    warrants: ["thief", "architect", "warlord"],
  };
  const { index } = firstAffordable(state, ANN);
  const next = tryBuild(state, ANN, index, rawRandom());
  expect(windowPurposes(next)).not.toContain("magistrate-confiscate");
});

test("applyEndRound clears the four per-round markers and keeps the Tax Collector's pot", () => {
  const state: CitadelsState = {
    ...turnState(BASE_CAST_IDS, []),
    robbed: "king",
    bewitched: "merchant",
    threats: ["thief", "bishop"],
    warrants: ["magician", "warlord", "architect"],
    taxPot: 5,
    steps: [{ kind: "end-round" }],
  };
  const next = applyEndRound(state, rawRandom());
  expect(next.robbed).toBeNull();
  expect(next.bewitched).toBeNull();
  expect(next.threats).toEqual([]);
  expect(next.warrants).toEqual([]);
  expect(next.taxPot).toBe(5);
  expect(next.phase).toBe("draft");
});

test("a threat on the third seat's character opens too", () => {
  const claimed: readonly Claim[] = [
    { seat: BOB, character: "blackmailer" },
    { seat: CARA, character: "merchant" },
  ];
  const state: CitadelsState = {
    ...turnState(BLACKMAILER_CAST, claimed),
    callRank: 6,
    threats: ["merchant"],
  };
  const next = applyCall(state);
  expect(topWindow(next).purpose).toBe("blackmailer-threat");
  expect(topWindow(next).seats).toEqual([CARA]);
});
