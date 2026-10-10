import { expect, test } from "vitest";
import {
  ANN,
  BOB,
  CARA,
  advance,
  craftSet,
  g54,
  openPurpose,
  rawCoins,
  rawHand,
  withCoins,
  type G54State,
} from "./driver.ts";
import { FORCED_COUP_COINS } from "../../../lockstep/games/g54/windows.ts";
import { specOf } from "../../../lockstep/games/g54/roles.ts";

const ROLES = ["banker", "director", "guerrilla", "politician", "missionary"] as const;
const SAVE_COST = specOf("missionary").cost;
const HIT_COST = specOf("guerrilla").cost;
const BANK_CEILING = FORCED_COUP_COINS - 1;

const missionTable = (entropy: string): G54State =>
  craftSet(
    ROLES,
    [
      [ANN, ["banker", "banker"]],
      [BOB, ["banker", "missionary"]],
      [CARA, ["banker", "banker"]],
    ],
    entropy,
  );

const hitBob = (state: G54State): G54State => {
  let next = withCoins(state, ANN, HIT_COST);
  next = advance(next, (seat, s) =>
    seat === s.active ? { t: "claim", role: "guerrilla", target: BOB } : null,
  );
  for (let i = 0; i < 12 && openPurpose(next) !== "turn"; i += 1) {
    next = advance(next, (seat, s) => {
      if (seat !== BOB) return null;
      const purpose = openPurpose(s);
      if (purpose === "reveal") {
        const hand = rawHand(s, BOB);
        const index = hand.findIndex((role) => role !== "missionary");
        return { t: "reveal", index: index < 0 ? 0 : index };
      }
      if (purpose === "reactive-missionary") return { t: "claim", role: "missionary", target: null };
      return null;
    });
  }
  expect(openPurpose(next)).toBe("turn");
  return next;
};

const skipTo = (state: G54State, seat: typeof ANN): G54State => {
  let next = state;
  let guard = 0;
  while (next.active !== seat && !g54.isTerminal(next) && guard < 50) {
    next = advance(next, () => null);
    guard += 1;
  }
  return next;
};

test("Missionary: a Coup loss still opens no window", () => {
  let state = withCoins(missionTable("missey-coup"), ANN, 8);
  state = advance(state, (seat, s) => (seat === s.active ? { t: "coup", target: BOB } : null));
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, (seat) => (seat === BOB ? { t: "reveal", index: 0 } : null));
  expect(openPurpose(state)).toBe("turn");
});

test("Missionary: a holder who cannot pay gets no window, so the loss stands", () => {
  let state = withCoins(missionTable("missey-broke"), BOB, SAVE_COST - 1);
  state = hitBob(skipTo(state, ANN));
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(rawCoins(state, BOB)).toBe(SAVE_COST - 1);
});

test("Missionary: a surviving save pays its price to the Treasury", () => {
  const treasuryBefore = missionTable("missey-pay").treasury;
  let state = withCoins(missionTable("missey-pay"), BOB, SAVE_COST);
  expect(rawHand(state, BOB)).toHaveLength(2);
  state = hitBob(skipTo(state, ANN));
  expect(rawHand(state, BOB)).toHaveLength(2);
  expect(rawCoins(state, BOB)).toBe(0);
  expect(state.treasury).toBe(treasuryBefore + HIT_COST + SAVE_COST);
});

test("Missionary: the save drains the bank, so the loop terminates", () => {
  let state = withCoins(missionTable("missey-bound"), BOB, BANK_CEILING);
  let saves = 0;
  let hits = 0;
  const log: string[] = [];
  while (rawHand(state, BOB).length > 0 && hits < 40) {
    const before = rawHand(state, BOB).length;
    state = hitBob(skipTo(state, ANN));
    hits += 1;
    const saved = rawHand(state, BOB).length === before;
    if (saved) saves += 1;
    log.push(
      "hit " + hits + " coins=" + rawCoins(state, BOB) + " hand=" + rawHand(state, BOB).length + (saved ? " saved" : " lost"),
    );
  }
  console.log(log.join("\n"));
  expect(hits).toBeLessThan(40);
  expect(rawHand(state, BOB)).toHaveLength(0);
  expect(saves).toBe(2);
});
