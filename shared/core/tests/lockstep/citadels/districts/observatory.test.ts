import { expect, test } from "vitest";
import type { SeatId } from "../../../../index.ts";
import {
  observatory,
  observatoryScoring,
  observatoryTriggers,
} from "../../../../lockstep/games/citadels/districts/observatory.ts";
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

const OBSERVATORY: PlacedDistrict = { id: "observatory", gold: 0 };

test("when you choose to draw cards while gathering, you draw three and keep one", () => {
  const state = withHand(turnState([OBSERVATORY]), ANN, ["tavern"]);
  const drawn = advance(state, () => ({ t: "draw" }));
  expect(openPurpose(drawn)).toBe("keep");
  expect(drawn.pending?.cards).toHaveLength(3);
  expect(drawn.deck).toHaveLength(state.deck.length - 3);
  const kept = advance(drawn, () => ({ t: "keep", index: 0 }));
  // One card was already in hand; exactly one of the three joins it.
  expect(rawHand(kept, ANN)).toHaveLength(2);
  expect(kept.discard).toHaveLength(2);
  expect(totalCards(kept)).toBe(totalCards(state));
});

test("the kept card is the one named by the keep index; the other two are discarded", () => {
  const state = withHand(turnState([OBSERVATORY]), ANN, ["tavern"]);
  const drawn = advance(state, () => ({ t: "draw" }));
  const pool = drawn.pending?.cards ?? [];
  expect(pool).toHaveLength(3);
  const kept = advance(drawn, () => ({ t: "keep", index: 1 }));
  expect(rawHand(kept, ANN)).toEqual(["tavern", pool[1]]);
  expect(kept.discard).toEqual([pool[0], pool[2]]);
});

test("without the Observatory the gather draws only two", () => {
  const state = withHand(turnState([]), ANN, ["tavern"]);
  const drawn = advance(state, () => ({ t: "draw" }));
  expect(drawn.pending?.cards).toHaveLength(2);
});

test("the Observatory fires only on a card draw: choosing gold is untouched", () => {
  const state = withGold(withHand(turnState([OBSERVATORY]), ANN, ["tavern"]), ANN, 2);
  const next = advance(state, () => ({ t: "gold" }));
  expect(rawGold(next, ANN)).toBe(4);
  expect(rawHand(next, ANN)).toEqual(["tavern"]);
});

test("the Observatory declares the onDraw trigger", () => {
  expect(observatoryTriggers).toEqual(["onDraw"]);
});

test("the effect reads the draw count off pending and raises it to three, keeping one", () => {
  const state: CitadelsState = {
    ...turnState([OBSERVATORY]),
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
  const next = observatory({ state, owner: ANN, city: [OBSERVATORY], rest: [], rng: rawRandom() });
  expect(next.pending?.amount).toBe(3);
  expect(next.pending?.gold).toBe(1);
});

test("the effect is not a no-op: it deals one more card than a bare gather", () => {
  const withObs = advance(withHand(turnState([OBSERVATORY]), ANN, ["tavern"]), () => ({ t: "draw" }));
  const bare = advance(withHand(turnState([]), ANN, ["tavern"]), () => ({ t: "draw" }));
  expect((withObs.pending?.cards.length ?? 0) - (bare.pending?.cards.length ?? 0)).toBe(1);
});

test("the Observatory scores no extra points on a crafted city", () => {
  const city: readonly PlacedDistrict[] = [OBSERVATORY, { id: "watchtower", gold: 0 }];
  expect(observatoryScoring(city[0]!, city, ANN, turnState([]))).toBe(0);
  const state = withCity(
    { ...rawGenesis(SEATS3, BASE_CAST_IDS), completed: [ANN] },
    ANN,
    [...city],
  );
  const score = scoreGame(state).find((entry) => entry.seat === ANN);
  // Cost sum only: 5 + 1; the Observatory adds nothing at end of game.
  expect(score?.districts).toBe(6);
  expect(score?.unique).toBe(0);
});
