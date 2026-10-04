import { expect, test } from "vitest";
import {
  ANN,
  BOB,
  CARA,
  advance,
  openPurpose,
  rawCoins,
  rawHand,
  withCoins,
  withHands,
} from "./driver.ts";

const pass = (): null => null;

test("Banker: take 3 from the Treasury", () => {
  let state = withHands([[ANN, ["banker", "banker"]]], "banker-action");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "banker", target: null } : null,
  );
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(5);
  expect(openPurpose(state)).toBe("turn");
});

test("Banker: a successful challenge makes the claimant lose a life and the action fail", () => {
  let state = withHands([[ANN, ["director", "director"]]], "banker-lie");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "banker", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  expect(openPurpose(state)).toBe("proof-claim");
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(rawCoins(state, ANN)).toBe(2);
  expect(openPurpose(state)).toBe("turn");
});

test("Banker: a failed challenge costs the challenger a life, then the action resolves", () => {
  let state = withHands([[ANN, ["banker", "director"]]], "banker-true");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "banker", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  // Bob's reveal window opens; then the banker resolves.
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(rawCoins(state, ANN)).toBe(5);
});

test("Director: draw 2 from the Court, return any 2", () => {
  let state = withHands([[ANN, ["banker", "banker"]]], "director-action");
  const courtBefore = state.court.length;
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "director", target: null } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("keep");
  const pool = state.draw?.pool ?? [];
  expect(pool).toHaveLength(2);
  // Keep the two drawn cards: the hand becomes exactly the pool.
  state = advance(state, (seat, s) => (seat === s.active ? { t: "keep", indices: [2, 3] } : null));
  expect(rawHand(state, ANN)).toEqual([...pool]);
  // Two drawn and two returned leaves the Court the same size.
  expect(state.court.length).toBe(courtBefore);
  expect(openPurpose(state)).toBe("turn");
});

test("Director: a successful challenge stops the swap and costs a life", () => {
  let state = withHands([[ANN, ["banker", "banker"]]], "director-lie");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "director", target: null } : null,
  );
  state = advance(state, (seat) => (seat === CARA ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(openPurpose(state)).toBe("turn");
});

test("Director: a failed challenge costs the challenger a life, then the swap resolves", () => {
  let state = withHands([[ANN, ["director", "banker"]]], "director-true");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "director", target: null } : null,
  );
  state = advance(state, (seat) => (seat === CARA ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, CARA)).toHaveLength(1);
  // The Director swap then opens its keep window.
  expect(openPurpose(state)).toBe("keep");
  state = advance(state, (seat, s) => (seat === s.active ? { t: "keep", indices: [0, 1] } : null));
  expect(rawHand(state, ANN)).toHaveLength(2);
});

test("Guerrilla: pay 4, the target loses 1 influence", () => {
  let state = withCoins(withHands([[ANN, ["guerrilla", "banker"]]], "guerrilla-action"), ANN, 4);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "guerrilla", target: BOB } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("block");
  state = advance(state, pass);
  // The target's reveal window opens, then the turn ends.
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(rawCoins(state, ANN)).toBe(0);
  expect(openPurpose(state)).toBe("turn");
});

test("Guerrilla: the target blocks with Guerrilla and the execution is stopped", () => {
  let state = withCoins(withHands([[BOB, ["guerrilla", "banker"]]], "guerrilla-block"), ANN, 4);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "guerrilla", target: BOB } : null,
  );
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === BOB ? { t: "block", role: "guerrilla" } : null));
  expect(openPurpose(state)).toBe("challenge-block");
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(2);
  expect(rawCoins(state, ANN)).toBe(0);
});

test("Guerrilla: a successful challenge makes the attacker lose a life and the attack fail", () => {
  let state = withCoins(withHands([[ANN, ["banker", "banker"]]], "guerrilla-lie"), ANN, 4);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "guerrilla", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(rawCoins(state, ANN)).toBe(4);
  expect(rawHand(state, BOB)).toHaveLength(2);
});

test("Guerrilla: a failed challenge plus the execution is a double life loss", () => {
  let state = withCoins(withHands([[ANN, ["guerrilla", "banker"]]], "guerrilla-double"), ANN, 4);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "guerrilla", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  // Ann holds Guerrilla and shows; Bob loses a life for the failed challenge.
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  // The attack still resolves: Bob is the target and does not block.
  state = advance(state, pass);
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(0);
  expect(rawCoins(state, ANN)).toBe(0);
});

test("Guerrilla: self-block (Guerrilla blocks Guerrilla) leaves the coins paid", () => {
  let state = withCoins(withHands([[BOB, ["guerrilla", "guerrilla"]]], "guerrilla-self"), ANN, 4);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "guerrilla", target: BOB } : null,
  );
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === BOB ? { t: "block", role: "guerrilla" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(2);
  expect(rawCoins(state, ANN)).toBe(0);
});

test("Politician: steal up to 2 coins from a target", () => {
  let state = withCoins(withHands([[ANN, ["politician", "banker"]]], "politician-action"), BOB, 5);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "politician", target: BOB } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("block");
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(4);
  expect(rawCoins(state, BOB)).toBe(3);
});

test("Politician: the target blocks with Politician and the theft is stopped", () => {
  let state = withCoins(withHands([[BOB, ["politician", "banker"]]], "politician-block"), BOB, 5);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "politician", target: BOB } : null,
  );
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === BOB ? { t: "block", role: "politician" } : null));
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(2);
  expect(rawCoins(state, BOB)).toBe(5);
});

test("Politician: a successful challenge makes the claimant lose a life and the theft fail", () => {
  let state = withCoins(withHands([[ANN, ["banker", "banker"]]], "politician-lie"), BOB, 5);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "politician", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(rawCoins(state, BOB)).toBe(5);
});

test("Politician: a failed challenge costs the challenger a life, then the steal resolves", () => {
  let state = withCoins(withHands([[ANN, ["politician", "banker"]]], "politician-true"), BOB, 5);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "politician", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  // Bob is the target and does not block, so the steal lands.
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(4);
  expect(rawCoins(state, BOB)).toBe(3);
});

test("Peacekeeper: take 1 coin and the Peacekeeping token", () => {
  let state = withHands([[ANN, ["peacekeeper", "banker"]]], "peacekeeper-action");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "peacekeeper", target: null } : null,
  );
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(3);
  expect(state.peacekeeping).toBe(ANN);
});

test("Peacekeeper: a new claim steals the token from the prior holder", () => {
  let state = withHands([[BOB, ["peacekeeper", "banker"]]], "peacekeeper-steal");
  state = { ...state, peacekeeping: ANN };
  // Ann's turn first: income, then Bob claims Peacekeeper and takes the token.
  state = advance(state, (seat, s) => (seat === s.active ? { t: "income" } : null));
  expect(state.active).toBe(BOB);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "peacekeeper", target: null } : null,
  );
  state = advance(state, pass);
  expect(state.peacekeeping).toBe(BOB);
});

test("Peacekeeper: a failed challenge costs the challenger a life, then the token moves", () => {
  let state = withHands([[ANN, ["peacekeeper", "banker"]]], "peacekeeper-true");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "peacekeeper", target: null } : null,
  );
  state = advance(state, (seat) => (seat === CARA ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, CARA)).toHaveLength(1);
  expect(state.peacekeeping).toBe(ANN);
  expect(rawCoins(state, ANN)).toBe(3);
});

test("Peacekeeper: a successful challenge costs the claimant a life and the token does not move", () => {
  let state = withHands([[ANN, ["banker", "banker"]]], "peacekeeper-lie");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "peacekeeper", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(state.peacekeeping).toBeNull();
  expect(rawCoins(state, ANN)).toBe(2);
});
