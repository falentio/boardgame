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
  withTreaty,
  type RoleId,
} from "../../driver.ts";
import {
  describeMatrix,
  pass,
  type RoleRecord,
} from "../matrix-driver.ts";
import {
  seatId,
} from "../../../../../index.ts";

/** A three-seat set with two Special Interest roles: the tested one and Politician. */
const specialSet = (special: RoleId): readonly RoleId[] => [
  "banker",
  "director",
  "guerrilla",
  special,
  "politician",
];

const consularSet: readonly RoleId[] = [
  "banker",
  "director",
  "guerrilla",
  "foreign-consular",
  "politician",
];

const record: RoleRecord = {
    hand: ["foreign-consular", "banker"],
    lieHand: ["banker", "banker"],
    coins: 3,
    target: BOB,
    blockHand: ["banker", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "turn"],
        treaty: [seatId("ann"), seatId("bob")],
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { cara: -1 },
        treaty: [seatId("ann"), seatId("bob")],
      },
    },
  };

describeMatrix("foreign-consular", record);

test("Foreign Consular: take a Treaty token and ally with another player", () => {
  let state = craftSet(
    specialSet("foreign-consular"),
    [[ANN, ["foreign-consular", "banker"]]],
    "consular-action",
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "foreign-consular", target: BOB } : null,
  );
  state = advance(state, pass);
  expect(state.treaty).toEqual([ANN, BOB]);
});

test("Foreign Consular: allies cannot target each other", () => {
  let state = withCoins(
    craftSet(specialSet("foreign-consular"), [[ANN, ["guerrilla", "banker"]]], "consular-ally"),
    ANN,
    4,
  );
  state = { ...state, treaty: [ANN, BOB] };
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "guerrilla", target: BOB } : null,
  );
  // The illegal ally target coerces to Income.
  expect(rawCoins(state, ANN)).toBe(5);
  expect(rawHand(state, BOB)).toHaveLength(2);
});

test("Foreign Consular: an ally may challenge an ally", () => {
  let state = craftSet(
    specialSet("foreign-consular"),
    [[ANN, ["foreign-consular", "banker"]]],
    "consular-ally-challenge",
  );
  state = withTreaty(state, [ANN, BOB]);
  // Ann cannot target her ally Bob, so she names Cara; Bob may still challenge her.
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "foreign-consular", target: CARA } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  expect(openPurpose(state)).toBe("proof-claim");
  expect(state.pending?.challenger).toBe(BOB);
});

test("Foreign Consular: a successful challenge costs a life and no treaty forms", () => {
  let state = craftSet(
    specialSet("foreign-consular"),
    [[ANN, ["banker", "banker"]]],
    "consular-lie",
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "foreign-consular", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(state.treaty).toEqual([]);
});

test("Foreign Consular: a failed challenge costs the challenger a life, then the treaty forms", () => {
  let state = craftSet(
    specialSet("foreign-consular"),
    [[ANN, ["foreign-consular", "banker"]]],
    "consular-true",
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "foreign-consular", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(state.treaty).toEqual([ANN, BOB]);
});

test("Treaty: an ally cannot be targeted by a Coup either", () => {
  let state = withCoins(
    craftSet(consularSet, [[ANN, ["banker", "banker"]]], "treaty-coup"),
    ANN,
    8,
  );
  state = { ...state, treaty: [ANN, BOB] };
  // Ann's requested Coup on her ally Bob is illegal, so it lands on Cara instead.
  state = advance(state, (seat, s) => (seat === s.active ? { t: "coup", target: BOB } : null));
  expect(rawHand(state, BOB)).toHaveLength(2);
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, pass);
  expect(rawHand(state, CARA)).toHaveLength(1);
});

test("Treaty: the treaty expires when only two players remain", () => {
  let state = withCoins(
    craftSet(consularSet, [[ANN, ["banker", "banker"]]], "treaty-expire"),
    ANN,
    8,
  );
  state = { ...state, treaty: [ANN, BOB] };
  // Cara has one card; a Coup eliminates her, leaving Ann and Bob as the final two.
  state = withCoins(state, CARA, 0);
  state = {
    ...state,
    players: state.players.map((p) => (p.seat === CARA ? { ...p, hand: ["banker"] } : p)),
  };
  state = advance(state, (seat, s) => (seat === s.active ? { t: "coup", target: CARA } : null));
  state = advance(state, pass);
  // Two players left: the treaty expires, so the ally shield is gone.
  expect(state.treaty).toEqual([]);
});

test("Foreign Consular: a new treaty reassigns the old one, allies cannot target each other, and it expires at two", () => {
    const set: readonly RoleId[] = [
      "banker",
      "director",
      "guerrilla",
      "foreign-consular",
      "politician",
    ];
    let state = craftSet(set, [[ANN, ["foreign-consular", "banker"]]], "edge-treaty-reassign");
    state = withTreaty(state, [BOB, CARA]);
    state = advance(state, (seat, s) =>
      seat === s.active ? { t: "claim", role: "foreign-consular", target: BOB } : null,
    );
    state = advance(state, () => null);
    expect(state.treaty).toEqual([ANN, BOB]);

    let allied = craftSet(set, [[ANN, ["guerrilla", "banker"]]], "edge-treaty-ally");
    allied = withTreaty(allied, [ANN, BOB]);
    allied = withCoins(allied, ANN, 4);
    allied = advance(allied, (seat, s) =>
      seat === s.active ? { t: "claim", role: "guerrilla", target: BOB } : null,
    );
    // The illegal ally target coerces to Income.
    expect(rawCoins(allied, ANN)).toBe(5);
    expect(rawHand(allied, BOB)).toHaveLength(2);

    let expiring = craftSet(
      set,
      [
        [ANN, ["banker", "banker"]],
        [CARA, ["banker"]],
      ],
      "edge-treaty-expire",
    );
    expiring = withTreaty(expiring, [ANN, BOB]);
    expiring = withCoins(expiring, ANN, 8);
    expiring = advance(expiring, (seat, s) =>
      seat === s.active ? { t: "coup", target: CARA } : null,
    );
    expiring = advance(expiring, () => null);
    // Two players left: the treaty expires.
    expect(expiring.treaty).toEqual([]);
  });
