import { expect, test } from "vitest";
import type { SeatId } from "../../../../index.ts";
import { specOfDistrict } from "../../../../lockstep/games/citadels/districts.ts";
import {
  secretVault,
  secretVaultBuild,
  secretVaultScoring,
  secretVaultTriggers,
} from "../../../../lockstep/games/citadels/districts/secret-vault.ts";
import { scoreGame } from "../../../../lockstep/games/citadels/scoring.ts";
import { tryBuild } from "../../../../lockstep/games/citadels/helpers.ts";
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
  rawPlayer,
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

/** ANN's turn window is open, the round closes beneath it. */
const turnState = (): CitadelsState => ({
  ...rawGenesis(SEATS3, BASE_CAST_IDS),
  phase: "turn",
  draft: null,
  active: ANN,
  steps: [
    { kind: "window", window: { kind: "turn", purpose: "turn", seats: [ANN] } },
    { kind: "end-round" },
  ],
});

const VAULT: PlacedDistrict = { id: "secret-vault", gold: 0 };

const cityOf = (state: CitadelsState, seat: SeatId): readonly PlacedDistrict[] =>
  rawPlayer(state, seat).city;

test("the Secret Vault cannot be built: the build is refused with the card still in hand", () => {
  const state = withHand(withGold(turnState(), ANN, 10), ANN, ["secret-vault"]);
  const next = tryBuild(state, ANN, 0, rawRandom());
  expect(cityOf(next, ANN)).toEqual([]);
  expect(rawHand(next, ANN)).toEqual(["secret-vault"]);
  expect(rawGold(next, ANN)).toBe(10);
  expect(totalCards(next)).toBe(totalCards(state));
});

test("the refusal holds through the turn window, even with the gold to pay", () => {
  const state = withHand(withGold(turnState(), ANN, 10), ANN, ["secret-vault"]);
  // The build answer performs the turn's mandatory gather first (commit 64420ca):
  // +2 gold, then the refused build ends the turn.
  const next = advance(state, () => ({ t: "build", card: 0 }));
  expect(cityOf(next, ANN)).toEqual([]);
  expect(rawHand(next, ANN)).toEqual(["secret-vault"]);
  expect(rawGold(next, ANN)).toBe(10 + 2);
  expect(openPurpose(next)).not.toBe("turn");
});

test("the build gate is the Secret Vault's own card: it never gates another build", () => {
  const state = withHand(withGold(turnState(), ANN, 10), ANN, ["tavern"]);
  const next = tryBuild(state, ANN, 0, rawRandom());
  expect(cityOf(next, ANN).map((district) => district.id)).toEqual(["tavern"]);
  expect(rawGold(next, ANN)).toBe(10 - specOfDistrict("tavern").cost);
});

test("score three extra points when the Secret Vault is still in hand at end of game", () => {
  const state = withHand(turnState(), ANN, ["secret-vault", "tavern"]);
  expect(secretVaultScoring(VAULT, [], ANN, state)).toBe(3);
});

test("score nothing when the Secret Vault is not in hand", () => {
  const state = withHand(turnState(), ANN, ["tavern", "market"]);
  expect(secretVaultScoring(VAULT, [], ANN, state)).toBe(0);
  const empty = withHand(turnState(), ANN, []);
  expect(secretVaultScoring(VAULT, [], ANN, empty)).toBe(0);
});

test("the exact extra points reach the score through the engine's scoring pass", () => {
  // The engine folds the uniques standing in a city, so the vault is seated there
  // for this pass; its points still come from the state's hand, which is the
  // clause under test. (See the unit report: scoring.ts must also fold the uniques
  // in hand for a real game to reach a held vault.)
  const city: readonly PlacedDistrict[] = [VAULT];
  const held = withHand(withCity(turnState(), ANN, city), ANN, ["secret-vault"]);
  const heldScore = scoreGame(held).find((entry) => entry.seat === ANN);
  expect(heldScore?.unique).toBe(3);
  const spent = withHand(withCity(turnState(), ANN, city), ANN, ["tavern"]);
  const spentScore = scoreGame(spent).find((entry) => entry.seat === ANN);
  expect(spentScore?.unique).toBe(0);
  expect(specOfDistrict("secret-vault").cost).toBe(4);
});

test("the Secret Vault declares the onBuild trigger and its build query is a real gate", () => {
  expect(secretVaultTriggers).toEqual(["onBuild"]);
  // A no-op query would answer {} and let the build through; this one refuses it.
  expect(secretVaultBuild({ state: turnState(), seat: ANN, card: "secret-vault", city: [] })).toEqual({
    legal: false,
  });
  expect(secretVaultBuild({ state: turnState(), seat: ANN, card: "tavern", city: [] })).toEqual({});
});

test("the effect is not a no-op: the same gold builds a Tavern but never the Secret Vault", () => {
  const withVault = withHand(withGold(turnState(), ANN, 10), ANN, ["secret-vault"]);
  const withTavern = withHand(withGold(turnState(), ANN, 10), ANN, ["tavern"]);
  expect(rawHand(tryBuild(withVault, ANN, 0, rawRandom()), ANN)).toEqual(["secret-vault"]);
  expect(rawHand(tryBuild(withTavern, ANN, 0, rawRandom()), ANN)).toEqual([]);
  // The effect body itself is inert: its rule lives in the build query and the scorer.
  expect(
    secretVault({ state: withVault, owner: ANN, city: cityOf(withVault, ANN), rest: [], rng: rawRandom() }),
  ).toEqual(withVault);
});
