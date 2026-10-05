import { expect, test } from "vitest";
import {
  ANN,
  BOB,
  CARA,
  SEATS3,
  advance,
  craftSet,
  openPurpose,
  rawCoins,
  rawHand,
  withCoins,
  withPeacekeeping,
  type G54State,
  type RoleId,
} from "../../driver.ts";
import {
  describeMatrix,
  pass,
  type RoleRecord,
} from "../matrix-driver.ts";
import {
  type SeatId,
} from "../../../../../index.ts";

/** A three-seat set whose Force role is the one under test. */
const forceSet = (force: RoleId): readonly RoleId[] => [
  "banker",
  "director",
  force,
  "peacekeeper",
  "politician",
];

const record: RoleRecord = {
    hand: ["mercenary", "banker"],
    lieHand: ["banker", "banker"],
    coins: 6,
    target: BOB,
    blockHand: ["mercenary", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "block", "turn"],
        coins: { ann: -3 },
        disappear: 1,
        disappearTurns: [1],
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "block", "turn"],
        coins: { ann: -3 },
        hands: { cara: -1 },
        disappear: 1,
        disappearTurns: [1],
      },
      block: {
        purposes: ["challenge-claim", "block", "challenge-block", "turn"],
        coins: { ann: -3 },
      },
      blockLie: {
        purposes: ["challenge-claim", "block", "challenge-block", "proof-block", "reveal", "turn"],
        coins: { ann: -3 },
        hands: { bob: -1 },
        disappear: 1,
        disappearTurns: [1],
      },
      blockTruth: {
        purposes: ["challenge-claim", "block", "challenge-block", "proof-block", "reveal", "turn"],
        coins: { ann: -3 },
        hands: { cara: -1 },
      },
    },
  };

describeMatrix("mercenary", record);

test("Mercenary: place a Disappear token that resolves after the target's next turn", () => {
  let state = withCoins(
    craftSet(forceSet("mercenary"), [[ANN, ["mercenary", "banker"]]], "merc-place"),
    ANN,
    3,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "mercenary", target: BOB } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("block");
  state = advance(state, pass);
  expect(state.disappear).toHaveLength(1);
  expect(state.disappear[0]?.target).toBe(BOB);
  // The claim ended Ann's turn; Bob takes his full turn and the token fires at its end.
  expect(state.active).toBe(BOB);
  expect(rawHand(state, BOB)).toHaveLength(2);
  state = advance(state, (seat, s) => (seat === s.active ? { t: "income" } : null));
  // The reveal window for the token loss opens before Cara's turn.
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(state.disappear).toHaveLength(0);
  expect(state.active).toBe(CARA);
});

test("Mercenary: the target blocks at placement and no token is placed", () => {
  let state = withCoins(
    craftSet(forceSet("mercenary"), [[BOB, ["mercenary", "banker"]]], "merc-block"),
    ANN,
    3,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "mercenary", target: BOB } : null,
  );
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === BOB ? { t: "block", role: "mercenary" } : null));
  state = advance(state, pass);
  expect(state.disappear).toHaveLength(0);
  expect(rawCoins(state, ANN)).toBe(0);
});

test("Mercenary: a successful challenge costs a life and no token is placed", () => {
  let state = withCoins(
    craftSet(forceSet("mercenary"), [[ANN, ["banker", "banker"]]], "merc-lie"),
    ANN,
    3,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "mercenary", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(state.disappear).toHaveLength(0);
});

test("Mercenary: a failed challenge costs the challenger a life, then the token lands", () => {
  let state = withCoins(
    craftSet(forceSet("mercenary"), [[ANN, ["mercenary", "banker"]]], "merc-true"),
    ANN,
    3,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "mercenary", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  state = advance(state, pass);
  expect(state.disappear).toHaveLength(1);
});

test("Disappear: the token resolves after the target's next turn, not before", () => {
  let state = craftSet(
    ["banker", "director", "mercenary", "peacekeeper", "politician"],
    [[ANN, ["mercenary", "banker"]]],
    "disappear-timing",
    SEATS3,
  );
  state = withCoins(state, ANN, 3);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "mercenary", target: BOB } : null,
  );
  state = advance(state, pass);
  state = advance(state, pass);
  expect(state.disappear).toEqual([{ target: BOB, turns: 1 }]);
  // The turn passes to Bob; he still holds both cards during his turn.
  expect(state.active).toBe(BOB);
  expect(rawHand(state, BOB)).toHaveLength(2);
  state = advance(state, (seat, s) => (seat === s.active ? { t: "income" } : null));
  // Now the token fires.
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(state.disappear).toEqual([]);
});

test("Disappear: multiple tokens on one target stack their losses", () => {
  let state = craftSet(
    ["banker", "director", "mercenary", "peacekeeper", "politician"],
    [[ANN, ["mercenary", "banker"]]],
    "disappear-stack",
    SEATS3,
  );
  state = {
    ...state,
    disappear: [
      { target: BOB, turns: 1 },
      { target: BOB, turns: 1 },
    ],
  };
  state = advance(state, (seat, s) => (seat === s.active ? { t: "income" } : null));
  expect(state.active).toBe(BOB);
  state = advance(state, (seat, s) => (seat === s.active ? { t: "income" } : null));
  // Two stacked tokens queue two reveals.
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(0);
});

test("Disappear: the token is discarded if the target is eliminated first", () => {
  let state = craftSet(
    ["banker", "director", "guerrilla", "peacekeeper", "politician"],
    [[ANN, ["guerrilla", "banker"]]],
    "disappear-dead",
    SEATS3,
  );
  state = withCoins(state, ANN, 4);
  state = {
    ...state,
    disappear: [{ target: BOB, turns: 1 }],
    players: state.players.map((p) => (p.seat === BOB ? { ...p, hand: ["banker"] } : p)),
  };
  // Ann eliminates Bob before the token resolves.
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "guerrilla", target: BOB } : null,
  );
  state = advance(state, pass);
  state = advance(state, pass);
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(0);
  expect(state.disappear).toEqual([]);
});

test("Disappear: the token still resolves after the target gains Peacekeeping", () => {
  let state = craftSet(
    ["banker", "director", "mercenary", "peacekeeper", "politician"],
    [[ANN, ["mercenary", "banker"]]],
    "disappear-peace",
    SEATS3,
  );
  state = withCoins(state, ANN, 3);
  state = { ...state, disappear: [{ target: BOB, turns: 1 }] };
  state = withPeacekeeping(state, BOB);
  state = advance(state, (seat, s) => (seat === s.active ? { t: "income" } : null));
  expect(state.active).toBe(BOB);
  expect(state.disappear).toEqual([{ target: BOB, turns: 1 }]);
  state = advance(state, (seat, s) => (seat === s.active ? { t: "income" } : null));
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(state.disappear).toEqual([]);
});

test("Mercenary: tokens stack, fire once each, and are discarded with a dead target", () => {
    const set: readonly RoleId[] = ["banker", "director", "mercenary", "politician", "peacekeeper"];
    const turnWindow = (seat: SeatId): G54State["steps"][number] => ({
      kind: "window",
      window: { kind: "turn", purpose: "turn", seats: [seat], cause: null },
    });
    let state = craftSet(set, [[BOB, ["banker", "banker"]]], "edge-merc-stack");
    state = {
      ...state,
      active: BOB,
      steps: [turnWindow(BOB)],
      disappear: [
        { target: BOB, turns: 1 },
        { target: BOB, turns: 1 },
      ],
    };
    state = advance(state, (seat, s) => (seat === s.active ? { t: "income" } : null));
    expect(openPurpose(state)).toBe("reveal");
    state = advance(state, () => null);
    expect(rawHand(state, BOB)).toHaveLength(1);
    state = advance(state, () => null);
    expect(rawHand(state, BOB)).toHaveLength(0);
    expect(state.disappear).toHaveLength(0);

    let dead = craftSet(
      set,
      [
        [ANN, ["banker", "banker"]],
        [BOB, ["banker"]],
      ],
      "edge-merc-dead",
    );
    dead = withCoins(dead, ANN, 8);
    dead = { ...dead, disappear: [{ target: BOB, turns: 1 }] };
    dead = advance(dead, (seat, s) => (seat === s.active ? { t: "coup", target: BOB } : null));
    dead = advance(dead, () => null);
    expect(rawHand(dead, BOB)).toHaveLength(0);
    expect(dead.disappear).toHaveLength(0);
  });
