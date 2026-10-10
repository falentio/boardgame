import { expect, test } from "vitest";
import { act } from "../../../../index.ts";
import type { CharacterId } from "../../../../lockstep/games/citadels/characters.ts";
import { magistrate } from "../../../../lockstep/games/citadels/characters/magistrate.ts";
import { specOfDistrict } from "../../../../lockstep/games/citadels/districts.ts";
import {
  END_TURN,
  resolveChooseCharacter,
  tryBuild,
} from "../../../../lockstep/games/citadels/helpers.ts";
import type { CitadelsState, Claim, Window } from "../../../../lockstep/games/citadels/state.ts";
import {
  ANN,
  BOB,
  SEATS3,
  play,
  rawFrame,
  rawGenesis,
  rawGold,
  rawPlayer,
  rawRandom,
  withGold,
} from "../driver.ts";

const CAST: readonly CharacterId[] = [
  "magistrate",
  "thief",
  "magician",
  "king",
  "bishop",
  "merchant",
  "architect",
  "warlord",
];

const CLAIMED: readonly Claim[] = [
  { seat: ANN, character: "merchant" },
  { seat: BOB, character: "magistrate" },
];

/** A turn-phase state: the draft is over and the rank cursor is armed. */
const turnState = (): CitadelsState => ({
  ...rawGenesis(SEATS3, CAST),
  phase: "turn",
  draft: null,
  claimed: CLAIMED,
  callRank: 1,
  active: ANN,
  steps: [{ kind: "call" }, { kind: "end-round" }],
});

const topWindow = (state: CitadelsState): Window => {
  const top = state.steps[0];
  if (top === undefined || top.kind !== "window") throw new Error("no open window");
  return top.window;
};

const topPurpose = (state: CitadelsState): string | null => {
  const top = state.steps[0];
  return top !== undefined && top.kind === "window" ? top.window.purpose : null;
};

/** The Magistrate's first pass: arm the commit and open the naming window. */
const open = (state: CitadelsState): CitadelsState =>
  magistrate({ state, seat: BOB, rest: [], rng: rawRandom() });

/** Name `character` through the shared choose-character window, as the engine does. */
const name = (state: CitadelsState, character: CharacterId): CitadelsState => {
  const opened = open(state);
  const frame = rawFrame(0, [[BOB, act({ t: "name-character", character })]]);
  return resolveChooseCharacter({ state: opened, window: topWindow(opened), frame, rng: rawRandom() });
};

/** The Magistrate's commit pass: read the named character and sign the warrant. */
const commit = (state: CitadelsState): CitadelsState =>
  magistrate({ state, seat: BOB, rest: [], rng: rawRandom() });

/** The first hand card the seat can afford, with its cost. */
const firstAffordable = (
  state: CitadelsState,
  seat: typeof ANN,
): { readonly index: number; readonly cost: number } => {
  const player = rawPlayer(state, seat);
  for (let index = 0; index < player.hand.length; index += 1) {
    const id = player.hand[index];
    if (id === undefined) continue;
    const cost = specOfDistrict(id).cost;
    if (cost <= player.gold) return { index, cost };
  }
  throw new Error("no affordable card");
};

/**
 * A state where ANN (merchant) has just paid to build, the warrant signed on
 * merchant. `resolveTurn` splices `END_TURN` below the build's follow-up
 * windows, so this emulates that: the confiscate window sits above `END_TURN`.
 */
const paidBuild = (gold = 20) => {
  const signed = commit(name(turnState(), "merchant"));
  const base = withGold(signed, ANN, gold);
  const { index, cost } = firstAffordable(base, ANN);
  const raw = tryBuild(base, ANN, index, rawRandom());
  const built: CitadelsState = { ...raw, steps: [...raw.steps, END_TURN] };
  const target = rawPlayer(built, ANN);
  const builtId = target.city[target.city.length - 1]?.id ?? "";
  return { built, cost, builtId };
};

test("the Magistrate assigns three warrant markers to three different characters, the target first", () => {
  const signed = commit(name(turnState(), "merchant"));
  expect(signed.warrants).toHaveLength(3);
  expect(new Set(signed.warrants).size).toBe(3);
  expect(signed.warrants?.[0]).toBe("merchant");
  expect(signed.warrants).not.toContain("magistrate");
});

test("when the targeted player pays to build, the warrant may be revealed to confiscate the district", () => {
  const { built, builtId } = paidBuild();
  expect(topPurpose(built)).toBe("magistrate-confiscate");
  expect(topWindow(built).seats).toEqual([BOB]);
  const seized = play(built, [[BOB, { t: "choose", value: "confiscate" }]]);
  expect(rawPlayer(seized, BOB).city.map((d) => d.id)).toContain(builtId);
  expect(rawPlayer(seized, ANN).city.map((d) => d.id)).not.toContain(builtId);
});

test("the confiscated district is built in the Magistrate's city for free", () => {
  const { built } = paidBuild();
  const before = rawGold(built, BOB);
  const seized = play(built, [[BOB, { t: "choose", value: "confiscate" }]]);
  expect(rawGold(seized, BOB)).toBe(before);
  expect(rawPlayer(seized, BOB).city).toHaveLength(1);
});

test("the target gets their gold back after the confiscation", () => {
  const { built, cost } = paidBuild(20);
  expect(rawGold(built, ANN)).toBe(20 - cost);
  const seized = play(built, [[BOB, { t: "choose", value: "confiscate" }]]);
  expect(rawGold(seized, ANN)).toBe(20);
});

test("the confiscated district counts toward the target's building limit", () => {
  const { built, builtId } = paidBuild();
  expect(rawPlayer(built, ANN).city).toHaveLength(1);
  const seized = play(built, [[BOB, { t: "choose", value: "confiscate" }]]);
  // The build is spent: the district left the target's city (so its one build
  // this turn is used up) and no further turn window lets it build again.
  expect(rawPlayer(seized, ANN).city).toHaveLength(0);
  expect(rawPlayer(seized, BOB).city.map((d) => d.id)).toContain(builtId);
  expect(seized.steps.some((s) => s.kind === "window" && s.window.purpose === "turn")).toBe(false);
});

test("only the first paid build can be confiscated; the warrant is then spent", () => {
  const { built } = paidBuild();
  const seized = play(built, [[BOB, { t: "choose", value: "confiscate" }]]);
  expect(seized.warrants).toEqual([]);
  const second = tryBuild(withGold(seized, ANN, 20), ANN, 0, rawRandom());
  expect(topPurpose(second)).not.toBe("magistrate-confiscate");
});

test("the Magistrate cannot confiscate a district it already has an identical copy of", () => {
  const { built, builtId } = paidBuild();
  const withCopy: CitadelsState = {
    ...built,
    players: built.players.map((p) =>
      p.seat === BOB ? { ...p, city: [...p.city, { id: builtId, gold: 0 }] } : p,
    ),
  };
  const seized = play(withCopy, [[BOB, { t: "choose", value: "confiscate" }]]);
  expect(rawPlayer(seized, ANN).city.map((d) => d.id)).toContain(builtId);
  expect(rawPlayer(seized, BOB).city).toHaveLength(1);
  expect(rawGold(seized, ANN)).toBe(rawGold(built, ANN));
});

test("a passing Magistrate leaves the target's build untouched", () => {
  const { built, builtId } = paidBuild();
  const targetGold = rawGold(built, ANN);
  const passed = play(built, [[BOB, null]]);
  expect(rawPlayer(passed, ANN).city.map((d) => d.id)).toContain(builtId);
  expect(rawPlayer(passed, BOB).city).toHaveLength(0);
  expect(rawGold(passed, ANN)).toBe(targetGold);
});

test("the ability is not a no-op: it signs warrants and moves the district", () => {
  const { built, builtId } = paidBuild();
  expect(topPurpose(built)).toBe("magistrate-confiscate");
  const seized = play(built, [[BOB, { t: "choose", value: "confiscate" }]]);
  expect(rawPlayer(seized, BOB).city.map((d) => d.id)).toContain(builtId);
  expect(rawGold(seized, ANN)).toBe(20);
});
