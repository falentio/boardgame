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
  totalCards,
  withCoins,
} from "./driver.ts";
import type { RoleId } from "./driver.ts";

/** A set with the reactive role under test plus a Force role to inflict losses. */
const reactiveSet = (reactive: RoleId): readonly RoleId[] => [
  "banker",
  "director",
  "guerrilla",
  reactive,
  "politician",
];

const pass = (): null => null;

/** Run a Guerrilla hit on Bob, revealing his first card (which is not the reactive one). */
const guerrillaHit = (state: ReturnType<typeof craftSet>) =>
  advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "guerrilla", target: BOB } : null,
  );

test("Missionary: after a non-Coup loss the holder may claim to take a Court card", () => {
  // Bob keeps Missionary face-down; the execution flips the Banker.
  let state = withCoins(
    craftSet(reactiveSet("missionary"), [[BOB, ["banker", "missionary"]]], "missionary-loss"),
    ANN,
    4,
  );
  const before = totalCards(state);
  state = guerrillaHit(state);
  state = advance(state, pass);
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, (seat) => (seat === BOB ? { t: "reveal", index: 0 } : null));
  expect(openPurpose(state)).toBe("reactive-missionary");
  state = advance(state, (seat) =>
    seat === BOB ? { t: "claim", role: "missionary", target: null } : null,
  );
  state = advance(state, pass);
  // The lost life is replaced by a Court card: hand size is restored.
  expect(rawHand(state, BOB)).toHaveLength(2);
  expect(totalCards(state)).toBe(before);
});

test("Missionary: a Coup loss does not open the Missionary window", () => {
  let state = withCoins(
    craftSet(reactiveSet("missionary"), [[BOB, ["banker", "missionary"]]], "missionary-coup"),
    ANN,
    8,
  );
  state = advance(state, (seat, s) => (seat === s.active ? { t: "coup", target: BOB } : null));
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, (seat) => (seat === BOB ? { t: "reveal", index: 0 } : null));
  expect(openPurpose(state)).toBe("turn");
});

test("Missionary: a successful challenge costs the claimant a second life", () => {
  let state = withCoins(
    craftSet(reactiveSet("missionary"), [[BOB, ["banker", "missionary"]]], "missionary-lie"),
    ANN,
    4,
  );
  state = guerrillaHit(state);
  state = advance(state, pass);
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === BOB ? { t: "reveal", index: 0 } : null));
  // Bob claims Missionary but Cara challenges and Bob concedes: he loses a second life.
  state = advance(state, (seat) =>
    seat === BOB ? { t: "claim", role: "missionary", target: null } : null,
  );
  state = advance(state, (seat) => (seat === CARA ? { t: "challenge" } : null));
  state = advance(state, (seat) => (seat === BOB ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(0);
});

test("Missionary: a failed challenge costs the challenger a life, then the card is drawn", () => {
  let state = withCoins(
    craftSet(reactiveSet("missionary"), [[BOB, ["banker", "missionary"]]], "missionary-true"),
    ANN,
    4,
  );
  state = guerrillaHit(state);
  state = advance(state, pass);
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === BOB ? { t: "reveal", index: 0 } : null));
  state = advance(state, (seat) =>
    seat === BOB ? { t: "claim", role: "missionary", target: null } : null,
  );
  state = advance(state, (seat) => (seat === CARA ? { t: "challenge" } : null));
  state = advance(state, (seat) => (seat === BOB ? { t: "show" } : null));
  // Cara's reveal for the failed challenge, then her own reactive window.
  state = advance(state, pass);
  state = advance(state, pass);
  expect(rawHand(state, CARA)).toHaveLength(1);
  expect(rawHand(state, BOB)).toHaveLength(2);
});

test("Missionary: a conceded challenge opens the window", () => {
  let state = withCoins(
    craftSet(
      reactiveSet("missionary"),
      [[ANN, ["missionary", "banker"]]],
      "missionary-concede",
    ),
    ANN,
    4,
  );
  // Ann bluffs a Guerrilla she does not hold; Bob challenges and she concedes.
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "guerrilla", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat) => (seat === ANN ? { t: "concede" } : null));
  expect(openPurpose(state)).toBe("reveal");
  // Flip the Banker, keeping Missionary face-down.
  state = advance(state, (seat) => (seat === ANN ? { t: "reveal", index: 1 } : null));
  expect(openPurpose(state)).toBe("reactive-missionary");
});

test("Missionary: a Disappear resolution opens the window", () => {
  let state = withCoins(
    craftSet(
      ["banker", "director", "mercenary", "missionary", "politician"],
      [[ANN, ["mercenary", "banker"]], [BOB, ["banker", "missionary"]]],
      "missionary-disappear",
    ),
    ANN,
    3,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "mercenary", target: BOB } : null,
  );
  state = advance(state, pass);
  state = advance(state, pass);
  expect(state.active).toBe(BOB);
  state = advance(state, (seat, s) => (seat === s.active ? { t: "income" } : null));
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, (seat) => (seat === BOB ? { t: "reveal", index: 0 } : null));
  expect(openPurpose(state)).toBe("reactive-missionary");
});

test("Intellectual: after any loss the holder may claim to take 5 coins", () => {
  let state = withCoins(
    craftSet(reactiveSet("intellectual"), [[BOB, ["banker", "intellectual"]]], "intel-loss"),
    ANN,
    4,
  );
  state = guerrillaHit(state);
  state = advance(state, pass);
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === BOB ? { t: "reveal", index: 0 } : null));
  expect(openPurpose(state)).toBe("reactive-intellectual");
  state = advance(state, (seat) =>
    seat === BOB ? { t: "claim", role: "intellectual", target: null } : null,
  );
  state = advance(state, pass);
  expect(rawCoins(state, BOB)).toBe(7);
});

test("Intellectual: a Coup loss still opens the window", () => {
  let state = withCoins(
    craftSet(reactiveSet("intellectual"), [[BOB, ["banker", "intellectual"]]], "intel-coup"),
    ANN,
    8,
  );
  state = advance(state, (seat, s) => (seat === s.active ? { t: "coup", target: BOB } : null));
  state = advance(state, (seat) => (seat === BOB ? { t: "reveal", index: 0 } : null));
  expect(openPurpose(state)).toBe("reactive-intellectual");
});

test("Intellectual: a successful challenge costs the claimant another life", () => {
  let state = withCoins(
    craftSet(reactiveSet("intellectual"), [[BOB, ["banker", "intellectual"]]], "intel-lie"),
    ANN,
    4,
  );
  state = guerrillaHit(state);
  state = advance(state, pass);
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === BOB ? { t: "reveal", index: 0 } : null));
  state = advance(state, (seat) =>
    seat === BOB ? { t: "claim", role: "intellectual", target: null } : null,
  );
  state = advance(state, (seat) => (seat === CARA ? { t: "challenge" } : null));
  state = advance(state, (seat) => (seat === BOB ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(0);
});

test("Intellectual: a failed challenge costs the challenger a life, then 5 coins land", () => {
  let state = withCoins(
    craftSet(reactiveSet("intellectual"), [[BOB, ["banker", "intellectual"]]], "intel-true"),
    ANN,
    4,
  );
  state = guerrillaHit(state);
  state = advance(state, pass);
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === BOB ? { t: "reveal", index: 0 } : null));
  state = advance(state, (seat) =>
    seat === BOB ? { t: "claim", role: "intellectual", target: null } : null,
  );
  state = advance(state, (seat) => (seat === CARA ? { t: "challenge" } : null));
  state = advance(state, (seat) => (seat === BOB ? { t: "show" } : null));
  // Cara's reveal for the failed challenge, then her own reactive window.
  state = advance(state, pass);
  state = advance(state, pass);
  expect(rawHand(state, CARA)).toHaveLength(1);
  expect(rawCoins(state, BOB)).toBe(7);
});

test("Intellectual: a surviving holder who loses twice in one turn opens a second window", () => {
  let state = withCoins(
    craftSet(
      reactiveSet("intellectual"),
      [[ANN, ["guerrilla", "banker"]], [BOB, ["banker", "intellectual", "banker"]]],
      "intel-twice",
    ),
    ANN,
    4,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "guerrilla", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("reactive-intellectual");
  state = advance(state, pass);
  state = advance(state, pass);
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("reactive-intellectual");
  expect(rawHand(state, BOB)).toHaveLength(1);
});

test("Intellectual: a General execution opens the window", () => {
  let state = withCoins(
    craftSet(
      ["banker", "director", "general", "intellectual", "peacekeeper"],
      [[ANN, ["general", "banker"]], [BOB, ["banker", "intellectual"]]],
      "intel-general",
    ),
    ANN,
    5,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "general", target: null } : null,
  );
  state = advance(state, pass);
  state = advance(state, pass);
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("reactive-intellectual");
});

/** Set up a Coup that eliminates Bob (one card) so the Lawyer window opens. */
const coupEliminates = (roles: readonly RoleId[], entropy: string) => {
  let state = withCoins(
    craftSet(
      roles,
      [
        [ANN, ["lawyer", "banker"]],
        [BOB, ["banker"]],
      ],
      entropy,
    ),
    ANN,
    8,
  );
  state = withCoins(state, BOB, 6);
  const treasury = state.treasury;
  state = advance(state, (seat, s) => (seat === s.active ? { t: "coup", target: BOB } : null));
  state = advance(state, (seat) => (seat === BOB ? { t: "reveal", index: 0 } : null));
  return { state, treasury };
};

test("Lawyer: when a player is eliminated a survivor may claim their coins before the Treasury", () => {
  const { state: afterCoup } = coupEliminates(reactiveSet("lawyer"), "lawyer-claim");
  expect(openPurpose(afterCoup)).toBe("lawyer");
  let state = advance(afterCoup, (seat) =>
    seat === ANN ? { t: "claim", role: "lawyer", target: null } : null,
  );
  state = advance(state, pass);
  // Ann took Bob's 6 coins instead of the Treasury.
  expect(rawCoins(state, ANN)).toBe(7);
  expect(rawCoins(state, BOB)).toBe(0);
});

test("Lawyer: with no claim the eliminated player's coins go to the Treasury", () => {
  const { state: afterCoup, treasury } = coupEliminates(reactiveSet("lawyer"), "lawyer-none");
  expect(openPurpose(afterCoup)).toBe("lawyer");
  const state = advance(afterCoup, pass);
  expect(rawCoins(state, ANN)).toBe(1);
  expect(state.treasury).toBe(treasury + 7 + 6);
});

test("Lawyer: a successful challenge makes the claimant lose a life and the coins go to the Treasury", () => {
  const { state: afterCoup, treasury } = coupEliminates(reactiveSet("lawyer"), "lawyer-lie");
  let state = advance(afterCoup, (seat) =>
    seat === ANN ? { t: "claim", role: "lawyer", target: null } : null,
  );
  state = advance(state, (seat) => (seat === CARA ? { t: "challenge" } : null));
  state = advance(state, (seat) => (seat === ANN ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(rawCoins(state, BOB)).toBe(0);
  expect(state.treasury).toBe(treasury + 7 + 6);
});

test("Lawyer: a failed challenge costs the challenger a life, then the coins land", () => {
  const { state: afterCoup } = coupEliminates(reactiveSet("lawyer"), "lawyer-true");
  let state = advance(afterCoup, (seat) =>
    seat === ANN ? { t: "claim", role: "lawyer", target: null } : null,
  );
  state = advance(state, (seat) => (seat === CARA ? { t: "challenge" } : null));
  state = advance(state, (seat) => (seat === ANN ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, CARA)).toHaveLength(1);
  expect(rawCoins(state, ANN)).toBe(7);
});

test("Lawyer: the clockwise-first claimant takes the estate and the later claim is voided", () => {
  let state = withCoins(
    craftSet(
      reactiveSet("lawyer"),
      [
        [ANN, ["lawyer", "banker"]],
        [BOB, ["banker"]],
        [CARA, ["lawyer", "banker"]],
      ],
      "lawyer-clockwise",
    ),
    ANN,
    8,
  );
  state = withCoins(state, BOB, 6);
  state = advance(state, (seat, s) => (seat === s.active ? { t: "coup", target: BOB } : null));
  state = advance(state, (seat) => (seat === BOB ? { t: "reveal", index: 0 } : null));
  expect(openPurpose(state)).toBe("lawyer");
  // Both survivors claim; clockwise from the eliminated seat, Cara resolves first.
  state = advance(state, (seat) =>
    seat === ANN || seat === CARA ? { t: "claim", role: "lawyer", target: null } : null,
  );
  state = advance(state, pass);
  expect(rawCoins(state, CARA)).toBe(8);
  expect(rawCoins(state, ANN)).toBe(1);
  expect(rawCoins(state, BOB)).toBe(0);
});

test("Lawyer: a Guerrilla execution that eliminates a seat opens the window", () => {
  let state = withCoins(
    craftSet(
      reactiveSet("lawyer"),
      [
        [ANN, ["guerrilla", "banker"]],
        [BOB, ["banker"]],
      ],
      "lawyer-guerrilla",
    ),
    ANN,
    4,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "guerrilla", target: BOB } : null,
  );
  state = advance(state, pass);
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, (seat) => (seat === BOB ? { t: "reveal", index: 0 } : null));
  expect(openPurpose(state)).toBe("lawyer");
});

test("double life loss: a failed challenge plus the execution costs two lives", () => {
  let state = withCoins(
    craftSet(reactiveSet("intellectual"), [[ANN, ["guerrilla", "banker"]]], "double-loss"),
    ANN,
    4,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "guerrilla", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  // Bob flips for the failed challenge, then his Intellectual window opens.
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(openPurpose(state)).toBe("reactive-intellectual");
  state = advance(state, pass);
  // The attack still resolves: Bob may block, declines, then flips again.
  expect(openPurpose(state)).toBe("block");
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(0);
});
