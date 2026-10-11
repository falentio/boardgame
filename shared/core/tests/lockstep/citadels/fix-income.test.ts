import { expect, test } from "vitest";
import { act, idle, type SeatId } from "../../../index.ts";
import type { CharacterId } from "../../../lockstep/games/citadels/characters.ts";
import { abbot, abbotResolve } from "../../../lockstep/games/citadels/characters/abbot.ts";
import { bishop } from "../../../lockstep/games/citadels/characters/bishop.ts";
import { cardinal } from "../../../lockstep/games/citadels/characters/cardinal.ts";
import { diplomat } from "../../../lockstep/games/citadels/characters/diplomat.ts";
import { king } from "../../../lockstep/games/citadels/characters/king.ts";
import { marshal } from "../../../lockstep/games/citadels/characters/marshal.ts";
import { merchant } from "../../../lockstep/games/citadels/characters/merchant.ts";
import { patrician } from "../../../lockstep/games/citadels/characters/patrician.ts";
import type {
  CitadelsAction,
  CitadelsState,
  PlacedDistrict,
  Window,
} from "../../../lockstep/games/citadels/state.ts";
import {
  ANN,
  BASE_CAST_IDS,
  SEATS3,
  rawFrame,
  rawGenesis,
  rawGold,
  rawHand,
  rawPlayer,
  rawRandom,
} from "./driver.ts";

/**
 * D9: every income counter must read \`typeOfPlaced\`, so a district whose owner
 * declared a type (School of Magic, Haunted Quarter) counts for that type. One
 * assertion per affected character.
 */

const CAST_DIPLOMAT: readonly CharacterId[] = [
  "assassin",
  "thief",
  "magician",
  "king",
  "bishop",
  "merchant",
  "architect",
  "diplomat",
];

const CAST_MARSHAL: readonly CharacterId[] = [
  "assassin",
  "thief",
  "magician",
  "king",
  "bishop",
  "merchant",
  "architect",
  "marshal",
];

const declared = (id: string, declaredType: PlacedDistrict["declaredType"]): PlacedDistrict => ({
  id,
  gold: 0,
  declaredType,
});

const withCity = (
  state: CitadelsState,
  seat: SeatId,
  city: readonly PlacedDistrict[],
): CitadelsState => ({
  ...state,
  players: state.players.map((p) => (p.seat === seat ? { ...p, city } : p)),
});

const claimed = (state: CitadelsState, character: CharacterId): CitadelsState => ({
  ...state,
  claimed: [{ seat: ANN, character }],
});

const incomeState = (
  character: CharacterId,
  city: readonly PlacedDistrict[],
  cast: readonly CharacterId[] = BASE_CAST_IDS,
): CitadelsState => withCity(claimed(rawGenesis(SEATS3, cast), character), ANN, city);

const effectCtx = (state: CitadelsState) => ({ state, seat: ANN, rest: [], rng: rawRandom() });

const openWindow = (state: CitadelsState): Window => {
  const top = state.steps[0];
  if (top === undefined || top.kind !== "window") throw new Error("no open window");
  return top.window;
};

const resolveAbbot = (state: CitadelsState, action: CitadelsAction | null): CitadelsState =>
  abbotResolve({
    state,
    window: openWindow(state),
    frame: rawFrame(0, [[ANN, action === null ? idle<CitadelsAction>() : act(action)]]),
    rng: rawRandom(),
  });

test("the King counts a School of Magic declared noble", () => {
  const state = incomeState("king", [declared("school-of-magic", "noble")]);
  const next = king(effectCtx(state));
  expect(rawGold(next, ANN)).toBe(rawGold(state, ANN) + 1);
});

test("the King counts a Haunted Quarter declared noble", () => {
  const state = incomeState("king", [declared("haunted-quarter", "noble")]);
  const next = king(effectCtx(state));
  expect(rawGold(next, ANN)).toBe(rawGold(state, ANN) + 1);
});

test("the Bishop counts a School of Magic declared religious", () => {
  const state = incomeState("bishop", [declared("school-of-magic", "religious")]);
  const next = bishop(effectCtx(state));
  expect(rawGold(next, ANN)).toBe(rawGold(state, ANN) + 1);
});

test("the Merchant counts a School of Magic declared trade", () => {
  const state = incomeState("merchant", [declared("school-of-magic", "trade")]);
  const next = merchant(effectCtx(state));
  // One declared trade district plus the Merchant's flat +1.
  expect(rawGold(next, ANN)).toBe(rawGold(state, ANN) + 2);
});

test("the Diplomat counts a School of Magic declared military", () => {
  const state = incomeState("diplomat", [declared("school-of-magic", "military")], CAST_DIPLOMAT);
  const next = diplomat(effectCtx(state));
  expect(rawGold(next, ANN)).toBe(rawGold(state, ANN) + 1);
});

test("the Marshal counts a School of Magic declared military", () => {
  const state = incomeState("marshal", [declared("school-of-magic", "military")], CAST_MARSHAL);
  const next = marshal(effectCtx(state));
  expect(rawGold(next, ANN)).toBe(rawGold(state, ANN) + 1);
});

test("the Patrician draws a card for a School of Magic declared noble", () => {
  const state = incomeState("patrician", [declared("school-of-magic", "noble")]);
  const next = patrician(effectCtx(state));
  expect(rawHand(next, ANN)).toHaveLength(rawHand(state, ANN).length + 1);
});

test("the Cardinal draws a card for a School of Magic declared religious", () => {
  const state = incomeState("cardinal", [declared("school-of-magic", "religious")]);
  const next = cardinal(effectCtx(state));
  expect(rawHand(next, ANN)).toHaveLength(rawHand(state, ANN).length + 1);
});

test("the Abbot counts a School of Magic declared religious in its split", () => {
  const state = incomeState("abbot", [declared("school-of-magic", "religious")]);
  // Declare every religious district as a card: the one declared district yields one.
  const next = resolveAbbot(abbot(effectCtx(state)), { t: "pay", amount: 0 });
  expect(rawHand(next, ANN)).toHaveLength(rawHand(state, ANN).length + 1);
});

test("an undeclared unique still counts as no colour", () => {
  const state = incomeState("king", [{ id: "school-of-magic", gold: 0 }]);
  const next = king(effectCtx(state));
  expect(rawGold(next, ANN)).toBe(rawGold(state, ANN));
});
