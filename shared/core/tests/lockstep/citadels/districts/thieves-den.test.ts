import { expect, test } from "vitest";
import type { SeatId } from "../../../../index.ts";
import type { CharacterId } from "../../../../lockstep/games/citadels/index.ts";
import { specOfDistrict } from "../../../../lockstep/games/citadels/districts.ts";
import {
  thievesDen,
  thievesDenScoring,
  thievesDenTriggers,
} from "../../../../lockstep/games/citadels/districts/thieves-den.ts";
import { tryBuild } from "../../../../lockstep/games/citadels/helpers.ts";
import type {
  CitadelsState,
  Claim,
  PlacedDistrict,
  Window,
} from "../../../../lockstep/games/citadels/state.ts";
import {
  ANN,
  BASE_CAST_IDS,
  BOB,
  SEATS3,
  play,
  rawGenesis,
  rawGold,
  rawHand,
  rawPlayer,
  rawRandom,
  totalCards,
  withGold,
  withHand,
} from "../driver.ts";

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

const withCity = (
  state: CitadelsState,
  seat: SeatId,
  city: readonly PlacedDistrict[],
): CitadelsState => ({
  ...state,
  players: state.players.map((player) => (player.seat === seat ? { ...player, city } : player)),
});

/** ANN's turn window is open and the round closes beneath it. */
const turnState = (
  cast: readonly CharacterId[] = BASE_CAST_IDS,
  claimed: readonly Claim[] = [],
): CitadelsState => ({
  ...rawGenesis(SEATS3, cast),
  phase: "turn",
  draft: null,
  claimed,
  active: ANN,
  steps: [
    { kind: "window", window: { kind: "turn", purpose: "turn", seats: [ANN] } },
    { kind: "end-round" },
  ],
});

const cityOf = (state: CitadelsState, seat: SeatId): readonly PlacedDistrict[] =>
  rawPlayer(state, seat).city;

const topPurpose = (state: CitadelsState): string | null => {
  const top = state.steps[0];
  return top !== undefined && top.kind === "window" ? top.window.purpose : null;
};

const topWindow = (state: CitadelsState): Window => {
  const top = state.steps[0];
  if (top === undefined || top.kind !== "window") throw new Error("no open window");
  return top.window;
};

test("the Thieves' Den may be paid fully with cards from hand at 1 card = 1 gold", () => {
  // Den lists at 4; four spare cards beside it cover it with no gold spent.
  const state = withHand(withGold(turnState(), ANN, 0), ANN, [
    "thieves-den",
    "manor",
    "castle",
    "docks",
    "harbor",
  ]);
  const next = tryBuild(state, ANN, 0, rawRandom());
  expect(specOfDistrict("thieves-den").cost).toBe(4);
  expect(cityOf(next, ANN).map((district) => district.id)).toEqual(["thieves-den"]);
  expect(rawGold(next, ANN)).toBe(0);
  expect(rawHand(next, ANN)).toEqual([]);
  expect(next.discard).toEqual(["manor", "castle", "docks", "harbor"]);
  expect(totalCards(next)).toBe(totalCards(state));
});

test("gold is spent before cards: an affordable Den keeps the hand", () => {
  const state = withHand(withGold(turnState(), ANN, 10), ANN, ["thieves-den", "manor"]);
  const next = tryBuild(state, ANN, 0, rawRandom());
  expect(cityOf(next, ANN).map((district) => district.id)).toEqual(["thieves-den"]);
  expect(rawGold(next, ANN)).toBe(10 - specOfDistrict("thieves-den").cost);
  expect(rawHand(next, ANN)).toEqual(["manor"]);
});

test("a hand too thin to cover the Den in cards cannot pay, so the build is refused", () => {
  const state = withHand(withGold(turnState(), ANN, 0), ANN, ["thieves-den", "manor"]);
  const next = tryBuild(state, ANN, 0, rawRandom());
  expect(cityOf(next, ANN)).toEqual([]);
  expect(rawHand(next, ANN)).toEqual(["thieves-den", "manor"]);
  expect(rawGold(next, ANN)).toBe(0);
});

test("the card payment is card-specific: an ordinary district still needs gold", () => {
  const state = withHand(withGold(turnState(), ANN, 0), ANN, ["manor", "castle", "docks", "harbor"]);
  const next = tryBuild(state, ANN, 0, rawRandom());
  expect(cityOf(next, ANN)).toEqual([]);
  expect(rawHand(next, ANN)).toHaveLength(4);
});

test("a card-paid Den is confiscatable; the Magistrate takes it and the builder gets back only the gold share", () => {
  // rules.json (thieves-den): "If confiscated by the Magistrate, you receive back
  // only gold spent, not cards." The cost-4 Den is paid 2 gold + 2 cards, so the
  // gold share is 2. The Magistrate may take the district and the builder receives
  // back that 2 gold -- never the cost-4 total, never the two cards.
  const claimed: readonly Claim[] = [
    { seat: ANN, character: "merchant" },
    { seat: BOB, character: "magistrate" },
  ];
  const base: CitadelsState = {
    ...withHand(withGold(turnState(MAGISTRATE_CAST, claimed), ANN, 2), ANN, [
      "thieves-den",
      "manor",
      "castle",
    ]),
    warrants: ["merchant", "thief", "architect"],
  };
  const before = totalCards(base);
  const built = tryBuild(base, ANN, 0, rawRandom());
  expect(cityOf(built, ANN).map((district) => district.id)).toEqual(["thieves-den"]);
  expect(topPurpose(built)).toBe("magistrate-confiscate");
  expect(topWindow(built).seats).toEqual([BOB]);
  const seized = play(built, [[BOB, { t: "choose", value: "confiscate" }]]);
  expect(cityOf(seized, ANN)).toEqual([]);
  expect(cityOf(seized, BOB).map((district) => district.id)).toEqual(["thieves-den"]);
  // The gold share (2) comes back; the two cards spent are never returned.
  expect(rawGold(seized, ANN)).toBe(2);
  expect(rawHand(seized, ANN)).toEqual([]);
  expect(seized.discard).toEqual(["manor", "castle"]);
  expect(totalCards(seized)).toBe(before);
});

test("a gold-paid Den confiscated by the Magistrate returns the gold spent, nothing more", () => {
  const claimed: readonly Claim[] = [
    { seat: ANN, character: "merchant" },
    { seat: BOB, character: "magistrate" },
  ];
  const base: CitadelsState = {
    ...withHand(withGold(turnState(MAGISTRATE_CAST, claimed), ANN, 10), ANN, [
      "thieves-den",
      "manor",
    ]),
    warrants: ["merchant", "thief", "architect"],
  };
  const built = tryBuild(base, ANN, 0, rawRandom());
  expect(topPurpose(built)).toBe("magistrate-confiscate");
  expect(topWindow(built).seats).toEqual([BOB]);
  expect(rawGold(built, ANN)).toBe(10 - specOfDistrict("thieves-den").cost);
  const seized = play(built, [[BOB, { t: "choose", value: "confiscate" }]]);
  // The full cost was gold, so the whole spend comes back; no cards were ever at stake.
  expect(rawGold(seized, ANN)).toBe(10);
  expect(rawHand(seized, ANN)).toEqual(["manor"]);
});

test("the ability is not a no-op: a thin hand pays in cards where a plain build would fail", () => {
  const state = withHand(withGold(turnState(), ANN, 0), ANN, [
    "thieves-den",
    "manor",
    "castle",
    "docks",
    "harbor",
  ]);
  const next = tryBuild(state, ANN, 0, rawRandom());
  expect(cityOf(next, ANN)).toHaveLength(1);
  expect(next.discard.length).toBeGreaterThan(0);
});

test("the Thieves' Den scores no extra points and declares the onBuild trigger", () => {
  const city: readonly PlacedDistrict[] = [{ id: "thieves-den", gold: 0 }];
  expect(thievesDenScoring(city[0]!, city, ANN, turnState())).toBe(0);
  expect(thievesDenTriggers).toEqual(["onBuild"]);
  const state = turnState();
  expect(thievesDen({ state, owner: ANN, city: [], rest: [], rng: rawRandom() })).toBe(state);
});
