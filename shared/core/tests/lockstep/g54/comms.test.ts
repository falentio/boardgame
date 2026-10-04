import { expect, test } from "vitest";
import {
  ANN,
  BOB,
  advance,
  craftSet,
  openPurpose,
  rawCoins,
  rawHand,
  totalCards,
  withCoins,
} from "./driver.ts";
import type { RoleId } from "./driver.ts";

/** A three-seat set whose Communications role is the one under test. */
const commsSet = (comms: RoleId): readonly RoleId[] => [
  "banker",
  comms,
  "guerrilla",
  "peacekeeper",
  "politician",
];

const pass = (): null => null;

test("Newscaster: pay 1, draw 3, return 3", () => {
  let state = withCoins(
    craftSet(commsSet("newscaster"), [[ANN, ["newscaster", "banker"]]], "newscaster-action"),
    ANN,
    3,
  );
  const before = totalCards(state);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "newscaster", target: null } : null,
  );
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(2);
  expect(openPurpose(state)).toBe("keep");
  expect(state.draw?.pool).toHaveLength(3);
  // Keep two cards from the pool; the rest return to the Court.
  state = advance(state, (seat, s) => (seat === s.active ? { t: "keep", indices: [2, 3] } : null));
  expect(rawHand(state, ANN)).toHaveLength(2);
  expect(totalCards(state)).toBe(before);
});

test("Newscaster: a successful challenge makes the claimant lose a life and the draw fail", () => {
  let state = withCoins(
    craftSet(commsSet("newscaster"), [[ANN, ["banker", "banker"]]], "newscaster-lie"),
    ANN,
    3,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "newscaster", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(rawCoins(state, ANN)).toBe(3);
});

test("Newscaster: a failed challenge costs the challenger a life, then the swap resolves", () => {
  let state = withCoins(
    craftSet(commsSet("newscaster"), [[ANN, ["newscaster", "banker"]]], "newscaster-true"),
    ANN,
    3,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "newscaster", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(openPurpose(state)).toBe("keep");
});

test("Producer: take a Court card and a target card, then return one to each", () => {
  let state = craftSet(commsSet("producer"), [[ANN, ["producer", "banker"]]], "producer-action");
  const before = totalCards(state);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "producer", target: BOB } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("block");
  state = advance(state, pass);
  // Bob chooses which card to give.
  expect(openPurpose(state)).toBe("producer-give");
  state = advance(state, (seat) => (seat === BOB ? { t: "give", index: 0 } : null));
  expect(openPurpose(state)).toBe("keep");
  // The Court draw plus Bob's given card sit in the actor's pool to filter.
  expect(state.draw?.pool).toHaveLength(2);
  state = advance(state, (seat, s) => (seat === s.active ? { t: "keep", indices: [2, 3] } : null));
  expect(rawHand(state, ANN)).toHaveLength(2);
  expect(rawHand(state, BOB)).toHaveLength(2);
  expect(totalCards(state)).toBe(before);
});

test("Producer: the target blocks and the exchange is stopped", () => {
  let state = craftSet(commsSet("producer"), [[BOB, ["producer", "banker"]]], "producer-block");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "producer", target: BOB } : null,
  );
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === BOB ? { t: "block", role: "producer" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(2);
  expect(rawHand(state, BOB)).toHaveLength(2);
});

test("Producer: a one-card target is not eliminated mid-exchange", () => {
  const roles: readonly RoleId[] = ["banker", "producer", "guerrilla", "peacekeeper", "politician"];
  let state = craftSet(
    roles,
    [
      [ANN, ["producer", "banker"]],
      [BOB, ["banker"]],
    ],
    "producer-one",
  );
  const before = totalCards(state);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "producer", target: BOB } : null,
  );
  state = advance(state, pass);
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === BOB ? { t: "give", index: 0 } : null));
  // Bob is momentarily cardless mid-exchange but must not be eliminated.
  expect(rawHand(state, BOB)).toHaveLength(0);
  expect(state.players.find((p) => p.seat === BOB)?.revealed).toHaveLength(0);
  state = advance(state, (seat, s) => (seat === s.active ? { t: "keep", indices: [2, 3] } : null));
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(rawHand(state, ANN)).toHaveLength(2);
  expect(totalCards(state)).toBe(before);
});

test("Producer: a successful challenge makes the claimant lose a life and the exchange fail", () => {
  let state = craftSet(commsSet("producer"), [[ANN, ["banker", "banker"]]], "producer-lie");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "producer", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(rawHand(state, BOB)).toHaveLength(2);
});

test("Producer: a failed challenge costs the challenger a life, then the exchange opens", () => {
  let state = craftSet(commsSet("producer"), [[ANN, ["producer", "banker"]]], "producer-true");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "producer", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(openPurpose(state)).toBe("block");
});

test("Reporter: take 1 coin, draw 1, return 1", () => {
  let state = craftSet(commsSet("reporter"), [[ANN, ["reporter", "banker"]]], "reporter-action");
  const before = totalCards(state);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "reporter", target: null } : null,
  );
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(3);
  expect(openPurpose(state)).toBe("keep");
  expect(state.draw?.pool).toHaveLength(1);
  state = advance(state, (seat, s) => (seat === s.active ? { t: "keep", indices: [2] } : null));
  expect(rawHand(state, ANN)).toHaveLength(2);
  expect(totalCards(state)).toBe(before);
});

test("Reporter: a successful challenge makes the claimant lose a life and the coin fail", () => {
  let state = craftSet(commsSet("reporter"), [[ANN, ["banker", "banker"]]], "reporter-lie");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "reporter", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(rawCoins(state, ANN)).toBe(2);
});

test("Reporter: a failed challenge costs the challenger a life, then the coin and draw land", () => {
  let state = craftSet(commsSet("reporter"), [[ANN, ["reporter", "banker"]]], "reporter-true");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "reporter", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(rawCoins(state, ANN)).toBe(3);
  expect(openPurpose(state)).toBe("keep");
});

test("Writer: draw 1 free, pay 1 per extra draw, then return the same number", () => {
  let state = withCoins(
    craftSet(commsSet("writer"), [[ANN, ["writer", "banker"]]], "writer-action"),
    ANN,
    3,
  );
  const before = totalCards(state);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "writer", target: null } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("writer-draw");
  expect(state.draw?.pool).toHaveLength(1);
  // Pay for two more draws, then stop.
  state = advance(state, (seat, s) => (seat === s.active ? { t: "pay" } : null));
  expect(state.draw?.pool).toHaveLength(2);
  state = advance(state, (seat, s) => (seat === s.active ? { t: "pay" } : null));
  expect(state.draw?.pool).toHaveLength(3);
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(1);
  expect(openPurpose(state)).toBe("keep");
  state = advance(state, (seat, s) => (seat === s.active ? { t: "keep", indices: [0, 1] } : null));
  expect(rawHand(state, ANN)).toHaveLength(2);
  expect(totalCards(state)).toBe(before);
});

test("Writer: a successful challenge makes the claimant lose a life and the dig fail", () => {
  let state = craftSet(commsSet("writer"), [[ANN, ["banker", "banker"]]], "writer-lie");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "writer", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(openPurpose(state)).toBe("turn");
});

test("Writer: a failed challenge costs the challenger a life, then the dig opens", () => {
  let state = craftSet(commsSet("writer"), [[ANN, ["writer", "banker"]]], "writer-true");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "writer", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(openPurpose(state)).toBe("writer-draw");
});
