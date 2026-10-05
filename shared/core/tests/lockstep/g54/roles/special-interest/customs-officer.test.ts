import { expect, test } from "vitest";
import {
  ANN,
  BOB,
  CARA,
  advance,
  craftSet,
  openPurpose,
  rawCoins,
  withCoins,
  withTax,
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
    hand: ["customs-officer", "banker"],
    lieHand: ["banker", "banker"],
    coins: 3,
    target: null,
    blockHand: ["banker", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "customs-mark", "turn"],
        tax: { role: "customs-officer", holder: seatId("ann") },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "customs-mark", "turn"],
        hands: { cara: -1 },
        tax: { role: "customs-officer", holder: seatId("ann") },
      },
    },
  };

describeMatrix("customs-officer", record);

test("Customs Officer: take the Tax tokens and mark a role", () => {
  let state = craftSet(
    specialSet("customs-officer"),
    [[ANN, ["customs-officer", "banker"]]],
    "customs-action",
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "customs-officer", target: null } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("customs-mark");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "banker", target: null } : null,
  );
  expect(state.tax).toEqual({ role: "banker", holder: ANN });
});

test("Customs Officer: the tax is charged before the challenge window", () => {
  let state = craftSet(specialSet("customs-officer"), [[BOB, ["banker", "banker"]]], "customs-tax");
  // Ann holds the tax on Banker; Ann's income hands the turn to Bob.
  state = { ...state, tax: { role: "banker", holder: ANN } };
  state = advance(state, (seat, s) => (seat === s.active ? { t: "income" } : null));
  expect(state.active).toBe(BOB);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "banker", target: null } : null,
  );
  // The tax is paid to Ann the moment Bob claims, before any challenge.
  expect(rawCoins(state, BOB)).toBe(1);
  expect(rawCoins(state, ANN)).toBe(4);
  expect(openPurpose(state)).toBe("challenge-claim");
});

test("Customs Officer: a new claim moves the mark", () => {
  let state = craftSet(
    specialSet("customs-officer"),
    [[BOB, ["customs-officer", "banker"]]],
    "customs-move",
  );
  state = { ...state, tax: { role: "banker", holder: ANN }, active: ANN };
  state = advance(state, (seat, s) => (seat === s.active ? { t: "income" } : null));
  expect(state.active).toBe(BOB);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "customs-officer", target: null } : null,
  );
  state = advance(state, pass);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "guerrilla", target: ANN } : null,
  );
  expect(state.tax).toEqual({ role: "guerrilla", holder: BOB });
});

test("Customs Officer: a Spy pays the Tax on both claims of the taxed role", () => {
  let state = craftSet(
    ["spy", "director", "guerrilla", "customs-officer", "politician"],
    [[ANN, ["spy", "banker"]]],
    "customs-spy",
  );
  state = withTax(state, "spy", CARA);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "spy", target: null } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("spy-second");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "spy", target: null } : null,
  );
  // Both Spy claims of the taxed role pay: the holder gains 2.
  expect(rawCoins(state, CARA)).toBe(4);
  expect(openPurpose(state)).toBe("challenge-claim");
});

test("Customs Officer: the holder keeps the Tax when the taxed claim fails", () => {
  let state = craftSet(
    specialSet("customs-officer"),
    [[BOB, ["guerrilla", "guerrilla"]]],
    "customs-fail",
  );
  state = withTax(state, "banker", CARA);
  state = advance(state, (seat, s) => (seat === s.active ? { t: "income" } : null));
  expect(state.active).toBe(BOB);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "banker", target: null } : null,
  );
  expect(rawCoins(state, CARA)).toBe(3);
  state = advance(state, (seat) => (seat === ANN ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  // The claim failed, but the Tax was charged before the challenge and is kept.
  expect(rawCoins(state, CARA)).toBe(3);
  expect(rawCoins(state, BOB)).toBe(1);
});

test("Tax: the mark applies to a role with no cost", () => {
  let state = craftSet(consularSet, [[BOB, ["director", "banker"]]], "tax-director");
  state = { ...state, tax: { role: "director", holder: ANN } };
  state = advance(state, (seat, s) => (seat === s.active ? { t: "income" } : null));
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "director", target: null } : null,
  );
  expect(rawCoins(state, BOB)).toBe(1);
  expect(rawCoins(state, ANN)).toBe(4);
});

test("Tax: the holder is not taxed on their own claim", () => {
  let state = craftSet(consularSet, [[ANN, ["banker", "banker"]]], "tax-self");
  state = { ...state, tax: { role: "banker", holder: ANN } };
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "banker", target: null } : null,
  );
  expect(rawCoins(state, ANN)).toBe(2);
});

test("Customs Officer: the Tax is charged on a Spy's second claim", () => {
    let state = craftSet(
      ["spy", "director", "guerrilla", "customs-officer", "politician"],
      [[BOB, ["spy", "customs-officer"]]],
      "edge-tax-spy",
    );
    state = withTax(state, "customs-officer", CARA);
    state = withCoins(state, BOB, 3);
    state = advance(state, (seat, s) => (seat === s.active ? { t: "income" } : null));
    expect(state.active).toBe(BOB);
    state = advance(state, (seat, s) =>
      seat === s.active ? { t: "claim", role: "spy", target: null } : null,
    );
    state = advance(state, () => null);
    expect(openPurpose(state)).toBe("spy-second");
    state = advance(state, (seat, s) =>
      seat === s.active ? { t: "claim", role: "customs-officer", target: null } : null,
    );
    // The Tax is charged per claim: the Spy claim and the second claim both pay.
    expect(rawCoins(state, BOB)).toBe(3);
    expect(rawCoins(state, CARA)).toBe(3);
  });
