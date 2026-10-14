import { expect, test } from "vitest";
import type { SeatId } from "../../../../../index.ts";
import { specOfDistrict } from "../../../../../lockstep/games/citadels/districts.ts";
import { ivoryTowerScoring } from "../../../../../lockstep/games/citadels/districts/ivory-tower.ts";
import { scoreGame } from "../../../../../lockstep/games/citadels/scoring.ts";
import type { CitadelsState, PlacedDistrict } from "../../../../../lockstep/games/citadels/state.ts";
import { ANN, SEATS3, rawGenesis, withHand } from "../../driver.ts";

/**
 * The three scoring rules the independent verifier's D2, D3, and D12 name. Each
 * test pins the rule through \`scoreGame\` so a regression in the shared scorer
 * fails here, not only in the counterexamples.
 */

const withCity = (
  state: CitadelsState,
  seat: SeatId,
  city: readonly PlacedDistrict[],
): CitadelsState => ({
  ...state,
  players: state.players.map((player) => (player.seat === seat ? { ...player, city } : player)),
});

const annScore = (state: CitadelsState) => scoreGame(state).find((row) => row.seat === ANN);

const IVORY: PlacedDistrict = { id: "ivory-tower", gold: 0 };

test("D2: a beautified district adds its gold marker to the cost sum", () => {
  const base = rawGenesis(SEATS3);
  expect(specOfDistrict("manor").cost).toBe(3);
  expect(annScore(withCity(base, ANN, [{ id: "manor", gold: 0 }]))?.districts).toBe(3);
  expect(annScore(withCity(base, ANN, [{ id: "manor", gold: 1 }]))?.districts).toBe(4);
  // The marker is permanent gold on the card, so two markers add two.
  expect(annScore(withCity(base, ANN, [{ id: "manor", gold: 2 }]))?.districts).toBe(5);
});

test("D3: a Secret Vault still in hand scores three, a hand without it scores none", () => {
  const base = rawGenesis(SEATS3);
  expect(annScore(withHand(base, ANN, ["secret-vault", "tavern"]))?.unique).toBe(3);
  expect(annScore(withHand(base, ANN, ["tavern", "market"]))?.unique).toBe(0);
});

test("D12: an undeclared Haunted Quarter is still unique and blocks the Ivory Tower", () => {
  const base = rawGenesis(SEATS3);
  const undeclared: readonly PlacedDistrict[] = [IVORY, { id: "haunted-quarter", gold: 0 }];
  const declaredNoble: readonly PlacedDistrict[] = [
    IVORY,
    { id: "haunted-quarter", gold: 0, declaredType: "noble" },
  ];
  const declaredUnique: readonly PlacedDistrict[] = [
    IVORY,
    { id: "haunted-quarter", gold: 0, declaredType: "unique" },
  ];
  // Undeclared, the Haunted Quarter reports its catalog type unique, so the tower
  // is not the city's only unique district and scores nothing.
  expect(ivoryTowerScoring(IVORY, undeclared, ANN)).toBe(0);
  expect(annScore(withCity(base, ANN, undeclared))?.unique).toBe(0);
  // Declared a non-unique type, it no longer counts as unique and the tower scores.
  expect(ivoryTowerScoring(IVORY, declaredNoble, ANN)).toBe(5);
  expect(annScore(withCity(base, ANN, declaredNoble))?.unique).toBe(5);
  // Declared unique, it is a second unique and the tower scores nothing.
  expect(ivoryTowerScoring(IVORY, declaredUnique, ANN)).toBe(0);
  expect(annScore(withCity(base, ANN, declaredUnique))?.unique).toBe(0);
});
