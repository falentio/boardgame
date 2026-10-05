import { expect, test } from "vitest";
import {
  ANN,
  BOB,
  advance,
  openPurpose,
  rawCoins,
  rawHand,
  withHands,
} from "../../driver.ts";
import {
  describeMatrix,
  pass,
  type RoleRecord,
} from "../matrix-driver.ts";

const record: RoleRecord = {
    hand: ["banker", "banker"],
    lieHand: ["director", "director"],
    coins: 3,
    target: null,
    blockHand: ["banker", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "turn"],
        coins: { ann: 3 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        coins: { ann: 3 },
        hands: { cara: -1 },
      },
    },
  };

describeMatrix("banker", record);

test("Banker: take 3 from the Treasury", () => {
  let state = withHands([[ANN, ["banker", "banker"]]], "banker-action");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "banker", target: null } : null,
  );
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(5);
  expect(openPurpose(state)).toBe("turn");
});

test("Banker: a successful challenge makes the claimant lose a life and the action fail", () => {
  let state = withHands([[ANN, ["director", "director"]]], "banker-lie");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "banker", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  expect(openPurpose(state)).toBe("proof-claim");
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(rawCoins(state, ANN)).toBe(2);
  expect(openPurpose(state)).toBe("turn");
});

test("Banker: a failed challenge costs the challenger a life, then the action resolves", () => {
  let state = withHands([[ANN, ["banker", "director"]]], "banker-true");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "banker", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  // Bob's reveal window opens; then the banker resolves.
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(rawCoins(state, ANN)).toBe(5);
});
