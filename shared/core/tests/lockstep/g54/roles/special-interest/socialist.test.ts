import { expect, test } from "vitest";
import {
  ANN,
  BOB,
  CARA,
  advance,
  craftSet,
  openPurpose,
  play,
  rawCoins,
  rawHand,
  totalCards,
  totalCoins,
  withCoins,
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
    hand: ["socialist", "banker"],
    lieHand: ["banker", "banker"],
    coins: 3,
    target: null,
    blockHand: ["socialist", "banker", "banker"],
    expect: {
      // Both rivals pay a coin, then the actor's keep window is a no-op swap.
      resolve: {
        purposes: ["challenge-claim", "block", "socialist-give", "block", "socialist-give", "socialist-keep", "turn"],
        coins: { ann: 2, bob: -1, cara: -1 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "block", "socialist-give", "block", "socialist-give", "socialist-keep", "turn"],
        coins: { ann: 2, bob: -1, cara: -1 },
        hands: { cara: -1 },
      },
      block: {
        purposes: ["challenge-claim", "block", "challenge-block", "block", "socialist-give", "socialist-keep", "turn"],
        coins: { ann: 1, cara: -1 },
      },
      blockLie: {
        purposes: ["challenge-claim", "block", "challenge-block", "proof-block", "reveal", "socialist-give", "block", "socialist-give", "socialist-keep", "turn"],
        coins: { ann: 2, bob: -1, cara: -1 },
        hands: { bob: -1 },
      },
      blockTruth: {
        purposes: ["challenge-claim", "block", "challenge-block", "proof-block", "reveal", "block", "socialist-give", "socialist-keep", "turn"],
        coins: { ann: 1, cara: -1 },
        hands: { cara: -1 },
      },
    },
  };

describeMatrix("socialist", record);

test("Socialist: each target gives a coin or a card; the actor keeps one and deals the rest back", () => {
  let state = craftSet(specialSet("socialist"), [[ANN, ["socialist", "banker"]]], "soc-give");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "socialist", target: null } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("block");
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("socialist-give");
  state = advance(state, (seat) => (seat === BOB ? { t: "pay" } : null));
  expect(openPurpose(state)).toBe("block");
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("socialist-give");
  state = advance(state, (seat) => (seat === CARA ? { t: "give", index: 0 } : null));
  expect(openPurpose(state)).toBe("socialist-keep");
  state = advance(state, (seat, s) => (seat === s.active ? { t: "keep", indices: [0, 2] } : null));
  // Ann collected Bob's coin and swapped one card with Cara: every hand size holds.
  expect(rawCoins(state, ANN)).toBe(3);
  expect(rawHand(state, ANN)).toHaveLength(2);
  expect(rawHand(state, BOB)).toHaveLength(2);
  expect(rawHand(state, CARA)).toHaveLength(2);
  expect(totalCards(state)).toBe(15);
  expect(totalCoins(state)).toBe(50);
});

test("Socialist: a target with no coins must give a card", () => {
  let state = withCoins(
    craftSet(specialSet("socialist"), [[ANN, ["socialist", "banker"]]], "soc-nocoin"),
    BOB,
    0,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "socialist", target: null } : null,
  );
  state = advance(state, pass);
  state = advance(state, pass);
  // Bob reports `pay` but holds no coins, so the coercion takes a card instead.
  state = advance(state, (seat) => (seat === BOB ? { t: "pay" } : null));
  expect(state.socialist?.givers).toEqual([BOB]);
  expect(state.socialist?.pool).toHaveLength(1);
  expect(rawHand(state, BOB)).toHaveLength(1);
});

test("Socialist: a blocking target keeps their stake and gives nothing", () => {
  let state = withCoins(
    craftSet(specialSet("socialist"), [[ANN, ["socialist", "banker"]]], "soc-block"),
    BOB,
    3,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "socialist", target: null } : null,
  );
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === BOB ? { t: "block", role: "socialist" } : null));
  // The block opens its own challenge window; Cara declines to challenge it.
  state = advance(state, pass);
  expect(rawCoins(state, BOB)).toBe(3);
  expect(rawHand(state, BOB)).toHaveLength(2);
  // Cara's own give window still opens.
  expect(openPurpose(state)).toBe("block");
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("socialist-give");
});

test("Socialist: a challenged block costs a life but the give still runs", () => {
  let state = withCoins(
    craftSet(specialSet("socialist"), [[ANN, ["socialist", "banker"]]], "soc-blocklie"),
    BOB,
    3,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "socialist", target: null } : null,
  );
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === BOB ? { t: "block", role: "socialist" } : null));
  state = advance(state, (seat) => (seat === CARA ? { t: "challenge" } : null));
  state = advance(state, (seat) => (seat === BOB ? { t: "concede" } : null));
  // The failed block costs Bob a life, then his give window opens.
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(openPurpose(state)).toBe("socialist-give");
});

// ---------------------------------------------------------------------------
// Socialist
// ---------------------------------------------------------------------------

test("Socialist: the actor's keep is a one-for-one swap, so every hand size is preserved", () => {
  let state = craftSet(
    anarchySet("socialist"),
    [[ANN, ["socialist", "banker"]], [BOB, ["director", "guerrilla"]], [CARA, ["peacekeeper", "politician"]]],
    "soc-sizes",
  );
  const cards = totalCards(state);
  const coins = totalCoins(state);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "socialist", target: null } : null,
  );
  state = advance(state, pass);
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === BOB ? { t: "give", index: 0 } : null));
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === CARA ? { t: "give", index: 0 } : null));
  expect(openPurpose(state)).toBe("socialist-keep");
  expect(state.socialist?.pool).toHaveLength(2);
  state = advance(state, (seat, s) => (seat === s.active ? { t: "keep", indices: [0, 2] } : null));
  for (const seat of [ANN, BOB, CARA]) expect(rawHand(state, seat)).toHaveLength(2);
  expect(totalCards(state)).toBe(cards);
  expect(totalCoins(state)).toBe(coins);
});

test("Socialist: a card-giver who is eliminated mid-sub-turn still conserves the deck", () => {
  let state = craftSet(
    anarchySet("socialist"),
    [[ANN, ["socialist", "banker"]], [BOB, ["director"]]],
    "soc-giver-dies",
  );
  const cards = totalCards(state);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "socialist", target: null } : null,
  );
  state = advance(state, pass);
  state = advance(state, pass);
  // Bob gives his only card; he is now cardless but still in play as a giver.
  state = advance(state, (seat) => (seat === BOB ? { t: "give", index: 0 } : null));
  expect(state.socialist?.givers).toEqual([BOB]);
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === CARA ? { t: "give", index: 0 } : null));
  expect(openPurpose(state)).toBe("socialist-keep");
  expect(totalCards(state)).toBe(cards);
  state = advance(state, (seat, s) => (seat === s.active ? { t: "keep", indices: [0, 2] } : null));
  // The redistribution returns Bob's card; the deck never loses a card.
  expect(totalCards(state)).toBe(cards);
});

test("Socialist: the collected pool is visible only to the actor", () => {
  let state = craftSet(
    anarchySet("socialist"),
    [[ANN, ["socialist", "banker"]], [BOB, ["director", "guerrilla"]], [CARA, ["peacekeeper", "politician"]]],
    "soc-hidden",
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "socialist", target: null } : null,
  );
  state = advance(state, pass);
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === BOB ? { t: "give", index: 0 } : null));
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === CARA ? { t: "give", index: 0 } : null));
  expect(openPurpose(state)).toBe("socialist-keep");
  // The actor sees the collected cards; a rival sees only hand counts.
  expect(g54.project(state, ANN).mySocialist).toEqual(state.socialist?.pool);
  expect(g54.project(state, BOB).mySocialist).toBeNull();
  for (const player of g54.project(state, BOB).players) {
    expect(Object.keys(player)).not.toContain("mySocialist");
    expect(Object.keys(player)).not.toContain("pool");
  }
});
