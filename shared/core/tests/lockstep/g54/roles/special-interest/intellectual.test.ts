import { expect, test } from "vitest";
import {
  ANN,
  BOB,
  CARA,
  advance,
  craftSet,
  openPurpose,
  rawCoins,
  rawHand,
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
    hand: ["banker", "intellectual", "banker"],
    lieHand: ["banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "turn"],
        coins: { bob: 5 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        coins: { bob: -2 },
        hands: { bob: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "reactive-intellectual", "challenge-claim", "turn"],
        coins: { bob: 5, cara: 5 },
        hands: { cara: -1 },
      },
    },
  };

describeReactiveMatrix("intellectual", record);

test("Intellectual: after any loss the holder may claim to take 5 coins", () => {
  let state = withCoins(
    craftSet(reactiveSet("intellectual"), [[BOB, ["banker", "intellectual"]]], "intel-loss"),
    ANN,
    4,
  );
  state = guerrillaHit(state);
  state = advance(state, pass);
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === BOB ? { t: "reveal", index: 0 } : null));
  expect(openPurpose(state)).toBe("reactive-intellectual");
  state = advance(state, (seat) =>
    seat === BOB ? { t: "claim", role: "intellectual", target: null } : null,
  );
  state = advance(state, pass);
  expect(rawCoins(state, BOB)).toBe(7);
});

test("Intellectual: a Coup loss still opens the window", () => {
  let state = withCoins(
    craftSet(reactiveSet("intellectual"), [[BOB, ["banker", "intellectual"]]], "intel-coup"),
    ANN,
    8,
  );
  state = advance(state, (seat, s) => (seat === s.active ? { t: "coup", target: BOB } : null));
  state = advance(state, (seat) => (seat === BOB ? { t: "reveal", index: 0 } : null));
  expect(openPurpose(state)).toBe("reactive-intellectual");
});

test("Intellectual: a successful challenge costs the claimant another life", () => {
  let state = withCoins(
    craftSet(reactiveSet("intellectual"), [[BOB, ["banker", "intellectual"]]], "intel-lie"),
    ANN,
    4,
  );
  state = guerrillaHit(state);
  state = advance(state, pass);
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === BOB ? { t: "reveal", index: 0 } : null));
  state = advance(state, (seat) =>
    seat === BOB ? { t: "claim", role: "intellectual", target: null } : null,
  );
  state = advance(state, (seat) => (seat === CARA ? { t: "challenge" } : null));
  state = advance(state, (seat) => (seat === BOB ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(0);
});

test("Intellectual: a failed challenge costs the challenger a life, then 5 coins land", () => {
  let state = withCoins(
    craftSet(reactiveSet("intellectual"), [[BOB, ["banker", "intellectual"]]], "intel-true"),
    ANN,
    4,
  );
  state = guerrillaHit(state);
  state = advance(state, pass);
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === BOB ? { t: "reveal", index: 0 } : null));
  state = advance(state, (seat) =>
    seat === BOB ? { t: "claim", role: "intellectual", target: null } : null,
  );
  state = advance(state, (seat) => (seat === CARA ? { t: "challenge" } : null));
  state = advance(state, (seat) => (seat === BOB ? { t: "show" } : null));
  // Cara's reveal for the failed challenge, then her own reactive window.
  state = advance(state, pass);
  state = advance(state, pass);
  expect(rawHand(state, CARA)).toHaveLength(1);
  expect(rawCoins(state, BOB)).toBe(7);
});

test("Intellectual: a surviving holder who loses twice in one turn opens a second window", () => {
  let state = withCoins(
    craftSet(
      reactiveSet("intellectual"),
      [[ANN, ["guerrilla", "banker"]], [BOB, ["banker", "intellectual", "banker"]]],
      "intel-twice",
    ),
    ANN,
    4,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "guerrilla", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("reactive-intellectual");
  state = advance(state, pass);
  state = advance(state, pass);
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("reactive-intellectual");
  expect(rawHand(state, BOB)).toHaveLength(1);
});

test("Intellectual: a General execution opens the window", () => {
  let state = withCoins(
    craftSet(
      ["banker", "director", "general", "intellectual", "peacekeeper"],
      [[ANN, ["general", "banker"]], [BOB, ["banker", "intellectual"]]],
      "intel-general",
    ),
    ANN,
    5,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "general", target: null } : null,
  );
  state = advance(state, pass);
  state = advance(state, pass);
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("reactive-intellectual");
});

test("double life loss: a failed challenge plus the execution costs two lives", () => {
  let state = withCoins(
    craftSet(reactiveSet("intellectual"), [[ANN, ["guerrilla", "banker"]]], "double-loss"),
    ANN,
    4,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "guerrilla", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  // Bob flips for the failed challenge, then his Intellectual window opens.
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(openPurpose(state)).toBe("reactive-intellectual");
  state = advance(state, pass);
  // The attack still resolves: Bob may block, declines, then flips again.
  expect(openPurpose(state)).toBe("block");
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(0);
});
