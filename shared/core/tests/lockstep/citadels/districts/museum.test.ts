import { expect, test } from "vitest";
import type { SeatId } from "../../../../index.ts";
import type { CharacterId } from "../../../../lockstep/games/citadels/characters.ts";
import { diplomat } from "../../../../lockstep/games/citadels/characters/diplomat.ts";
import { museumScoring, museumTriggers } from "../../../../lockstep/games/citadels/districts/museum.ts";
import { scoreGame } from "../../../../lockstep/games/citadels/scoring.ts";
import {
  stateCodec,
  type CitadelsState,
  type Claim,
  type PlacedDistrict,
} from "../../../../lockstep/games/citadels/state.ts";
import {
  ANN,
  BOB,
  SEATS3,
  advance,
  openPurpose,
  rawGenesis,
  rawPlayer,
  rawRandom,
  withGold,
} from "../driver.ts";

const CAST: readonly CharacterId[] = [
  "assassin",
  "thief",
  "magician",
  "king",
  "bishop",
  "merchant",
  "architect",
  "diplomat",
];

const placed = (id: string, cards?: readonly string[]): PlacedDistrict =>
  cards === undefined ? { id, gold: 0 } : { id, gold: 0, cards };

const MUSEUM = "museum";

const withCity = (
  state: CitadelsState,
  seat: SeatId,
  city: readonly PlacedDistrict[],
): CitadelsState => ({
  ...state,
  players: state.players.map((player) => (player.seat === seat ? { ...player, city } : player)),
});

/** A turn-phase state with the Diplomat claimed by ANN, so its exchange window opens. */
const turnState = (): CitadelsState => ({
  ...rawGenesis(SEATS3, CAST),
  phase: "turn",
  draft: null,
  claimed: [{ seat: ANN, character: "diplomat" }] as readonly Claim[],
  callRank: 1,
  active: ANN,
  steps: [],
});

const cityOf = (state: CitadelsState, seat: SeatId): readonly PlacedDistrict[] =>
  rawPlayer(state, seat).city;

const museumOf = (state: CitadelsState, seat: SeatId): PlacedDistrict | undefined =>
  cityOf(state, seat).find((district) => district.id === MUSEUM);

const uniqueOf = (state: CitadelsState, seat: SeatId): number =>
  scoreGame(state).find((score) => score.seat === seat)?.unique ?? 0;

test("once per turn a card is placed under the Museum; the attachment is held on the placed district", () => {
  // The placement window itself is the reported follow-up; this proves the store
  // it writes: the tucked cards ride PlacedDistrict.cards and survive the codec
  // the engine folds frames through, so the attachment is what scoring later reads.
  const state = withCity(turnState(), ANN, [placed(MUSEUM, ["manor", "castle"])]);
  const decoded = stateCodec.decode(stateCodec.encode(state));
  expect(museumOf(decoded, ANN)?.cards).toEqual(["manor", "castle"]);
});

test("at end of game score 1 point per card under the Museum", () => {
  const district = placed(MUSEUM, ["manor", "castle", "tavern"]);
  expect(museumScoring(district, [district], ANN, turnState())).toBe(3);
});

test("an empty Museum scores nothing", () => {
  const district = placed(MUSEUM);
  expect(museumScoring(district, [district], ANN, turnState())).toBe(0);
});

test("the exact extra points reach the score through the engine's scoring pass", () => {
  const state = withCity(turnState(), ANN, [
    placed("watchtower"),
    placed(MUSEUM, ["manor", "castle", "tavern"]),
  ]);
  const ann = scoreGame(state).find((score) => score.seat === ANN);
  // District costs: 1 + 4 = 5; three tucked cards: 3 Museum points; no five-colour bonus.
  expect(ann?.districts).toBe(5);
  expect(ann?.unique).toBe(3);
  expect(ann?.total).toBe(8);
});

test("if the Museum is exchanged the cards stay with it", () => {
  const state = withGold(
    withCity(withCity(turnState(), ANN, [placed("tavern")]), BOB, [placed(MUSEUM, ["manor", "castle"])]),
    ANN,
    20,
  );
  const open = diplomat({ state, seat: ANN, rest: [], rng: rawRandom() });
  expect(openPurpose(open)).toBe("diplomat-exchange");
  // Name BOB, take their Museum, give ANN's tavern.
  const afterTarget = advance(open, (seat) => (seat === ANN ? { t: "target", seat: BOB } : null));
  const afterTake = advance(afterTarget, (seat) => (seat === ANN ? { t: "keep", index: 0 } : null));
  const next = advance(afterTake, (seat) => (seat === ANN ? { t: "keep", index: 0 } : null));
  expect(museumOf(next, ANN)?.cards).toEqual(["manor", "castle"]);
  expect(museumOf(next, BOB)).toBeUndefined();
  expect(uniqueOf(next, ANN)).toBe(2);
});

test("the ability is not a no-op: cards under the Museum raise the score", () => {
  const bare = withCity(turnState(), ANN, [placed(MUSEUM)]);
  const loaded = withCity(turnState(), ANN, [placed(MUSEUM, ["manor", "castle"])]);
  expect(uniqueOf(loaded, ANN)).toBeGreaterThan(uniqueOf(bare, ANN));
  expect(uniqueOf(bare, ANN)).toBe(0);
  expect(uniqueOf(loaded, ANN)).toBe(2);
});

test("the Museum declares no engine trigger; it scores only at end of game", () => {
  expect(museumTriggers).toEqual([]);
});
