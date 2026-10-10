import { expect, test } from "vitest";
import type { SeatId } from "../../../../index.ts";
import { specOfDistrict } from "../../../../lockstep/games/citadels/districts.ts";
import {
  secretVault,
  secretVaultScoring,
  secretVaultTriggers,
} from "../../../../lockstep/games/citadels/districts/secret-vault.ts";
import { tryBuild } from "../../../../lockstep/games/citadels/helpers.ts";
import { scoreGame } from "../../../../lockstep/games/citadels/scoring.ts";
import type { CitadelsState, PlacedDistrict } from "../../../../lockstep/games/citadels/state.ts";
import {
  ANN,
  BASE_CAST_IDS,
  SEATS3,
  rawGenesis,
  rawGold,
  rawHand,
  rawPlayer,
  rawRandom,
  withGold,
  withHand,
} from "../driver.ts";

const placed = (id: string): PlacedDistrict => ({ id, gold: 0 });

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

const cityOf = (state: CitadelsState, seat: SeatId): readonly PlacedDistrict[] =>
  rawPlayer(state, seat).city;

const FOUR_DISTRICTS: readonly PlacedDistrict[] = [
  placed("watchtower"),
  placed("prison"),
  placed("temple"),
  placed("tavern"),
];

test("the Secret Vault cannot be built, and stays in hand with no gold spent", () => {
  for (const city of [[], FOUR_DISTRICTS]) {
    const state = withHand(withGold(turnState(city), ANN, 10), ANN, ["secret-vault"]);
    const next = tryBuild(state, ANN, 0, rawRandom());
    expect(cityOf(next, ANN)).toHaveLength(city.length);
    expect(rawHand(next, ANN)).toEqual(["secret-vault"]);
    expect(rawGold(next, ANN)).toBe(10);
  }
});

test("the refusal is card-specific: an ordinary district in the same hand still builds", () => {
  const state = withHand(withGold(turnState([]), ANN, 10), ANN, ["tavern"]);
  const next = tryBuild(state, ANN, 0, rawRandom());
  expect(cityOf(next, ANN).map((district) => district.id)).toEqual(["tavern"]);
  expect(rawGold(next, ANN)).toBe(10 - specOfDistrict("tavern").cost);
});

test("the Secret Vault scores exactly 3 extra points while it is still in your hand", () => {
  const held = withHand(rawGenesis(SEATS3, BASE_CAST_IDS), ANN, ["secret-vault", "tavern"]);
  expect(secretVaultScoring(placed("secret-vault"), [], ANN, held)).toBe(3);
});

test("the scorer pays nothing once the vault has left the hand", () => {
  const spent = withHand(rawGenesis(SEATS3, BASE_CAST_IDS), ANN, ["tavern"]);
  expect(secretVaultScoring(placed("secret-vault"), [], ANN, spent)).toBe(0);
});

test("the exact extra points reach the score through the engine's scoring pass", () => {
  // The engine folds the uniques standing in a city, so the vault is seated
  // there for this pass; its points still come from the state's hand, which is
  // the clause under test. (See the unit report: scoring.ts must also fold the
  // uniques in hand for a real game to reach a held vault.)
  const city: readonly PlacedDistrict[] = [placed("secret-vault")];
  const held = withHand(withCity(rawGenesis(SEATS3, BASE_CAST_IDS), ANN, city), ANN, [
    "secret-vault",
  ]);
  const heldScore = scoreGame(held).find((score) => score.seat === ANN);
  expect(heldScore?.unique).toBe(3);

  const spent = withHand(withCity(rawGenesis(SEATS3, BASE_CAST_IDS), ANN, city), ANN, ["tavern"]);
  const spentScore = scoreGame(spent).find((score) => score.seat === ANN);
  expect(spentScore?.unique).toBe(0);
});

test("the ability is not a no-op: the build is refused and a held vault scores more than zero", () => {
  const refused = tryBuild(
    withHand(withGold(turnState([]), ANN, 10), ANN, ["secret-vault"]),
    ANN,
    0,
    rawRandom(),
  );
  expect(cityOf(refused, ANN)).toEqual([]);
  const held = withHand(rawGenesis(SEATS3, BASE_CAST_IDS), ANN, ["secret-vault"]);
  expect(secretVaultScoring(placed("secret-vault"), [], ANN, held)).toBeGreaterThan(0);
});

test("the Secret Vault declares the onBuild trigger and its in-play effect is a no-op", () => {
  expect(secretVaultTriggers).toEqual(["onBuild"]);
  const state = turnState([]);
  expect(secretVault({ state, owner: ANN, city: [], rest: [], rng: rawRandom() })).toBe(state);
});
