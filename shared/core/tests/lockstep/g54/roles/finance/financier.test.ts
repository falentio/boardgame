import { expect, test } from "vitest";
import {
  ANN,
  BOB,
  advance,
  craftSet,
  openPurpose,
  play,
  rawCoins,
  rawHand,
  withBank,
  withCoins,
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
    hand: ["financier", "banker"],
    lieHand: ["banker", "banker"],
    coins: 3,
    bank: 4,
    target: null,
    blockHand: ["banker", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "turn"],
        coins: { ann: 4 },
        bank: 0,
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
        bank: 4,
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        coins: { ann: 4 },
        hands: { cara: -1 },
        bank: 0,
      },
    },
  };

describeMatrix("financier", record);

test("Financier: the claim sweeps the whole Bank pile", () => {
  let state = withBank(
    withCoins(
      craftSet(financeSet("financier"), [[ANN, ["financier", "banker"]]], "fin-sweep"),
      ANN,
      2,
    ),
    6,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "financier", target: null } : null,
  );
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(8);
  expect(state.bank).toBe(0);
});

test("Financier: Bank replaces Income and grows the pile without touching the purse", () => {
  let state = withCoins(
    craftSet(financeSet("financier"), [[ANN, ["financier", "banker"]]], "fin-bank"),
    ANN,
    2,
  );
  state = advance(state, (seat, s) => (seat === s.active ? { t: "bank" } : null));
  expect(rawCoins(state, ANN)).toBe(2);
  expect(state.bank).toBe(1);
  expect(state.active).toBe(BOB);
  // An Income report is not a legal general action while Financier is in play: it
  // coerces to the fallback (Bank), still moving a coin into the pile.
  state = advance(state, (seat, s) => (seat === s.active ? { t: "income" } : null));
  expect(rawCoins(state, BOB)).toBe(2);
  expect(state.bank).toBe(2);
});

test("Financier: a successful challenge costs a life and the pile is not swept", () => {
  let state = withBank(
    craftSet(financeSet("financier"), [[ANN, ["banker", "banker"]]], "fin-lie"),
    5,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "financier", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(state.bank).toBe(5);
});

// ---------------------------------------------------------------------------
// Financier
// ---------------------------------------------------------------------------

test("Financier: the forced Coup counts the purse, never the Bank pile", () => {
  let state = withBank(
    withCoins(craftSet(anarchySet("guerrilla"), [[ANN, ["banker", "banker"]]], "fin-forced"), ANN, 10),
    9,
  );
  // At 10 coins the turn is a forced Coup regardless of the reported Bank action.
  state = advance(state, (seat, s) => (seat === s.active ? { t: "bank" } : null));
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(state.bank).toBe(9);
  expect(rawCoins(state, ANN)).toBe(3);
});

test("Financier: a truthful challenge costs the challenger a life, then the pile sweeps", () => {
  let state = withBank(
    withCoins(craftSet(anarchySet("guerrilla"), [[ANN, ["financier", "banker"]]], "fin-true"), ANN, 2),
    5,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "financier", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(rawCoins(state, ANN)).toBe(7);
  expect(state.bank).toBe(0);
});
