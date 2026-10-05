import { expect, test } from "vitest";
import {
  ANN,
  BOB,
  CARA,
  DAN,
  advance,
  craftSet,
  openPurpose,
  rawCoins,
  rawHand,
  withCoins,
  type RoleId,
} from "../../driver.ts";
import {
  describeMatrix,
  pass,
  type RoleRecord,
} from "../matrix-driver.ts";

/** A three-seat set with two Special Interest roles: the tested one and Politician. */
const specialSet = (special: RoleId): readonly RoleId[] => [
  "banker",
  "director",
  "guerrilla",
  special,
  "politician",
];

const record: RoleRecord = {
    hand: ["communist", "banker"],
    lieHand: ["banker", "banker"],
    coins: 3,
    bobCoins: 8,
    caraCoins: 1,
    target: null,
    blockHand: ["communist", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "block", "turn"],
        coins: { bob: -3, cara: 3 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "block", "turn"],
        coins: { bob: -3, cara: 3 },
        hands: { cara: -1 },
      },
      block: {
        purposes: ["challenge-claim", "block", "challenge-block", "turn"],
      },
      blockLie: {
        purposes: ["challenge-claim", "block", "challenge-block", "proof-block", "reveal", "turn"],
        coins: { bob: -3, cara: 3 },
        hands: { bob: -1 },
      },
      blockTruth: {
        purposes: ["challenge-claim", "block", "challenge-block", "proof-block", "reveal", "turn"],
        hands: { cara: -1 },
      },
    },
  };

describeMatrix("communist", record);

test("Communist: steal up to 3 from the wealthiest and give them to the poorest", () => {
  let state = withCoins(
    craftSet(specialSet("communist"), [[ANN, ["communist", "banker"]]], "comm-action"),
    BOB,
    8,
  );
  state = withCoins(state, CARA, 1);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "communist", target: null } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("block");
  state = advance(state, pass);
  // Bob was wealthiest (8), Cara poorest (1): 3 moves from Bob to Cara.
  expect(rawCoins(state, BOB)).toBe(5);
  expect(rawCoins(state, CARA)).toBe(4);
  expect(rawCoins(state, ANN)).toBe(2);
});

test("Communist: the wealthiest target blocks and the theft is stopped", () => {
  let state = withCoins(
    craftSet(specialSet("communist"), [[BOB, ["communist", "banker"]]], "comm-block"),
    BOB,
    8,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "communist", target: null } : null,
  );
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === BOB ? { t: "block", role: "communist" } : null));
  state = advance(state, pass);
  expect(rawCoins(state, BOB)).toBe(8);
});

test("Communist: a successful challenge costs a life and the theft fails", () => {
  let state = withCoins(
    craftSet(specialSet("communist"), [[ANN, ["banker", "banker"]]], "comm-lie"),
    BOB,
    8,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "communist", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(rawCoins(state, BOB)).toBe(8);
});

test("Communist: a failed challenge costs the challenger a life, then the theft lands", () => {
  let state = withCoins(
    craftSet(specialSet("communist"), [[ANN, ["communist", "banker"]]], "comm-true"),
    BOB,
    8,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "communist", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  state = advance(state, pass);
  expect(rawCoins(state, BOB)).toBe(5);
});

test("Communist: a victim holding fewer than 3 coins is robbed partially", () => {
  let state = craftSet(specialSet("communist"), [[ANN, ["communist", "banker"]]], "comm-partial");
  state = withCoins(state, BOB, 2);
  state = withCoins(state, CARA, 0);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "communist", target: null } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("block");
  state = advance(state, pass);
  // Bob held only 2, so the 3-coin theft is capped and Cara gains exactly 2.
  expect(rawCoins(state, BOB)).toBe(0);
  expect(rawCoins(state, CARA)).toBe(2);
  expect(rawCoins(state, ANN)).toBe(2);
});

test("Communist: a poorest tie resolves clockwise from the actor", () => {
  let state = craftSet(
    specialSet("communist"),
    [[ANN, ["communist", "banker"]]],
    "comm-poorest-tie",
    [ANN, BOB, CARA, DAN],
  );
  state = withCoins(state, BOB, 0);
  state = withCoins(state, CARA, 5);
  state = withCoins(state, DAN, 0);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "communist", target: null } : null,
  );
  state = advance(state, pass);
  state = advance(state, pass);
  // Bob and Dan tie at 0; Bob is clockwise-first from Ann, so Bob receives.
  expect(rawCoins(state, BOB)).toBe(3);
  expect(rawCoins(state, DAN)).toBe(0);
  expect(rawCoins(state, CARA)).toBe(2);
});

test("Communist: a wealthiest actor still robs the richest other seat", () => {
  let state = craftSet(
    specialSet("communist"),
    [[ANN, ["communist", "banker"]]],
    "comm-actor-rich",
  );
  state = withCoins(state, ANN, 8);
  state = withCoins(state, BOB, 5);
  state = withCoins(state, CARA, 1);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "communist", target: null } : null,
  );
  state = advance(state, pass);
  state = advance(state, pass);
  // Bob is the richest other seat; Ann's own purse is untouched by the steal.
  expect(rawCoins(state, BOB)).toBe(2);
  expect(rawCoins(state, CARA)).toBe(4);
  expect(rawCoins(state, ANN)).toBe(8);
});

test("Communist: when the actor is poorest the theft is a self-transfer", () => {
    let state = withCoins(
      craftSet(
        ["banker", "director", "guerrilla", "communist", "politician"],
        [[ANN, ["communist", "banker"]]],
        "edge-comm-self",
      ),
      ANN,
      0,
    );
    state = withCoins(state, BOB, 8);
    state = withCoins(state, CARA, 5);
    state = advance(state, (seat, s) =>
      seat === s.active ? { t: "claim", role: "communist", target: null } : null,
    );
    state = advance(state, () => null);
    state = advance(state, () => null);
    // The actor is the poorest, so the 3 coins from the wealthiest land on the actor.
    expect(rawCoins(state, ANN)).toBe(3);
    expect(rawCoins(state, BOB)).toBe(5);
  });

test("Communist: a wealth tie breaks clockwise from the actor", () => {
    let state = withCoins(
      craftSet(
        ["banker", "director", "guerrilla", "communist", "politician"],
        [[ANN, ["communist", "banker"]]],
        "edge-comm-tie",
      ),
      BOB,
      8,
    );
    state = withCoins(state, CARA, 8);
    state = advance(state, (seat, s) =>
      seat === s.active ? { t: "claim", role: "communist", target: null } : null,
    );
    state = advance(state, () => null);
    state = advance(state, () => null);
    // Bob is clockwise-first from Ann, so Bob is the victim and Cara is untouched.
    expect(rawCoins(state, BOB)).toBe(5);
    expect(rawCoins(state, CARA)).toBe(8);
  });
