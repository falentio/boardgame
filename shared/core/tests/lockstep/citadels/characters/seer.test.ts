import { expect, test } from "vitest";
import type { CharacterId } from "../../../../lockstep/games/citadels/characters.ts";
import { seer } from "../../../../lockstep/games/citadels/characters/seer.ts";
import { tryBuild } from "../../../../lockstep/games/citadels/helpers.ts";
import type { CitadelsState, Step } from "../../../../lockstep/games/citadels/state.ts";
import {
  ANN,
  BOB,
  CARA,
  SEATS3,
  advance,
  openPurpose,
  rawGenesis,
  rawHand,
  rawPlayer,
  rawRandom,
  withGold,
  withHand,
} from "../driver.ts";

const CAST: readonly CharacterId[] = [
  "assassin",
  "thief",
  "seer",
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

/** The Seer's own turn window, the round continuation its effect must preserve. */
const OWN_TURN: Step = { kind: "window", window: { kind: "turn", purpose: "turn", seats: [ANN] } };

const hands = (
  state: CitadelsState,
  mine: readonly string[],
  bob: readonly string[],
  cara: readonly string[],
): CitadelsState => withHand(withHand(withHand(state, ANN, mine), BOB, bob), CARA, cara);

const openSeer = (state: CitadelsState, rest: readonly Step[] = []): CitadelsState =>
  seer({ state, seat: ANN, rest, rng: rawRandom() });

const report = (state: CitadelsState, index: number): CitadelsState =>
  advance(state, (seat) => (seat === ANN ? { t: "keep", index } : null));

/** Run only the take windows, stopping at the give phase. */
const driveTake = (state: CitadelsState): CitadelsState => {
  let next = state;
  for (let i = 0; i < 50 && openPurpose(next) === "seer-receive"; i += 1) next = report(next, 0);
  return next;
};

/** Run every take and give window, handing back hand index 0 each time. */
const driveAbility = (state: CitadelsState): CitadelsState => {
  let next = state;
  for (let i = 0; i < 50; i += 1) {
    const purpose = openPurpose(next);
    if (purpose !== "seer-receive" && purpose !== "seer-give") return next;
    next = report(next, 0);
  }
  return next;
};

const allCards = (state: CitadelsState): readonly string[] =>
  [...rawHand(state, ANN), ...rawHand(state, BOB), ...rawHand(state, CARA)].sort();

test("the Seer takes a card at random from each other player's hand and adds them to its hand", () => {
  const armed = hands(turnState(), ["temple"], ["tavern", "market", "docks"], ["harbor", "palace"]);
  const opened = openSeer(armed);
  expect(openPurpose(opened)).toBe("seer-receive");
  const taken = driveTake(opened);
  // Before any giving: each rival lost one card and the Seer holds both of them.
  expect(openPurpose(taken)).toBe("seer-give");
  expect(rawHand(taken, BOB)).toHaveLength(2);
  expect(rawHand(taken, CARA)).toHaveLength(1);
  expect(rawHand(taken, ANN)).toHaveLength(3);
  expect(allCards(taken)).toEqual(allCards(armed));
});

test("the Seer gives one card from its hand to each player it took from", () => {
  const armed = hands(turnState(), ["temple", "church"], ["tavern", "market"], ["harbor"]);
  const after = driveAbility(openSeer(armed));
  // Both rivals are back to their starting hand size once the Seer has given.
  expect(rawHand(after, BOB)).toHaveLength(2);
  expect(rawHand(after, CARA)).toHaveLength(1);
  expect(rawHand(after, ANN)).toHaveLength(2);
  expect(allCards(after)).toEqual(allCards(armed));
});

test("a player with no cards is skipped", () => {
  const armed = hands(turnState(), ["temple"], [], ["harbor", "palace"]);
  const after = driveAbility(openSeer(armed));
  // Bob, empty-handed, was neither taken from nor given to.
  expect(rawHand(after, BOB)).toEqual([]);
  expect(rawHand(after, CARA)).toHaveLength(2);
  expect(rawHand(after, ANN)).toHaveLength(1);
  expect(allCards(after)).toEqual(allCards(armed));
});

test("the Seer's building limit this turn is two", () => {
  // No rival holds a card, so the ability is skipped and the Seer's own turn window opens.
  const armed = withGold(hands(turnState(), ["tavern", "market", "docks"], [], []), ANN, 5);
  const opened = openSeer(armed, [OWN_TURN]);
  expect(openPurpose(opened)).toBe("turn");
  let state = opened;
  let builds = 0;
  for (let index = 0; index < 2; index += 1) {
    state = tryBuild(state, ANN, 0, rawRandom());
    if (rawPlayer(state, ANN).city.length > builds) builds += 1;
  }
  // Two builds land within the limit.
  expect(builds).toBe(2);
  expect(rawPlayer(state, ANN).city).toHaveLength(2);
  // A third build is beyond the limit: the Seer's turn is done.
  const beyond = tryBuild(state, ANN, 0, rawRandom());
  expect(rawPlayer(beyond, ANN).city).toHaveLength(2);
});

test("the Seer ability is not a no-op: it opens a window and moves cards", () => {
  const armed = hands(turnState(), ["temple"], ["tavern", "market"], ["harbor", "palace"]);
  const opened = openSeer(armed);
  expect(openPurpose(opened)).toBe("seer-receive");
  const after = driveAbility(opened);
  expect(rawHand(after, ANN)).not.toEqual(rawHand(armed, ANN));
  expect(rawHand(after, BOB)).not.toEqual(rawHand(armed, BOB));
  expect(rawHand(after, CARA)).not.toEqual(rawHand(armed, CARA));
});
