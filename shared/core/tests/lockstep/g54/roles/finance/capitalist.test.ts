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
  type RoleId,
} from "../../driver.ts";
import {
  describeMatrix,
  pass,
  type RoleRecord,
} from "../matrix-driver.ts";

/** A three-seat set whose Finance role is the one under test. */
const financeSet = (finance: RoleId): readonly RoleId[] => [
  finance,
  "director",
  "guerrilla",
  "peacekeeper",
  "politician",
];

const record: RoleRecord = {
    hand: ["capitalist", "banker"],
    lieHand: ["banker", "banker"],
    coins: 3,
    target: null,
    blockHand: ["banker", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "capitalist", "turn"],
        coins: { ann: 4 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "capitalist", "turn"],
        coins: { ann: 4 },
        hands: { cara: -1 },
      },
    },
  };

describeMatrix("capitalist", record);

test("Capitalist: take 4, then each rival may claim Capitalist to take 1", () => {
  let state = craftSet(financeSet("capitalist"), [[ANN, ["capitalist", "banker"]]], "cap-action");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "capitalist", target: null } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("capitalist");
  state = advance(state, (seat) =>
    seat === BOB ? { t: "claim", role: "capitalist", target: null } : null,
  );
  // Bob's collection opens its own challenge window.
  expect(openPurpose(state)).toBe("challenge-claim");
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(5);
  expect(rawCoins(state, BOB)).toBe(3);
  // The turn ended exactly once: it is now Bob's turn.
  expect(state.active).toBe(BOB);
});

test("Capitalist: a secondary collection can be challenged", () => {
  let state = craftSet(
    financeSet("capitalist"),
    [[ANN, ["capitalist", "banker"]]],
    "cap-challenge",
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "capitalist", target: null } : null,
  );
  state = advance(state, pass);
  state = advance(state, (seat) =>
    seat === BOB ? { t: "claim", role: "capitalist", target: null } : null,
  );
  // Cara challenges Bob's secondary claim; Bob concedes.
  state = advance(state, (seat) => (seat === CARA ? { t: "challenge" } : null));
  state = advance(state, (seat) => (seat === BOB ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(rawCoins(state, ANN)).toBe(6);
  expect(rawCoins(state, BOB)).toBe(2);
});

test("Capitalist: a successful challenge makes the claimant lose a life and the whole action fail", () => {
  let state = craftSet(financeSet("capitalist"), [[ANN, ["banker", "banker"]]], "cap-lie");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "capitalist", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(rawCoins(state, ANN)).toBe(2);
});

test("Capitalist: a failed challenge costs the challenger a life, then the collection resolves", () => {
  let state = craftSet(financeSet("capitalist"), [[ANN, ["capitalist", "banker"]]], "cap-true");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "capitalist", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(openPurpose(state)).toBe("capitalist");
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(6);
});

test("Capitalist: two rivals' secondary claims resolve clockwise from the active seat", () => {
  let state = craftSet(financeSet("capitalist"), [[ANN, ["capitalist", "banker"]]], "cap-multi");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "capitalist", target: null } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("capitalist");
  state = advance(state, (seat) =>
    seat === BOB || seat === CARA ? { t: "claim", role: "capitalist", target: null } : null,
  );
  state = advance(state, pass);
  expect(rawCoins(state, BOB)).toBe(3);
  expect(rawCoins(state, CARA)).toBe(2);
  expect(openPurpose(state)).toBe("challenge-claim");
  state = advance(state, pass);
  expect(rawCoins(state, CARA)).toBe(3);
  expect(rawCoins(state, ANN)).toBe(4);
});

test("Capitalist: an active purse short of the claimants clamps the secondary transfer", () => {
  let state = withCoins(
    craftSet(financeSet("capitalist"), [[ANN, ["capitalist", "banker"]]], "cap-short"),
    ANN,
    0,
  );
  state = { ...state, treasury: 1 };
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "capitalist", target: null } : null,
  );
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(1);
  state = advance(state, (seat) =>
    seat === BOB || seat === CARA ? { t: "claim", role: "capitalist", target: null } : null,
  );
  state = advance(state, pass);
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(0);
  expect(rawCoins(state, BOB)).toBe(3);
  expect(rawCoins(state, CARA)).toBe(2);
  expect(state.treasury).toBe(0);
});
