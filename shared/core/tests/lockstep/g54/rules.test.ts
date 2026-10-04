import { expect, test } from "vitest";
import {
  ANN,
  BOB,
  CARA,
  advance,
  openPurpose,
  rawCoins,
  rawHand,
  rawRevealed,
  seatsOwedAt,
  withCoins,
  withHands,
  withPeacekeeping,
} from "./driver.ts";
import { g54 } from "../../../lockstep/games/g54/index.ts";

test("elimination returns the eliminated seat's coins to the Treasury", () => {
  let state = withCoins(withHands([[BOB, ["banker"]]], "elimination-coins"), ANN, 8);
  state = withCoins(state, BOB, 6);
  const treasuryBefore = state.treasury;
  state = advance(state, (seat, s) => (seat === s.active ? { t: "coup", target: BOB } : null));
  state = advance(state, () => null);
  expect(rawHand(state, BOB)).toHaveLength(0);
  expect(rawCoins(state, BOB)).toBe(0);
  // Ann paid 7 (Treasury +7), Bob returned 6 (Treasury +6).
  expect(state.treasury).toBe(treasuryBefore + 7 + 6);
});

test("the last player with a face-down card wins and the game is terminal", () => {
  let state = withCoins(
    withHands(
      [
        [BOB, ["banker"]],
        [CARA, ["banker"]],
      ],
      "last-standing",
    ),
    ANN,
    8,
  );
  // Ann coups Bob, then waits for her next turn (coins topped up) to coup Cara.
  for (let i = 0; i < 40 && !g54.isTerminal(state); i += 1) {
    state = advance(state, (seat, s) => {
      if (seat !== s.active) return null;
      const player = s.players.find((p) => p.seat === seat);
      const target = s.players.find((p) => p.seat !== seat && p.hand.length > 0)?.seat;
      if (player !== undefined && player.coins >= 7 && target !== undefined) {
        return { t: "coup", target };
      }
      return { t: "income" };
    });
    if (rawCoins(state, ANN) === 1) state = withCoins(state, ANN, 8);
  }
  expect(g54.isTerminal(state)).toBe(true);
  expect(g54.project(state, ANN).winner).toBe(ANN);
});

test("the loser chooses which of their own cards to flip", () => {
  // Bob's hand is ordered [director, guerrilla]; he asks to flip index 1.
  let state = withCoins(withHands([[BOB, ["director", "guerrilla"]]], "choose-card"), ANN, 4);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "guerrilla", target: BOB } : null,
  );
  state = advance(state, () => null);
  state = advance(state, () => null);
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, (seat) => (seat === BOB ? { t: "reveal", index: 1 } : null));
  expect(rawHand(state, BOB)).toEqual(["director"]);
  expect(rawRevealed(state, BOB)).toEqual(["guerrilla"]);
});

test("a failed block is a double life loss: the false blocker loses for the lie and the execution", () => {
  let state = withCoins(withHands([[BOB, ["banker", "banker"]]], "false-block"), ANN, 4);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "guerrilla", target: BOB } : null,
  );
  state = advance(state, () => null);
  // Bob falsely blocks with Guerrilla (he holds none).
  state = advance(state, (seat) => (seat === BOB ? { t: "block", role: "guerrilla" } : null));
  state = advance(state, (seat) => (seat === CARA ? { t: "challenge" } : null));
  expect(openPurpose(state)).toBe("proof-block");
  state = advance(state, (seat) => (seat === BOB ? { t: "concede" } : null));
  // Bob flips for the failed block, then the attack resolves and he flips again.
  state = advance(state, () => null);
  state = advance(state, () => null);
  expect(rawHand(state, BOB)).toHaveLength(0);
  expect(rawRevealed(state, BOB)).toHaveLength(2);
  expect(rawCoins(state, ANN)).toBe(0);
});

test("the Peacekeeping holder cannot be targeted by a role attack", () => {
  let state = withPeacekeeping(
    withCoins(withHands([[ANN, ["guerrilla", "banker"]]], "peace-target"), ANN, 4),
    BOB,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "guerrilla", target: BOB } : null,
  );
  // The illegal target coerces to Income: no block window, no life lost.
  expect(rawCoins(state, ANN)).toBe(5);
  expect(rawHand(state, BOB)).toHaveLength(2);
});

test("the Peacekeeping holder can still be targeted by a Coup", () => {
  let state = withPeacekeeping(
    withCoins(withHands([[ANN, ["banker", "banker"]]], "peace-coup"), ANN, 8),
    BOB,
  );
  state = advance(state, (seat, s) => (seat === s.active ? { t: "coup", target: BOB } : null));
  state = advance(state, () => null);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(rawCoins(state, ANN)).toBe(1);
});

test("Income takes exactly 1 coin from the Treasury", () => {
  let state = withHands([], "income");
  const before = state.treasury;
  state = advance(state, (seat, s) => (seat === s.active ? { t: "income" } : null));
  expect(rawCoins(state, ANN)).toBe(3);
  expect(state.treasury).toBe(before - 1);
});

test("a target with fewer coins than a steal allows a partial take", () => {
  let state = withCoins(withHands([[ANN, ["politician", "banker"]]], "partial-steal"), BOB, 1);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "politician", target: BOB } : null,
  );
  state = advance(state, () => null);
  state = advance(state, () => null);
  expect(rawCoins(state, ANN)).toBe(3);
  expect(rawCoins(state, BOB)).toBe(0);
});

test("only the target may block a Guerrilla; a third party's block is ignored", () => {
  let state = withCoins(withHands([[CARA, ["guerrilla", "banker"]]], "third-party-block"), ANN, 4);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "guerrilla", target: BOB } : null,
  );
  state = advance(state, () => null);
  // The block window is owed by the target only.
  expect(seatsOwedAt(state)).toEqual([BOB]);
  state = advance(state, (seat) => (seat === CARA ? { t: "block", role: "guerrilla" } : null));
  // Cara is not owed, so her block is dropped and the attack resolves.
  state = advance(state, () => null);
  expect(rawHand(state, BOB)).toHaveLength(1);
});
