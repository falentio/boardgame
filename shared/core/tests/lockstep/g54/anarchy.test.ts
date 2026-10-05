/**
 * Bespoke Anarchy coverage: the sub-window roles (Anarchist/Bomb, Paramilitary,
 * Financier, Plantation Owner, Arms Dealer, Socialist) and the two general
 * actions (Bank, Social Media). The generic matrix drives every catalog id; these
 * tests pin the mechanics a declarative record cannot express.
 */
import { expect, test } from "vitest";
import {
  ANN,
  BOB,
  CARA,
  advance,
  craftSet,
  openPurpose,
  rawCoins,
  rawFrame,
  rawHand,
  rawStep,
  totalCards,
  totalCoins,
  withBank,
  withCoins,
  withCourt,
} from "./driver.ts";
import type { RoleId } from "./driver.ts";
import { specOf } from "../../../lockstep/games/g54/roles.ts";
import { g54 } from "../../../lockstep/games/g54/index.ts";

const pass = (): null => null;

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

// ---------------------------------------------------------------------------
// General actions
// ---------------------------------------------------------------------------

test("Bank: a pile built across turns is swept by a single Financier claim", () => {
  let state = withCoins(
    craftSet(anarchySet("financier"), [[ANN, ["financier", "banker"]]], "bank-across"),
    ANN,
    2,
  );
  state = advance(state, (seat, s) => (seat === s.active ? { t: "bank" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "bank" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "bank" } : null));
  expect(state.bank).toBe(3);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "financier", target: null } : null,
  );
  state = advance(state, pass);
  expect(state.bank).toBe(0);
  expect(rawCoins(state, ANN)).toBe(5);
});

test("Social Media: neither challenge nor block window opens", () => {
  const state0 = craftSet(
    ["banker", "director", "guerrilla", "arms-dealer", "socialist"],
    [[ANN, ["banker", "banker"]]],
    "sm-nowindows",
    undefined,
    { socialMedia: true },
  );
  let state = advance(state0, (seat, s) => (seat === s.active ? { t: "social-media" } : null));
  // Straight to keep: no `challenge-claim`, no `block`.
  expect(openPurpose(state)).toBe("keep");
  state = advance(state, (seat, s) => (seat === s.active ? { t: "keep", indices: [0] } : null));
  expect(openPurpose(state)).toBe("turn");
});

// ---------------------------------------------------------------------------
// Totality under hostile reports
// ---------------------------------------------------------------------------

test("step is total across an Anarchy game under rotating hostile reports", () => {
  const HOSTILE: readonly (import("./driver.ts").G54Action | null)[] = [
    null,
    { t: "pass" },
    { t: "challenge" },
    { t: "show" },
    { t: "concede" },
    { t: "reveal", index: 999 },
    { t: "keep", indices: [9, 9] },
    { t: "give", index: 42 },
    { t: "block", role: "socialist" },
    { t: "pay" },
    { t: "no" },
    { t: "bank" },
    { t: "social-media" },
    { t: "claim", role: "anarchist", target: ANN },
    { t: "claim", role: "paramilitary", target: BOB },
    { t: "claim", role: "financier", target: null },
    { t: "claim", role: "socialist", target: null },
    { t: "coup", target: ANN },
  ];
  const roles: readonly RoleId[] = ["financier", "director", "anarchist", "arms-dealer", "socialist"];
  let state = craftSet(roles, [], "anarchy-hostile", undefined, { socialMedia: true });
  let cursor = 0;
  for (let i = 0; i < 3000 && !g54.isTerminal(state); i += 1) {
    const action = HOSTILE[cursor % HOSTILE.length] ?? null;
    cursor += 1;
    state = advance(state, (seat, s) => (seat === s.active ? action : null));
    // Every hostile frame advances without throwing; a non-terminal state keeps a stack.
    if (!g54.isTerminal(state)) expect(state.steps.length).toBeGreaterThan(0);
  }
  expect(g54.isTerminal(state) || state.steps.length > 0).toBe(true);
});
