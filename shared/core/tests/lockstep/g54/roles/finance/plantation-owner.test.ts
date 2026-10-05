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
  seatsOwedAt,
  type RoleId,
} from "../../driver.ts";
import {
  describeMatrix,
  pass,
  type RoleRecord,
} from "../matrix-driver.ts";
import { specOf } from "../../../../../lockstep/games/g54/roles.ts";

/** A three-seat set whose Finance role is the one under test. */
const financeSet = (finance: RoleId): readonly RoleId[] => [
  finance,
  "director",
  "guerrilla",
  "peacekeeper",
  "politician",
];

/** A legal 1/1/1/2 Anarchy set whose category slot holds the role under test. */
const anarchySet = (role: RoleId): readonly RoleId[] => {
  const cat = specOf(role).category;
  const specials: RoleId[] =
    cat === "special-interest"
      ? [role, role === "arms-dealer" ? "socialist" : "arms-dealer"]
      : ["arms-dealer", "socialist"];
  return [
    cat === "finance" ? role : "financier",
    cat === "communications" ? role : "director",
    cat === "force" ? role : "guerrilla",
    ...specials,
  ];
};

const record: RoleRecord = {
    hand: ["plantation-owner", "banker"],
    lieHand: ["banker", "banker"],
    coins: 3,
    target: null,
    blockHand: ["banker", "banker", "banker"],
    expect: {
      // Ann takes 1 and is the sole surviving claimant, so the payout is 1.
      resolve: {
        purposes: ["challenge-claim", "capitalist", "plantation-payout", "turn"],
        coins: { ann: 2 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "capitalist", "plantation-payout", "turn"],
        coins: { ann: 2 },
        hands: { cara: -1 },
      },
    },
  };

describeMatrix("plantation-owner", record);

test("Plantation Owner: take 1, then each survivor gains 1 per survivor", () => {
  let state = craftSet(
    financeSet("plantation-owner"),
    [[ANN, ["plantation-owner", "banker"]]],
    "plant-payout",
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "plantation-owner", target: null } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("capitalist");
  state = advance(state, (seat) =>
    seat === BOB ? { t: "claim", role: "plantation-owner", target: null } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("plantation-payout");
  state = advance(state, pass);
  // Payout is 2 per survivor; Ann took 1 first, so Ann ends at 2 + 1 + 2 = 5, Bob at 2 + 2 = 4.
  expect(rawCoins(state, ANN)).toBe(5);
  expect(rawCoins(state, BOB)).toBe(4);
});

test("Plantation Owner: a failed claimant is excluded from the payout", () => {
  let state = craftSet(
    financeSet("plantation-owner"),
    [[ANN, ["plantation-owner", "banker"]]],
    "plant-fail",
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "plantation-owner", target: null } : null,
  );
  state = advance(state, pass);
  state = advance(state, (seat) =>
    seat === BOB ? { t: "claim", role: "plantation-owner", target: null } : null,
  );
  state = advance(state, (seat) => (seat === CARA ? { t: "challenge" } : null));
  state = advance(state, (seat) => (seat === BOB ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("plantation-payout");
  state = advance(state, pass);
  // Only Ann survives, so the payout is 1: Ann ends at 2 + 1 + 1 = 4, Bob stays at 2.
  expect(rawCoins(state, ANN)).toBe(4);
  expect(rawCoins(state, BOB)).toBe(2);
  expect(rawHand(state, BOB)).toHaveLength(1);
});

test("Plantation Owner: a short Treasury pays a partial payout", () => {
  let state = craftSet(
    financeSet("plantation-owner"),
    [[ANN, ["plantation-owner", "banker"]]],
    "plant-short",
  );
  // Treasury of 3: the take-1 leaves 2, then the 2-coin payout runs short.
  state = { ...state, treasury: 3 };
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "plantation-owner", target: null } : null,
  );
  state = advance(state, pass);
  state = advance(state, (seat) =>
    seat === BOB ? { t: "claim", role: "plantation-owner", target: null } : null,
  );
  state = advance(state, pass);
  state = advance(state, pass);
  // Two survivors each owed 2, but only 2 coins remain: Ann is paid, Bob is not.
  expect(rawCoins(state, ANN)).toBe(5);
  expect(rawCoins(state, BOB)).toBe(2);
  expect(state.treasury).toBe(0);
});

// ---------------------------------------------------------------------------
// Plantation Owner
// ---------------------------------------------------------------------------

test("Plantation Owner: the active player always counts toward the payout", () => {
  let state = craftSet(anarchySet("plantation-owner"), [[ANN, ["plantation-owner", "banker"]]], "plant-active");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "plantation-owner", target: null } : null,
  );
  state = advance(state, pass);
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("plantation-payout");
  state = advance(state, pass);
  // Sole survivor Ann is paid 1 on top of the take-1.
  expect(rawCoins(state, ANN)).toBe(4);
});

test("Plantation Owner: the mass-claim window owes every rival clockwise from the active seat", () => {
  let state = craftSet(
    anarchySet("plantation-owner"),
    [[ANN, ["plantation-owner", "banker"]]],
    "plant-order",
    [ANN, BOB, CARA, DAN],
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "plantation-owner", target: null } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("capitalist");
  expect(seatsOwedAt(state)).toEqual([BOB, CARA, DAN]);
});
