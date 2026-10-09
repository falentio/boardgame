import { expect, test } from "vitest";
import {
  ANN,
  BOB,
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
    hand: ["spy", "banker"],
    lieHand: ["banker", "banker"],
    coins: 3,
    target: null,
    blockHand: ["banker", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "spy-second", "turn"],
        coins: { ann: 2 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "spy-second", "turn"],
        coins: { ann: 2 },
        hands: { cara: -1 },
      },
    },
  };

describeMatrix("spy", record);

test("Spy: take 1, then immediately take a second action", () => {
  let state = craftSet(financeSet("spy"), [[ANN, ["spy", "banker"]]], "spy-action");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "spy", target: null } : null,
  );
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(3);
  expect(openPurpose(state)).toBe("spy-second");
  state = advance(state, (seat, s) => (seat === s.active ? { t: "income" } : null));
  expect(rawCoins(state, ANN)).toBe(4);
  expect(state.active).toBe(BOB);
});

test("Spy: the second action is a full claim with its own challenge window", () => {
  let state = withCoins(
    craftSet(financeSet("spy"), [[ANN, ["spy", "guerrilla"]]], "spy-second-claim"),
    ANN,
    3,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "spy", target: null } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("spy-second");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "guerrilla", target: BOB } : null,
  );
  expect(openPurpose(state)).toBe("challenge-claim");
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("block");
  state = advance(state, pass);
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
});

test("Spy: a successful challenge makes the claimant lose a life and the spy action fail", () => {
  let state = craftSet(financeSet("spy"), [[ANN, ["banker", "banker"]]], "spy-lie");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "spy", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(rawCoins(state, ANN)).toBe(2);
  expect(state.active).toBe(BOB);
});

test("Spy: a failed challenge costs the challenger a life, then the second action opens", () => {
  let state = craftSet(financeSet("spy"), [[ANN, ["spy", "banker"]]], "spy-true");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "spy", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(openPurpose(state)).toBe("spy-second");
});

test("Spy: the second action cannot be Spy again", () => {
  let state = craftSet(financeSet("spy"), [[ANN, ["spy", "banker"]]], "spy-reclaim");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "spy", target: null } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("spy-second");
  const afterFirst = rawCoins(state, ANN);

  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "spy", target: null } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).not.toBe("spy-second");
  expect(rawCoins(state, ANN)).toBe(afterFirst);
});

test("Spy: at 10+ coins the second action must be Coup", () => {
  let state = withCoins(
    craftSet(financeSet("spy"), [[ANN, ["spy", "banker"]]], "spy-forced"),
    ANN,
    9,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "spy", target: null } : null,
  );
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(10);
  expect(openPurpose(state)).toBe("spy-second");
  // An Income report is coerced to Coup at 10 coins.
  state = advance(state, (seat, s) => (seat === s.active ? { t: "income" } : null));
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(rawCoins(state, ANN)).toBe(3);
});
