import { expect, test } from "vitest";
import type { CharacterId } from "../../../../lockstep/games/citadels/characters.ts";
import { wizard } from "../../../../lockstep/games/citadels/characters/wizard.ts";
import type { CitadelsState, Step } from "../../../../lockstep/games/citadels/state.ts";
import {
  ANN,
  BOB,
  SEATS3,
  advance,
  openPurpose,
  rawGenesis,
  rawGold,
  rawHand,
  rawPlayer,
  rawRandom,
  withGold,
  withHand,
} from "../driver.ts";

const CAST: readonly CharacterId[] = [
  "assassin",
  "thief",
  "wizard",
  "king",
  "bishop",
  "merchant",
  "architect",
  "warlord",
];

const turnState = (): CitadelsState => ({
  ...rawGenesis(SEATS3, CAST),
  phase: "turn",
  draft: null,
  claimed: [],
  callRank: 1,
  active: ANN,
  steps: [],
});

/** The Wizard's own turn window, used as the round continuation the effect pushes below. */
const OWN_TURN: Step = { kind: "window", window: { kind: "turn", purpose: "turn", seats: [ANN] } };

const openWizard = (state: CitadelsState, rest: readonly Step[] = []): CitadelsState =>
  wizard({ state, seat: ANN, rest, rng: rawRandom() });

const chooseTarget = (state: CitadelsState): CitadelsState =>
  advance(state, (seat) => (seat === ANN ? { t: "target", seat: BOB } : null));

const withCity = (state: CitadelsState, ids: readonly string[]): CitadelsState => ({
  ...state,
  players: state.players.map((p) =>
    p.seat === ANN ? { ...p, city: ids.map((id) => ({ id, gold: 0 })) } : p,
  ),
});

test("the Wizard looks at another player's hand and chooses one card from it", () => {
  const armed = withHand(turnState(), BOB, ["tavern", "market", "docks"]);
  const opened = openWizard(armed);
  expect(openPurpose(opened)).toBe("wizard-take");
  const next = advance(chooseTarget(opened), (seat) => (seat === ANN ? { t: "keep", index: 1 } : null));
  // The chosen card left the target's hand and joined the Wizard's.
  expect(rawHand(next, BOB)).toEqual(["tavern", "docks"]);
  expect(rawHand(next, ANN)).toContain("market");
});

test("the Wizard may pay to build the chosen card immediately", () => {
  const armed = withGold(withHand(turnState(), BOB, ["tavern", "palace"]), ANN, 5);
  const next = advance(chooseTarget(openWizard(armed)), (seat) =>
    seat === ANN ? { t: "build", card: 0 } : null,
  );
  // Tavern costs 1: the Wizard's gold drops by the cost and the district lands in its city.
  expect(rawPlayer(next, ANN).city.map((d) => d.id)).toEqual(["tavern"]);
  expect(rawGold(next, ANN)).toBe(4);
  expect(rawHand(next, BOB)).toEqual(["palace"]);
  expect(rawHand(next, ANN)).not.toContain("tavern");
});

test("a card built by the Wizard does not consume its own turn's build", () => {
  const armed = withGold(withHand(turnState(), BOB, ["tavern"]), ANN, 5);
  const next = advance(chooseTarget(openWizard(armed, [OWN_TURN])), (seat) =>
    seat === ANN ? { t: "build", card: 0 } : null,
  );
  // The built card is in the city and the Wizard's own turn window still follows.
  expect(rawPlayer(next, ANN).city.map((d) => d.id)).toEqual(["tavern"]);
  expect(openPurpose(next)).toBe("turn");
});

test("the Wizard may instead add the chosen card to its hand", () => {
  const armed = withHand(turnState(), BOB, ["tavern", "docks"]);
  const next = advance(chooseTarget(openWizard(armed)), (seat) =>
    seat === ANN ? { t: "keep", index: 0 } : null,
  );
  expect(rawHand(next, ANN)).toContain("tavern");
  expect(rawHand(next, BOB)).toEqual(["docks"]);
});

test("during its turn the Wizard may build a district identical to one already in its city", () => {
  const armed = withGold(withHand(withCity(turnState(), ["tavern"]), BOB, ["tavern"]), ANN, 5);
  const next = advance(chooseTarget(openWizard(armed, [OWN_TURN])), (seat) =>
    seat === ANN ? { t: "build", card: 0 } : null,
  );
  // The taken tavern joins the identical one already standing: two taverns.
  expect(rawPlayer(next, ANN).city.map((d) => d.id)).toEqual(["tavern", "tavern"]);
  expect(rawGold(next, ANN)).toBe(4);
});

test("the Wizard ability is not a no-op: it opens a window and moves a card", () => {
  const armed = withHand(turnState(), BOB, ["tavern"]);
  const opened = openWizard(armed);
  expect(openPurpose(opened)).toBe("wizard-take");
  const next = advance(chooseTarget(opened), (seat) => (seat === ANN ? { t: "keep", index: 0 } : null));
  expect(rawHand(next, ANN)).not.toEqual(rawHand(armed, ANN));
  expect(rawHand(next, BOB)).not.toEqual(rawHand(armed, BOB));
});
