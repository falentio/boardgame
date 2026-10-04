import { expect, test } from "vitest";
import { act, resign } from "../../../index.ts";
import { at } from "../harness.ts";
import {
  ANN,
  BOB,
  CARA,
  advance,
  crafted,
  openPurpose,
  owedOf,
  rawCoins,
  rawFrame,
  rawGenesis,
  rawHand,
  rawRandom,
  runWindows,
  SEATS3,
  seatsOwedAt,
  STARTER,
  tableOf,
  withCoins,
  withHands,
} from "./driver.ts";
import { g54, type G54Action } from "../../../lockstep/games/g54/index.ts";
import { G54Error } from "../../../lockstep/games/g54/error.ts";

test("a synthetic claim -> challenge -> resolve cycle walks the window stack", () => {
  let state = withHands([[ANN, ["banker", "banker"]]], "window-cycle");
  expect(openPurpose(state)).toBe("turn");
  expect(owedOf(state)).toEqual([ANN]);

  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "banker", target: null } : null,
  );
  expect(openPurpose(state)).toBe("challenge-claim");
  expect(owedOf(state)).toEqual(SEATS3);

  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  expect(openPurpose(state)).toBe("proof-claim");
  expect(owedOf(state)).toEqual([ANN]);

  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  // The challenger's reveal window opens; nothing has been flipped yet.
  expect(openPurpose(state)).toBe("reveal");
  expect(owedOf(state)).toEqual([BOB]);
  expect(rawHand(state, BOB)).toHaveLength(2);

  // Driving the reveal flips Bob's card, then the banker resolves and the turn
  // hands off to Bob.
  state = advance(state, () => null);
  expect(openPurpose(state)).toBe("turn");
  expect(state.active).toBe(BOB);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(rawCoins(state, ANN)).toBe(5);
});

test("a claim that survives its challenge with no blocker resolves without a block window", () => {
  let state = withHands([[ANN, ["banker", "banker"]]], "no-block-window");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "banker", target: null } : null,
  );
  state = advance(state, () => null);
  expect(rawCoins(state, ANN)).toBe(5);
});

test("a blocked Guerrilla still leaves the attacker's 4 coins paid", () => {
  let state = withCoins(withHands([[BOB, ["guerrilla", "guerrilla"]]], "paid-block"), ANN, 4);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "guerrilla", target: BOB } : null,
  );
  state = advance(state, () => null);
  expect(openPurpose(state)).toBe("block");
  state = advance(state, (seat) => (seat === BOB ? { t: "block", role: "guerrilla" } : null));
  expect(openPurpose(state)).toBe("challenge-block");
  state = advance(state, () => null);
  // The block held: the target keeps both lives, but the 4 coins are gone.
  expect(rawHand(state, BOB)).toHaveLength(2);
  expect(rawCoins(state, ANN)).toBe(0);
});

test("step throws when called with no open window (contract guard)", () => {
  const state = { ...rawGenesis(STARTER, SEATS3, "no-window"), steps: [] };
  expect(() => g54.step(state, rawFrame(0, []), rawRandom())).toThrow(G54Error);
});

test("forced Coup at 10+ coins: only Coup is legal", () => {
  let state = withCoins(crafted("forced-coup"), ANN, 10);
  // Ann reports Income, but at 10 coins the engine coerces the action to Coup.
  state = runWindows(
    state,
    (seat, s) => (seat === s.active ? { t: "income" } : null),
    "forced-coup",
  );
  expect(rawCoins(state, ANN)).toBe(3);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(rawHand(state, CARA)).toHaveLength(2);
});

test("Coup pays 7 and cannot be challenged or blocked", () => {
  let state = withCoins(crafted("coup-plain"), ANN, 8);
  state = advance(state, (seat, s) => (seat === s.active ? { t: "coup", target: BOB } : null));
  // The Coup skips straight to the target's reveal window: no challenge window,
  // no block window.
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, () => null);
  expect(openPurpose(state)).toBe("turn");
  expect(rawCoins(state, ANN)).toBe(1);
  expect(rawHand(state, BOB)).toHaveLength(1);
});

test("a forced Coup still resolves when the active seat's claim is illegal", () => {
  let state = withCoins(crafted("forced-coup-claim"), ANN, 12);
  state = runWindows(
    state,
    (seat, s) => (seat === s.active ? { t: "claim", role: "guerrilla", target: BOB } : null),
    "forced-coup-claim",
  );
  expect(rawCoins(state, ANN)).toBe(5);
  expect(rawHand(state, BOB)).toHaveLength(1);
});

test("g54 genesis opens a non-empty turn window so seatsOwed is never empty", () => {
  const state = rawGenesis(STARTER, SEATS3, "genesis-window");
  expect(seatsOwedAt(state)).toEqual([ANN]);
  expect(openPurpose(state)).toBe("turn");
});

test("a window that names only resigned seats still owes the active seat", () => {
  const start = rawGenesis(STARTER, SEATS3, "resign-owed");
  // A reveal window naming Bob, who has resigned: the owed set must not be empty.
  const state = {
    ...start,
    resigned: [BOB],
    steps: [
      {
        kind: "window" as const,
        window: { kind: "oneOf" as const, purpose: "reveal" as const, seats: [BOB], cause: null },
      },
    ],
  };
  expect(seatsOwedAt(state)).toEqual([ANN]);
});

test("a resigning seat is folded into the game's own state", () => {
  const table = tableOf(STARTER, SEATS3, "resign-fold");
  // The challenge window is owed by all three seats, so one frame carries every
  // resign together and the game folds them without stranding a window.
  at(table, ANN).report(act<G54Action>({ t: "claim", role: "banker", target: null }));
  at(table, ANN).report(resign<G54Action>());
  at(table, BOB).report(resign<G54Action>());
  at(table, CARA).report(act<G54Action>({ t: "pass" }));

  // Ann and Bob have left; Cara is the last seat standing.
  expect(at(table, ANN).terminal).toBe(true);
  expect(at(table, ANN).view().winner).toBe(CARA);
});
