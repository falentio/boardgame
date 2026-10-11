import { afterEach, expect, test } from "vitest";
import type { SeatId } from "../../../index.ts";
import {
  specOfDistrict,
  typeOfPlaced,
  type BuildQuery,
  type DistrictHook,
  type DistrictId,
} from "../../../lockstep/games/citadels/districts.ts";
import {
  UNIQUE_BUILD,
  UNIQUE_EFFECTS,
  UNIQUE_SCORING,
  UNIQUE_TRIGGERS,
  type DistrictEffect,
  type DistrictScoring,
} from "../../../lockstep/games/citadels/districts/effects.ts";
import { tryBuild } from "../../../lockstep/games/citadels/helpers.ts";
import { scoreGame } from "../../../lockstep/games/citadels/scoring.ts";
import {
  stateCodec,
  type CitadelsState,
  type PlacedDistrict,
  type Step,
} from "../../../lockstep/games/citadels/state.ts";
import {
  ANN,
  BASE_CAST_IDS,
  SEATS3,
  advance,
  openPurpose,
  rawGenesis,
  rawGold,
  rawHand,
  rawPlayer,
  rawRandom,
  totalCards,
  withGold,
  withHand,
} from "./driver.ts";

const SNAPSHOT = {
  build: { ...UNIQUE_BUILD },
  triggers: { ...UNIQUE_TRIGGERS },
  effects: { ...UNIQUE_EFFECTS },
  scoring: { ...UNIQUE_SCORING },
};

afterEach(() => {
  Object.assign(UNIQUE_BUILD, SNAPSHOT.build);
  Object.assign(UNIQUE_TRIGGERS, SNAPSHOT.triggers);
  Object.assign(UNIQUE_EFFECTS, SNAPSHOT.effects);
  Object.assign(UNIQUE_SCORING, SNAPSHOT.scoring);
});

const withCity = (
  state: CitadelsState,
  seat: SeatId,
  city: readonly PlacedDistrict[],
): CitadelsState => ({
  ...state,
  players: state.players.map((player) => (player.seat === seat ? { ...player, city } : player)),
});

const cityOf = (state: CitadelsState, seat: SeatId): readonly PlacedDistrict[] =>
  rawPlayer(state, seat).city;

/** ANN's turn window is open; the round closes beneath it. */
const TURN_REST: readonly Step[] = [{ kind: "end-round" }];

const turnState = (): CitadelsState => ({
  ...rawGenesis(SEATS3, BASE_CAST_IDS),
  phase: "turn",
  draft: null,
  active: ANN,
  steps: [
    { kind: "window", window: { kind: "turn", purpose: "turn", seats: [ANN] } },
    ...TURN_REST,
  ],
});

const build = (state: CitadelsState, card: number): CitadelsState =>
  advance(state, () => ({ t: "build", card }));

test("UNIQUE_BUILD is total over the uniques, one function per id, defaulting to empty terms", () => {
    expect(Object.keys(UNIQUE_BUILD).sort()).toEqual(
      Object.keys(UNIQUE_TRIGGERS).sort(),
    );
    for (const id of Object.keys(UNIQUE_BUILD)) {
      expect(typeof UNIQUE_BUILD[id]).toBe("function");
    }
    // A stub row answers with no terms, so the engine's catalog defaults apply.
    expect(UNIQUE_BUILD["capitol"]!({ state: turnState(), seat: ANN, card: "capitol", city: [] })).toEqual({});
});

test("a district whose build query sets cost is charged that cost, not its catalog cost", () => {
  UNIQUE_BUILD["monument"] = () => ({ cost: 2 });
  const state = withHand(withGold(turnState(), ANN, 10), ANN, ["monument"]);
  const next = tryBuild(state, ANN, 0, rawRandom());
  expect(specOfDistrict("monument").cost).toBe(4);
  expect(rawGold(next, ANN)).toBe(8);
  expect(cityOf(next, ANN).map((d) => d.id)).toEqual(["monument"]);
});

test("a district whose build query forbids it cannot be built", () => {
  UNIQUE_BUILD["monument"] = () => ({ legal: false });
  const state = withHand(withGold(turnState(), ANN, 10), ANN, ["monument"]);
  const next = tryBuild(state, ANN, 0, rawRandom());
  expect(cityOf(next, ANN)).toEqual([]);
  expect(rawGold(next, ANN)).toBe(10);
  expect(rawHand(next, ANN)).toEqual(["monument"]);
});

test("the city folds before the card, so a city card discounts and the card overrides it", () => {
  UNIQUE_BUILD["capitol"] = () => ({ cost: 4 });
  const city = [{ id: "capitol", gold: 0 }];
  const discounted = withHand(withGold(withCity(turnState(), ANN, city), ANN, 10), ANN, ["dragon-gate"]);
  expect(rawGold(tryBuild(discounted, ANN, 0, rawRandom()), ANN)).toBe(10 - 4);

  UNIQUE_BUILD["dragon-gate"] = () => ({ cost: 1 });
  const overridden = withHand(withGold(withCity(turnState(), ANN, city), ANN, 10), ANN, ["dragon-gate"]);
  expect(rawGold(tryBuild(overridden, ANN, 0, rawRandom()), ANN)).toBe(10 - 1);
});

test("a build that does not count toward the limit leaves the counter and permits a second build", () => {
  // The query is card-aware: only the Stables' own build is non-counting.
  UNIQUE_BUILD["stables"] = (ctx) => (ctx.card === "stables" ? { countsAsBuild: false } : {});
  const state = withHand(withGold(turnState(), ANN, 10), ANN, ["stables", "tavern"]);
  const first = tryBuild(state, ANN, 0, rawRandom());
  expect(first.builtThisTurn).toBe(0);
  expect(cityOf(first, ANN).map((d) => d.id)).toEqual(["stables"]);
  const second = tryBuild(first, ANN, 0, rawRandom());
  expect(cityOf(second, ANN).map((d) => d.id)).toEqual(["stables", "tavern"]);
  expect(second.builtThisTurn).toBe(1);
});

test("a non-counting build reopens the turn window, and a counting build consumes the limit", () => {
  UNIQUE_BUILD["stables"] = (ctx) => (ctx.card === "stables" ? { countsAsBuild: false } : {});
  const state = withHand(withGold(turnState(), ANN, 10), ANN, ["stables", "tavern"]);
  const first = build(state, 0);
  expect(cityOf(first, ANN).map((d) => d.id)).toEqual(["stables"]);
  expect(openPurpose(first)).toBe("turn");
  const second = build(first, 0);
  expect(cityOf(second, ANN).map((d) => d.id)).toEqual(["stables", "tavern"]);
  // The limit is spent, so the turn closes and the round advances.
  expect(openPurpose(second)).not.toBe("turn");
});

test("a card-paid build takes its card share in cards and still owes the gold remainder", () => {
  const CARD_SHARE = 2;
  const GOLD_BEFORE = 10;
  UNIQUE_BUILD["thieves-den"] = () => ({ payCards: CARD_SHARE });
  const state = withHand(withGold(turnState(), ANN, GOLD_BEFORE), ANN, ["thieves-den", "manor", "castle"]);
  const next = tryBuild(state, ANN, 0, rawRandom());
  expect(cityOf(next, ANN).map((d) => d.id)).toEqual(["thieves-den"]);
  expect(rawGold(next, ANN)).toBe(GOLD_BEFORE - Math.max(0, specOfDistrict("thieves-den").cost - CARD_SHARE));
  expect(rawHand(next, ANN)).toEqual([]);
  expect(next.discard).toEqual(["manor", "castle"]);
  expect(totalCards(next)).toBe(totalCards(state));
});

test("a build that destroys instead of paying removes the named own district and no gold", () => {
  UNIQUE_BUILD["framework"] = () => ({ destroy: true });
  const state = withHand(
    withGold(withCity(turnState(), ANN, [{ id: "framework", gold: 0 }]), ANN, 10),
    ANN,
    ["dragon-gate"],
  );
  const next = tryBuild(state, ANN, 0, rawRandom());
  expect(cityOf(next, ANN).map((d) => d.id)).toEqual(["dragon-gate"]);
  expect(rawGold(next, ANN)).toBe(10);
  // The destroyed district sinks to the bottom of the deck, as the Warlord does.
  expect(next.deck[next.deck.length - 1]).toBe("framework");
  expect(totalCards(next)).toBe(totalCards(state));
});

test("a build that destroys nothing of its own is refused when the city is empty", () => {
  UNIQUE_BUILD["framework"] = () => ({ destroy: true });
  const state = withHand(withGold(turnState(), ANN, 10), ANN, ["framework"]);
  const next = tryBuild(state, ANN, 0, rawRandom());
  expect(cityOf(next, ANN)).toEqual([]);
  expect(rawHand(next, ANN)).toEqual(["framework"]);
});

test("a scorer receives the state and can read gold and hand", () => {
  UNIQUE_SCORING["map-room"] = (_district, _city, seat, state): number => {
    const player = state.players.find((entry) => entry.seat === seat);
    return (player?.gold ?? 0) + (player?.hand.length ?? 0);
  };
  const base = withHand(withGold(turnState(), ANN, 7), ANN, ["tavern", "market", "docks"]);
  const state = withCity(base, ANN, [{ id: "map-room", gold: 0 }]);
  const score = scoreGame(state).find((entry) => entry.seat === ANN);
  expect(score?.unique).toBe(10);
});

test("a district's attached cards and declared type round-trip through the codec", () => {
  const state = withCity(turnState(), ANN, [
    { id: "museum", gold: 0, cards: ["manor", "castle"] },
    { id: "haunted-quarter", gold: 0, declaredType: "noble" },
  ]);
  const decoded = stateCodec.decode(stateCodec.encode(state));
  expect(decoded).toEqual(state);
  const placed = decoded.players.find((player) => player.seat === ANN)?.city ?? [];
  expect(placed[0]?.cards).toEqual(["manor", "castle"]);
  expect(placed[1]?.declaredType).toBe("noble");
});

test("a placed district counts as its declared type, defaulting to its catalog type", () => {
  expect(typeOfPlaced({ id: "haunted-quarter", gold: 0 })).toBe("unique");
  expect(typeOfPlaced({ id: "haunted-quarter", gold: 0, declaredType: "noble" })).toBe("noble");
  expect(typeOfPlaced({ id: "manor", gold: 0 })).toBe("noble");
});

test("the colour count reads the declared type: a declared fifth colour drops the bonus", () => {
  const city: readonly PlacedDistrict[] = [
    { id: "manor", gold: 0 },
    { id: "temple", gold: 0 },
    { id: "tavern", gold: 0 },
    { id: "watchtower", gold: 0 },
    { id: "haunted-quarter", gold: 0 },
  ];
  const fiveColours = scoreGame(withCity(turnState(), ANN, city)).find((e) => e.seat === ANN);
  expect(fiveColours?.colors).toBe(3);
  const declared: readonly PlacedDistrict[] = city.map((district) =>
    district.id === "haunted-quarter" ? { ...district, declaredType: "noble" as const } : district,
  );
  const fourColours = scoreGame(withCity(turnState(), ANN, declared)).find((e) => e.seat === ANN);
  expect(fourColours?.colors).toBe(0);
});

test("the character's limit is enforced: the Trader is unlimited for trade, capped elsewhere", () => {
  const traderState: CitadelsState = {
    ...turnState(),
    claimed: [{ seat: ANN, character: "trader" }],
  };
  const trade = withHand(withGold(traderState, ANN, 20), ANN, ["tavern", "market", "docks"]);
  const first = build(trade, 0);
  const second = build(first, 0);
  const third = build(second, 0);
  expect(cityOf(third, ANN).map((d) => d.id)).toEqual(["tavern", "market", "docks"]);
  expect(openPurpose(third)).toBe("turn");

  // The Trader's allowance is trade-only: a non-trade build consumes the limit.
  const noble = withHand(withGold(traderState, ANN, 20), ANN, ["manor", "castle"]);
  const one = build(noble, 0);
  expect(cityOf(one, ANN).map((d) => d.id)).toEqual(["manor"]);
  const two = build(one, 0);
  expect(cityOf(two, ANN).map((d) => d.id)).toEqual(["manor"]);
});

test("the Architect's limit of three is enforced by the counter, not the window count", () => {
  const architectState: CitadelsState = {
    ...turnState(),
    claimed: [{ seat: ANN, character: "architect" }],
    steps: [
      { kind: "window", window: { kind: "turn", purpose: "turn", seats: [ANN] } },
      { kind: "window", window: { kind: "turn", purpose: "turn", seats: [ANN] } },
      { kind: "window", window: { kind: "turn", purpose: "turn", seats: [ANN] } },
      ...TURN_REST,
    ],
  };
  const state = withHand(withGold(architectState, ANN, 20), ANN, ["tavern", "market", "docks", "harbor"]);
  const first = build(state, 0);
  const second = build(first, 0);
  const third = build(second, 0);
  expect(cityOf(third, ANN).map((d) => d.id)).toEqual(["tavern", "market", "docks"]);
  const fourth = build(third, 0);
  expect(cityOf(fourth, ANN)).toHaveLength(3);
});

const observatoryDraw: DistrictEffect = (ctx) => ({
  ...ctx.state,
  pending:
    ctx.state.pending === null ? null : { ...ctx.state.pending, amount: 3, gold: 1 },
});

const libraryKeepBoth: DistrictEffect = (ctx) => ({
  ...ctx.state,
  pending:
    ctx.state.pending === null
      ? null
      : { ...ctx.state.pending, gold: ctx.state.pending.amount },
});

const drawOn = (id: DistrictId, effect: DistrictEffect, triggers: readonly DistrictHook[]): void => {
  UNIQUE_TRIGGERS[id] = triggers;
  UNIQUE_EFFECTS[id] = effect;
};

test("the gather-draw hook draws three and keeps one for an Observatory-shaped district", () => {
  drawOn("observatory", observatoryDraw, ["onDraw"]);
  const state = withCity(withHand(turnState(), ANN, ["tavern"]), ANN, [{ id: "observatory", gold: 0 }]);
  const drawn = advance(state, () => ({ t: "draw" }));
  expect(openPurpose(drawn)).toBe("keep");
  expect(drawn.pending?.cards).toHaveLength(3);
  expect(drawn.deck).toHaveLength(state.deck.length - 3);
  const kept = advance(drawn, () => ({ t: "keep", index: 0 }));
  expect(rawHand(kept, ANN)).toHaveLength(2);
  expect(totalCards(kept)).toBe(totalCards(state));
});

test("the gather-draw hook keeps both cards for a Library-shaped district", () => {
  drawOn("library", libraryKeepBoth, ["onDraw"]);
  const state = withCity(withHand(turnState(), ANN, ["tavern"]), ANN, [{ id: "library", gold: 0 }]);
  const drawn = advance(state, () => ({ t: "draw" }));
  expect(drawn.pending?.cards).toHaveLength(2);
  const kept = advance(drawn, () => ({ t: "keep", index: 0 }));
  expect(rawHand(kept, ANN)).toHaveLength(3);
  expect(totalCards(kept)).toBe(totalCards(state));
});

test("the gather-draw hook is not called on a gold gather", () => {
  let calls = 0;
  const counting: DistrictEffect = (ctx) => {
    calls += 1;
    return ctx.state;
  };
  drawOn("observatory", counting, ["onDraw"]);
  const state = withCity(withHand(turnState(), ANN, ["tavern"]), ANN, [{ id: "observatory", gold: 0 }]);
  advance(state, () => ({ t: "gold" }));
  expect(calls).toBe(0);
});
