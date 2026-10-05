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
  describeReactiveMatrix,
  pass,
  reactiveSet,
  type ReactiveRecord,
} from "../matrix-driver.ts";

/** Set up a Coup that eliminates Bob (one card) so the Lawyer window opens. */
const coupEliminates = (roles: readonly RoleId[], entropy: string) => {
  let state = withCoins(
    craftSet(
      roles,
      [
        [ANN, ["lawyer", "banker"]],
        [BOB, ["banker"]],
      ],
      entropy,
    ),
    ANN,
    8,
  );
  state = withCoins(state, BOB, 6);
  const treasury = state.treasury;
  state = advance(state, (seat, s) => (seat === s.active ? { t: "coup", target: BOB } : null));
  state = advance(state, (seat) => (seat === BOB ? { t: "reveal", index: 0 } : null));
  return { state, treasury };
};

const record: ReactiveRecord = {
    hand: ["lawyer", "banker"],
    lieHand: ["banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "turn"],
        coins: { ann: 6, bob: -6 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        coins: { bob: -6 },
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        coins: { ann: 6, bob: -6 },
        hands: { cara: -1 },
      },
    },
  };

describeReactiveMatrix("lawyer", record);

test("Lawyer: when a player is eliminated a survivor may claim their coins before the Treasury", () => {
  const { state: afterCoup } = coupEliminates(reactiveSet("lawyer"), "lawyer-claim");
  expect(openPurpose(afterCoup)).toBe("lawyer");
  let state = advance(afterCoup, (seat) =>
    seat === ANN ? { t: "claim", role: "lawyer", target: null } : null,
  );
  state = advance(state, pass);
  // Ann took Bob's 6 coins instead of the Treasury.
  expect(rawCoins(state, ANN)).toBe(7);
  expect(rawCoins(state, BOB)).toBe(0);
});

test("Lawyer: with no claim the eliminated player's coins go to the Treasury", () => {
  const { state: afterCoup, treasury } = coupEliminates(reactiveSet("lawyer"), "lawyer-none");
  expect(openPurpose(afterCoup)).toBe("lawyer");
  const state = advance(afterCoup, pass);
  expect(rawCoins(state, ANN)).toBe(1);
  expect(state.treasury).toBe(treasury + 7 + 6);
});

test("Lawyer: a successful challenge makes the claimant lose a life and the coins go to the Treasury", () => {
  const { state: afterCoup, treasury } = coupEliminates(reactiveSet("lawyer"), "lawyer-lie");
  let state = advance(afterCoup, (seat) =>
    seat === ANN ? { t: "claim", role: "lawyer", target: null } : null,
  );
  state = advance(state, (seat) => (seat === CARA ? { t: "challenge" } : null));
  state = advance(state, (seat) => (seat === ANN ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(rawCoins(state, BOB)).toBe(0);
  expect(state.treasury).toBe(treasury + 7 + 6);
});

test("Lawyer: a failed challenge costs the challenger a life, then the coins land", () => {
  const { state: afterCoup } = coupEliminates(reactiveSet("lawyer"), "lawyer-true");
  let state = advance(afterCoup, (seat) =>
    seat === ANN ? { t: "claim", role: "lawyer", target: null } : null,
  );
  state = advance(state, (seat) => (seat === CARA ? { t: "challenge" } : null));
  state = advance(state, (seat) => (seat === ANN ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, CARA)).toHaveLength(1);
  expect(rawCoins(state, ANN)).toBe(7);
});

test("Lawyer: the clockwise-first claimant takes the estate and the later claim is voided", () => {
  let state = withCoins(
    craftSet(
      reactiveSet("lawyer"),
      [
        [ANN, ["lawyer", "banker"]],
        [BOB, ["banker"]],
        [CARA, ["lawyer", "banker"]],
      ],
      "lawyer-clockwise",
    ),
    ANN,
    8,
  );
  state = withCoins(state, BOB, 6);
  state = advance(state, (seat, s) => (seat === s.active ? { t: "coup", target: BOB } : null));
  state = advance(state, (seat) => (seat === BOB ? { t: "reveal", index: 0 } : null));
  expect(openPurpose(state)).toBe("lawyer");
  // Both survivors claim; clockwise from the eliminated seat, Cara resolves first.
  state = advance(state, (seat) =>
    seat === ANN || seat === CARA ? { t: "claim", role: "lawyer", target: null } : null,
  );
  state = advance(state, pass);
  expect(rawCoins(state, CARA)).toBe(8);
  expect(rawCoins(state, ANN)).toBe(1);
  expect(rawCoins(state, BOB)).toBe(0);
});

test("Lawyer: a Guerrilla execution that eliminates a seat opens the window", () => {
  let state = withCoins(
    craftSet(
      reactiveSet("lawyer"),
      [
        [ANN, ["guerrilla", "banker"]],
        [BOB, ["banker"]],
      ],
      "lawyer-guerrilla",
    ),
    ANN,
    4,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "guerrilla", target: BOB } : null,
  );
  state = advance(state, pass);
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, (seat) => (seat === BOB ? { t: "reveal", index: 0 } : null));
  expect(openPurpose(state)).toBe("lawyer");
});
