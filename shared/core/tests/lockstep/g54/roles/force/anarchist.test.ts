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
  rawFrame,
  rawHand,
  rawStep,
  totalCards,
  withCoins,
  withHand,
  type RoleId,
} from "../../driver.ts";
import {
  describeMatrix,
  pass,
  type RoleRecord,
} from "../matrix-driver.ts";
import { specOf } from "../../../../../lockstep/games/g54/roles.ts";

/** A three-seat set whose Force role is the one under test. */
const forceSet = (force: RoleId): readonly RoleId[] => [
  "banker",
  "director",
  force,
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
    hand: ["banker", "banker"],
    lieHand: ["banker", "banker"],
    coins: 3,
    target: BOB,
    blockHand: ["banker", "banker", "banker"],
    expect: {
      // Holdless: no challenge window; the Bomb lands on BOB, who neither passes
      // nor defuses, so he loses 1 influence and the Bomb returns to the centre.
      resolve: {
        purposes: ["bomb", "reveal", "turn"],
        coins: { ann: -3 },
        hands: { bob: -1 },
      },
    },
  };

describeMatrix("anarchist", record);

test("Anarchist: the Bomb lands and a silent holder loses a life; it returns to the centre", () => {
  let state = withCoins(
    craftSet(forceSet("anarchist"), [[ANN, ["anarchist", "banker"]]], "bomb-loss"),
    ANN,
    3,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "anarchist", target: BOB } : null,
  );
  // The claim is holdless: no challenge window, the Bomb window opens directly.
  expect(openPurpose(state)).toBe("bomb");
  expect(state.bomb).toEqual({ holder: BOB, prior: [ANN], move: null });
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(rawCoins(state, ANN)).toBe(0);
  expect(state.bomb).toBeNull();
});

test("Anarchist: a pass advances the chain and excludes every prior holder", () => {
  let state = withCoins(
    craftSet(forceSet("anarchist"), [[ANN, ["anarchist", "banker"]]], "bomb-pass"),
    ANN,
    3,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "anarchist", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "claim", role: "anarchist", target: CARA } : null));
  // A pass opens its own challenge window.
  expect(openPurpose(state)).toBe("challenge-claim");
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("bomb");
  expect(state.bomb).toEqual({ holder: CARA, prior: [ANN, BOB], move: null });
  // Cara defuses; the Bomb returns to the centre.
  state = advance(state, (seat) => (seat === CARA ? { t: "claim", role: "anarchist", target: null } : null));
  state = advance(state, pass);
  expect(state.bomb).toBeNull();
  expect(openPurpose(state)).toBe("turn");
});

test("Anarchist: a truthful challenged pass costs the challenger a life and the Bomb moves on", () => {
  let state = withCoins(
    craftSet(forceSet("anarchist"), [[ANN, ["anarchist", "banker"]]], "bomb-show"),
    ANN,
    3,
  );
  state = withHand(state, BOB, ["anarchist", "banker"]);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "anarchist", target: BOB } : null,
  );
  // Bob truthfully passes the Bomb to Cara; the pass opens its own challenge window.
  state = advance(state, (seat) => (seat === BOB ? { t: "claim", role: "anarchist", target: CARA } : null));
  expect(openPurpose(state)).toBe("challenge-claim");
  state = advance(state, (seat) => (seat === CARA ? { t: "challenge" } : null));
  expect(openPurpose(state)).toBe("proof-claim");
  state = advance(state, (seat) => (seat === BOB ? { t: "show" } : null));
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, pass);
  // The challenger pays a life; the shown pass stands and the Bomb continues to Cara.
  expect(rawHand(state, CARA)).toHaveLength(1);
  expect(openPurpose(state)).toBe("bomb");
  expect(state.bomb).toEqual({ holder: CARA, prior: [ANN, BOB], move: null });
});

test("Anarchist: the active player can never be named as the first Bomb target", () => {
  let state = withCoins(
    craftSet(forceSet("anarchist"), [[ANN, ["anarchist", "banker"]]], "bomb-self"),
    ANN,
    3,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "anarchist", target: ANN } : null,
  );
  // The self-target is illegal, so the claim falls back to Income.
  expect(rawCoins(state, ANN)).toBe(4);
  expect(state.bomb).toBeNull();
});

test("Anarchist: a caught pass is a double life loss and the Bomb clears", () => {
  let state = withCoins(
    craftSet(forceSet("anarchist"), [[ANN, ["anarchist", "banker"]]], "bomb-caught"),
    ANN,
    3,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "anarchist", target: BOB } : null,
  );
  // Bob lies: he passes to Cara but holds no Anarchist.
  state = advance(state, (seat) => (seat === BOB ? { t: "claim", role: "anarchist", target: CARA } : null));
  state = advance(state, (seat) => (seat === CARA ? { t: "challenge" } : null));
  state = advance(state, (seat) => (seat === BOB ? { t: "concede" } : null));
  // The challenge loss lands, then the bomb window resolves the failed claim.
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(0);
  expect(state.bomb).toBeNull();
});

test("Bomb: the Bomb clears when its holder is eliminated", () => {
  // A one-card Bomb holder bluffs a pass, is challenged, and concedes: the
  // challenge loss eliminates him while the Bomb is still set, so the queued
  // `settle` reaches `clearTokensFor`'s Bomb clause.
  let state = withCoins(
    craftSet(
      ["banker", "director", "anarchist", "peacekeeper", "politician"],
      [[ANN, ["anarchist", "banker"]], [BOB, ["banker"]]],
      "bomb-clear",
      SEATS3,
    ),
    ANN,
    3,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "anarchist", target: BOB } : null,
  );
  expect(state.bomb).toEqual({ holder: BOB, prior: [ANN], move: null });
  state = advance(state, (seat) =>
    seat === BOB ? { t: "claim", role: "anarchist", target: CARA } : null,
  );
  state = advance(state, (seat) => (seat === CARA ? { t: "challenge" } : null));
  state = advance(state, (seat) => (seat === BOB ? { t: "concede" } : null));
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, (seat) => (seat === BOB ? { t: "reveal", index: 0 } : null));
  expect(rawHand(state, BOB)).toHaveLength(0);
  expect(state.bomb).toBeNull();
});

// ---------------------------------------------------------------------------
// Bomb chain
// ---------------------------------------------------------------------------

test("Bomb: a holder cannot pass to a prior holder; the illegal pass becomes the loss", () => {
  let state = withCoins(
    craftSet(anarchySet("anarchist"), [[ANN, ["anarchist", "banker"]]], "bomb-prior"),
    ANN,
    3,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "anarchist", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "claim", role: "anarchist", target: CARA } : null));
  state = advance(state, pass);
  expect(state.bomb?.holder).toBe(CARA);
  // Cara tries to pass back to Ann (a prior holder): illegal, so she takes the loss.
  state = advance(state, (seat) => (seat === CARA ? { t: "claim", role: "anarchist", target: ANN } : null));
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, pass);
  expect(rawHand(state, CARA)).toHaveLength(1);
  expect(state.bomb).toBeNull();
});

test("Bomb: with no legal pass target the only counter is defuse", () => {
  let state = withCoins(
    craftSet(anarchySet("anarchist"), [[ANN, ["anarchist", "banker"]]], "bomb-nodefuse"),
    ANN,
    3,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "anarchist", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "claim", role: "anarchist", target: CARA } : null));
  state = advance(state, pass);
  // Prior holders are [Ann, Bob]; Cara has no legal pass target but may defuse.
  expect(state.bomb).toEqual({ holder: CARA, prior: [ANN, BOB], move: null });
  state = advance(state, (seat) => (seat === CARA ? { t: "claim", role: "anarchist", target: null } : null));
  state = advance(state, pass);
  expect(state.bomb).toBeNull();
  expect(rawHand(state, CARA)).toHaveLength(2);
});

test("Bomb: a pass claim that is caught is a double loss and the Bomb clears", () => {
  let state = withCoins(
    craftSet(anarchySet("anarchist"), [[ANN, ["anarchist", "banker"]]], "bomb-double"),
    ANN,
    3,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "anarchist", target: BOB } : null,
  );
  // Bob lies: he claims to pass to Cara but holds no Anarchist.
  state = advance(state, (seat) => (seat === BOB ? { t: "claim", role: "anarchist", target: CARA } : null));
  state = advance(state, (seat) => (seat === CARA ? { t: "challenge" } : null));
  state = advance(state, (seat) => (seat === BOB ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  // The Bomb window then resolves the failed claim: a second life lost.
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(0);
  expect(state.bomb).toBeNull();
});

test("Bomb: a caught defuse is a double loss and the Bomb clears", () => {
  let state = withCoins(
    craftSet(anarchySet("anarchist"), [[ANN, ["anarchist", "banker"]]], "bomb-defuse-double"),
    ANN,
    3,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "anarchist", target: BOB } : null,
  );
  // Bob lies: he claims to defuse but holds no Anarchist.
  state = advance(state, (seat) => (seat === BOB ? { t: "claim", role: "anarchist", target: null } : null));
  state = advance(state, (seat) => (seat === CARA ? { t: "challenge" } : null));
  state = advance(state, (seat) => (seat === BOB ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("bomb");
  // The failed claim costs Bob one influence, then the Bomb window resolves the
  // named defuse: a second life lost and the Bomb cleared.
  expect(rawHand(state, BOB)).toHaveLength(1);
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("reveal");
  expect(state.bomb).toBeNull();
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(0);
});

test("Bomb: the 3-coin cost stays paid on a defuse", () => {
  let state = withCoins(
    craftSet(anarchySet("anarchist"), [[ANN, ["anarchist", "banker"]]], "bomb-cost"),
    ANN,
    3,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "anarchist", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "claim", role: "anarchist", target: null } : null));
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(0);
  expect(state.bomb).toBeNull();
});

test("a Bomb holder who resigns mid-chain still ends the turn with the deck intact", () => {
  const state0 = withCoins(
    craftSet(anarchySet("anarchist"), [[ANN, ["anarchist", "banker"]]], "bomb-resign"),
    ANN,
    3,
  );
  const cards = totalCards(state0);
  let state = advance(state0, (seat, s) =>
    seat === s.active ? { t: "claim", role: "anarchist", target: BOB } : null,
  );
  expect(openPurpose(state)).toBe("bomb");
  // Bob resigns while holding the Bomb: the window voids, the Bomb clears.
  state = rawStep(state, rawFrame(0, [[BOB, { kind: "resign" }]]));
  expect(state.bomb).toBeNull();
  expect(totalCards(state)).toBe(cards);
});
