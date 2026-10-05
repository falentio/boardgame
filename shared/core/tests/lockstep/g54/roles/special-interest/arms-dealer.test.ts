import { expect, test } from "vitest";
import {
  ANN,
  CARA,
  advance,
  craftSet,
  play,
  rawCoins,
  totalCards,
  withCourt,
  type RoleId,
} from "../../driver.ts";
import {
  describeMatrix,
  pass,
  type RoleRecord,
} from "../matrix-driver.ts";
import { g54 } from "../../../../../lockstep/games/g54/index.ts";
import { specOf } from "../../../../../lockstep/games/g54/roles.ts";

/** A three-seat set with two Special Interest roles: the tested one and Politician. */
const specialSet = (special: RoleId): readonly RoleId[] => [
  "banker",
  "director",
  "guerrilla",
  special,
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
    hand: ["arms-dealer", "banker"],
    lieHand: ["banker", "banker"],
    coins: 3,
    named: "banker",
    // The deck's first two cards both name Banker, so the reveal always matches.
    court: ["banker", "banker", "director", "guerrilla", "politician", "peacekeeper"],
    target: null,
    blockHand: ["banker", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "turn"],
        coins: { ann: 4 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        coins: { ann: 4 },
        hands: { cara: -1 },
      },
    },
  };

describeMatrix("arms-dealer", record);

test("Arms Dealer: a match on either flipped card pays 4 and leaves the deck unchanged", () => {
  const cards = totalCards(craftSet(specialSet("arms-dealer"), [], "arms-count"));
  let state = withCourt(
    craftSet(specialSet("arms-dealer"), [[ANN, ["arms-dealer", "banker"]]], "arms-match"),
    ["banker", "banker", "director", "guerrilla", "politician", "peacekeeper", "banker", "banker", "banker"],
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "arms-dealer", target: null, named: "banker" } : null,
  );
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(6);
  expect(state.arms).toEqual({ seat: ANN, named: "banker", cards: ["banker", "banker"], matched: true });
  expect(totalCards(state)).toBe(cards);
});

test("Arms Dealer: no match pays nothing", () => {
  let state = withCourt(
    craftSet(specialSet("arms-dealer"), [[ANN, ["arms-dealer", "banker"]]], "arms-miss"),
    ["director", "guerrilla", "banker", "banker", "politician", "peacekeeper", "banker", "banker", "banker"],
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "arms-dealer", target: null, named: "banker" } : null,
  );
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(2);
  expect(state.arms?.matched).toBe(false);
});

test("Arms Dealer: a double match still pays 4, not 8", () => {
  let state = withCourt(
    craftSet(specialSet("arms-dealer"), [[ANN, ["arms-dealer", "banker"]]], "arms-double"),
    ["banker", "banker", "banker", "banker", "banker", "banker", "banker", "banker", "banker"],
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "arms-dealer", target: null, named: "banker" } : null,
  );
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(6);
});

// ---------------------------------------------------------------------------
// Arms Dealer
// ---------------------------------------------------------------------------

test("Arms Dealer: the named role is public and the deck stays constant", () => {
  const before = craftSet(anarchySet("arms-dealer"), [[ANN, ["arms-dealer", "banker"]]], "arms-public");
  const cards = totalCards(before);
  let state = withCourt(before, ["financier", "financier", "director", "guerrilla", "politician", "peacekeeper", "banker", "banker", "banker"]);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "arms-dealer", target: null, named: "financier" } : null,
  );
  state = advance(state, pass);
  const view = g54.project(state, CARA);
  expect(view.arms).toEqual({ seat: ANN, named: "financier", cards: ["financier", "financier"], matched: true });
  expect(totalCards(state)).toBe(cards);
});

test("Arms Dealer: naming a role not in play coerces to an in-play role", () => {
  let state = withCourt(
    craftSet(anarchySet("arms-dealer"), [[ANN, ["arms-dealer", "banker"]]], "arms-coerce"),
    ["director", "director", "guerrilla", "politician", "peacekeeper", "banker", "banker", "banker", "banker"],
  );
  // Banker is not in the set, so the named role coerces to the first role (Financier).
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "arms-dealer", target: null, named: "banker" } : null,
  );
  state = advance(state, pass);
  expect(state.arms?.named).toBe("financier");
});

test("Arms Dealer: a short Treasury clamps the payout", () => {
  let state = withCourt(
    craftSet(anarchySet("arms-dealer"), [[ANN, ["arms-dealer", "banker"]]], "arms-short"),
    ["financier", "financier", "director", "guerrilla", "politician", "peacekeeper", "banker", "banker", "banker"],
  );
  state = { ...state, treasury: 2 };
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "arms-dealer", target: null, named: "financier" } : null,
  );
  state = advance(state, pass);
  expect(state.arms?.matched).toBe(true);
  expect(rawCoins(state, ANN)).toBe(4);
  expect(state.treasury).toBe(0);
});
