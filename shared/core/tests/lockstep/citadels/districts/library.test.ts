import { expect, test } from "vitest";
import type { SeatId } from "../../../../index.ts";
import {
  library,
  libraryScoring,
  libraryTriggers,
} from "../../../../lockstep/games/citadels/districts/library.ts";
import { scoreGame } from "../../../../lockstep/games/citadels/scoring.ts";
import type { CitadelsState, PlacedDistrict } from "../../../../lockstep/games/citadels/state.ts";
import {
  ANN,
  BASE_CAST_IDS,
  SEATS3,
  advance,
  openPurpose,
  rawGenesis,
  rawGold,
  rawHand,
  rawRandom,
  totalCards,
  withGold,
  withHand,
} from "../driver.ts";

const withCity = (
  state: CitadelsState,
  seat: SeatId,
  city: readonly PlacedDistrict[],
): CitadelsState => ({
  ...state,
  players: state.players.map((player) => (player.seat === seat ? { ...player, city } : player)),
});

/** ANN's turn window is open and the round closes beneath it. */
const turnState = (city: readonly PlacedDistrict[]): CitadelsState =>
  withCity(
    {
      ...rawGenesis(SEATS3, BASE_CAST_IDS),
      phase: "turn",
      draft: null,
      active: ANN,
      steps: [
        { kind: "window", window: { kind: "turn", purpose: "turn", seats: [ANN] } },
        { kind: "end-round" },
      ],
    },
    ANN,
    city,
  );

const LIBRARY: PlacedDistrict = { id: "library", gold: 0 };

const drawAndKeep = (state: CitadelsState): CitadelsState =>
  advance(advance(state, () => ({ t: "draw" })), () => ({ t: "keep", index: 0 }));

test("when you choose to draw cards while gathering, you keep both cards you drew", () => {
  const state = withHand(turnState([LIBRARY]), ANN, ["tavern"]);
  const drawn = advance(state, () => ({ t: "draw" }));
  expect(openPurpose(drawn)).toBe("keep");
  expect(drawn.pending?.cards).toHaveLength(2);
  const kept = advance(drawn, () => ({ t: "keep", index: 0 }));
  // One card was already in hand; both drawn cards join it.
  expect(rawHand(kept, ANN)).toHaveLength(3);
  expect(kept.discard).toEqual([]);
  expect(totalCards(kept)).toBe(totalCards(state));
});

test("without the Library the gather keeps only one of the two drawn cards", () => {
  const state = withHand(turnState([]), ANN, ["tavern"]);
  const kept = drawAndKeep(state);
  expect(rawHand(kept, ANN)).toHaveLength(2);
  // The unkept card came from the hidden deck, so it sinks to the deck's bottom
  // rather than the public discard, where another seat could identify it.
  expect(kept.discard).toHaveLength(0);
  expect(kept.deck).toHaveLength(state.deck.length - 1);
});

test("the Library fires only on a card draw: choosing gold is untouched", () => {
  const state = withGold(withHand(turnState([LIBRARY]), ANN, ["tavern"]), ANN, 2);
  const next = advance(state, () => ({ t: "gold" }));
  expect(rawGold(next, ANN)).toBe(4);
  expect(rawHand(next, ANN)).toEqual(["tavern"]);
});

test("the Library declares the onDraw trigger", () => {
  expect(libraryTriggers).toEqual(["onDraw"]);
});

test("the effect reads the draw count off pending and raises the keep count to it", () => {
  const state: CitadelsState = {
    ...turnState([LIBRARY]),
    pending: {
      actor: ANN,
      character: null,
      target: null,
      namedCharacter: null,
      namedType: null,
      cards: [],
      gold: 1,
      amount: 2,
      note: null,
    },
  };
  const next = library({ state, owner: ANN, city: [LIBRARY], rest: [], rng: rawRandom() });
  expect(next.pending?.gold).toBe(2);
  expect(next.pending?.amount).toBe(2);
});

test("the effect is not a no-op: it keeps one more card than a bare gather", () => {
  const keptWith = rawHand(drawAndKeep(withHand(turnState([LIBRARY]), ANN, ["tavern"])), ANN);
  const keptBare = rawHand(drawAndKeep(withHand(turnState([]), ANN, ["tavern"])), ANN);
  expect(keptWith.length - keptBare.length).toBe(1);
});

test("the Library scores no extra points on a crafted city", () => {
  const city: readonly PlacedDistrict[] = [LIBRARY, { id: "watchtower", gold: 0 }];
  expect(libraryScoring(city[0]!, city, ANN, turnState([]))).toBe(0);
  const state = withCity(
    { ...rawGenesis(SEATS3, BASE_CAST_IDS), completed: [ANN] },
    ANN,
    [...city],
  );
  const score = scoreGame(state).find((entry) => entry.seat === ANN);
  // Cost sum only: 6 + 1; the Library adds nothing at end of game.
  expect(score?.districts).toBe(7);
  expect(score?.unique).toBe(0);
});
