import { expect, test } from "vitest";
import {
  ANN,
  BOB,
  advance,
  openPurpose,
  rawCoins,
  rawHand,
  totalCards,
  totalCoins,
  withCoins,
  withHands,
} from "../../driver.ts";
import {
  describeMatrix,
  foldToTurn,
  pass,
  roleDriver,
  seedRole,
  type RoleRecord,
} from "../matrix-driver.ts";

const record: RoleRecord = {
    hand: ["guerrilla", "banker"],
    lieHand: ["banker", "banker"],
    coins: 7,
    target: BOB,
    blockHand: ["guerrilla", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "block", "reveal", "turn"],
        coins: { ann: -4 },
        hands: { bob: -1 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "block", "reveal", "turn"],
        coins: { ann: -4 },
        hands: { bob: -1, cara: -1 },
      },
      block: {
        purposes: ["challenge-claim", "block", "challenge-block", "turn"],
        coins: { ann: -4 },
      },
      blockLie: {
        purposes: ["challenge-claim", "block", "challenge-block", "proof-block", "reveal", "reveal", "turn"],
        coins: { ann: -4 },
        hands: { bob: -2 },
      },
      blockTruth: {
        purposes: ["challenge-claim", "block", "challenge-block", "proof-block", "reveal", "turn"],
        coins: { ann: -4 },
        hands: { cara: -1 },
      },
    },
  };

describeMatrix("guerrilla", record);

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

test("Guerrilla: a challenged claim conserves the deck and the coins", () => {
  const before = seedRole("guerrilla", record, "truth");
  const cards = totalCards(before);
  const coins = totalCoins(before);
  const { state } = foldToTurn(before, roleDriver("guerrilla", record, "truth"));
  // A truthful challenge plus the still-resolving attack land without
  // creating or destroying a single card or coin.
  expect(totalCards(state)).toBe(cards);
  expect(totalCoins(state)).toBe(coins);
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
