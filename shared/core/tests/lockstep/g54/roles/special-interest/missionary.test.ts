import { expect, test } from "vitest";
import {
  ANN,
  BOB,
  CARA,
  advance,
  craftSet,
  openPurpose,
  rawHand,
  totalCards,
  withCoins,
} from "../../driver.ts";
import {
  describeReactiveMatrix,
  pass,
  reactiveSet,
  type ReactiveRecord,
} from "../matrix-driver.ts";

/** Run a Guerrilla hit on Bob, revealing his first card (which is not the reactive one). */
const guerrillaHit = (state: ReturnType<typeof craftSet>) =>
  advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "guerrilla", target: BOB } : null,
  );

const record: ReactiveRecord = {
    hand: ["banker", "missionary", "banker"],
    lieHand: ["banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "turn"],
        hands: { bob: 1 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        coins: { bob: -2 },
        hands: { bob: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "reactive-missionary", "challenge-claim", "turn"],
        hands: { bob: 1 },
      },
    },
  };

describeReactiveMatrix("missionary", record);

test("Missionary: after a non-Coup loss the holder may claim to take a Court card", () => {
  // Bob keeps Missionary face-down; the execution flips the Banker.
  let state = withCoins(
    craftSet(reactiveSet("missionary"), [[BOB, ["banker", "missionary"]]], "missionary-loss"),
    ANN,
    4,
  );
  const before = totalCards(state);
  state = guerrillaHit(state);
  state = advance(state, pass);
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, (seat) => (seat === BOB ? { t: "reveal", index: 0 } : null));
  expect(openPurpose(state)).toBe("reactive-missionary");
  state = advance(state, (seat) =>
    seat === BOB ? { t: "claim", role: "missionary", target: null } : null,
  );
  state = advance(state, pass);
  // The lost life is replaced by a Court card: hand size is restored.
  expect(rawHand(state, BOB)).toHaveLength(2);
  expect(totalCards(state)).toBe(before);
});

test("Missionary: a Coup loss does not open the Missionary window", () => {
  let state = withCoins(
    craftSet(reactiveSet("missionary"), [[BOB, ["banker", "missionary"]]], "missionary-coup"),
    ANN,
    8,
  );
  state = advance(state, (seat, s) => (seat === s.active ? { t: "coup", target: BOB } : null));
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, (seat) => (seat === BOB ? { t: "reveal", index: 0 } : null));
  expect(openPurpose(state)).toBe("turn");
});

test("Missionary: a successful challenge costs the claimant a second life", () => {
  let state = withCoins(
    craftSet(reactiveSet("missionary"), [[BOB, ["banker", "missionary"]]], "missionary-lie"),
    ANN,
    4,
  );
  state = guerrillaHit(state);
  state = advance(state, pass);
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === BOB ? { t: "reveal", index: 0 } : null));
  // Bob claims Missionary but Cara challenges and Bob concedes: he loses a second life.
  state = advance(state, (seat) =>
    seat === BOB ? { t: "claim", role: "missionary", target: null } : null,
  );
  state = advance(state, (seat) => (seat === CARA ? { t: "challenge" } : null));
  state = advance(state, (seat) => (seat === BOB ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(0);
});

test("Missionary: a failed challenge costs the challenger a life, then the card is drawn", () => {
  let state = withCoins(
    craftSet(reactiveSet("missionary"), [[BOB, ["banker", "missionary"]]], "missionary-true"),
    ANN,
    4,
  );
  state = guerrillaHit(state);
  state = advance(state, pass);
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === BOB ? { t: "reveal", index: 0 } : null));
  state = advance(state, (seat) =>
    seat === BOB ? { t: "claim", role: "missionary", target: null } : null,
  );
  state = advance(state, (seat) => (seat === CARA ? { t: "challenge" } : null));
  state = advance(state, (seat) => (seat === BOB ? { t: "show" } : null));
  // Cara's reveal for the failed challenge, then her own reactive window.
  state = advance(state, pass);
  state = advance(state, pass);
  expect(rawHand(state, CARA)).toHaveLength(1);
  expect(rawHand(state, BOB)).toHaveLength(2);
});

test("Missionary: a conceded challenge opens the window", () => {
  let state = withCoins(
    craftSet(
      reactiveSet("missionary"),
      [[ANN, ["missionary", "banker"]]],
      "missionary-concede",
    ),
    ANN,
    4,
  );
  // Ann bluffs a Guerrilla she does not hold; Bob challenges and she concedes.
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "guerrilla", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat) => (seat === ANN ? { t: "concede" } : null));
  expect(openPurpose(state)).toBe("reveal");
  // Flip the Banker, keeping Missionary face-down.
  state = advance(state, (seat) => (seat === ANN ? { t: "reveal", index: 1 } : null));
  expect(openPurpose(state)).toBe("reactive-missionary");
});

test("Missionary: a Disappear resolution opens the window", () => {
  let state = withCoins(
    craftSet(
      ["banker", "director", "mercenary", "missionary", "politician"],
      [[ANN, ["mercenary", "banker"]], [BOB, ["banker", "missionary"]]],
      "missionary-disappear",
    ),
    ANN,
    3,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "mercenary", target: BOB } : null,
  );
  state = advance(state, pass);
  state = advance(state, pass);
  expect(state.active).toBe(BOB);
  state = advance(state, (seat, s) => (seat === s.active ? { t: "income" } : null));
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, (seat) => (seat === BOB ? { t: "reveal", index: 0 } : null));
  expect(openPurpose(state)).toBe("reactive-missionary");
});
