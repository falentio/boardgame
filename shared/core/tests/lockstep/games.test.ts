import { expect, test } from "vitest";
import {
  act,
  frameIndex,
  genesisSeed,
  idle,
  resign,
  seatId,
  type SeatId,
} from "../../index.ts";
import {
  coinflip,
  type CoinflipAction,
  type CoinflipView,
} from "../../lockstep/games/coinflip.ts";
import { g54, G54Error, type G54Action, type G54View } from "../../lockstep/games/g54/index.ts";
import { at, fakeClock, makeTable, recordingSession, type Table } from "./harness.ts";

const SEATS = [seatId("ann"), seatId("bob"), seatId("cara")] as const;
const ANN = SEATS[0];
const BOB = SEATS[1];
const CARA = SEATS[2];
const SEED = genesisSeed("lockstep-game-tests");
const G54_ROLES = ["banker", "director", "guerrilla", "politician", "peacekeeper"] as const;

/** Report one input per owed seat; the new g54 always owes a non-empty set. */
const driveAll = (
  table: Table<G54Action, G54View>,
  decide: (seat: SeatId, view: G54View) => G54Action | null,
): void => {
  const opener = at(table, ANN);
  const frame = opener.frame;
  for (const seat of opener.owed()) {
    const session = at(table, seat);
    if (session.frame !== frame) continue;
    const action = decide(seat, session.view());
    session.report(action === null ? idle<G54Action>() : act<G54Action>(action));
  }
};

const driveFrame = <A, View>(
  table: Table<A, View>,
  decide: (seat: SeatId, view: View) => A | null,
): void => {
  const opener = at(table, ANN);
  const frame = opener.frame;
  for (const seat of opener.owed()) {
    const session = at(table, seat);
    if (session.frame !== frame) continue;
    const action = decide(seat, session.view());
    session.report(action === null ? idle<A>() : act<A>(action));
  }
};

test("coinflip reaches terminal through its full happy path", () => {
  const table = makeTable(coinflip, {
    seats: SEATS,
    setup: { rounds: 3 },
    seed: SEED,
    clock: fakeClock().clock,
  });

  for (let guard = 0; guard < 100 && !at(table, ANN).terminal; guard += 1) {
    driveFrame<CoinflipAction, CoinflipView>(table, (_seat, view) => {
      if (view.phase === "call") return { t: "call", side: "heads" };
      if (view.phase === "stake") return { t: "stake" };
      return null;
    });
  }

  expect(at(table, ANN).terminal).toBe(true);
  const final = at(table, ANN).view();
  expect(final.phase).toBe("over");
  expect(final.lastResult === "heads" || final.lastResult === "tails").toBe(true);
});

test("coinflip's stake frame is owed by every active seat (multi-actor window)", () => {
  const table = makeTable(coinflip, {
    seats: SEATS,
    setup: { rounds: 3 },
    seed: SEED,
    clock: fakeClock().clock,
  });
  at(table, ANN).report(act<CoinflipAction>({ t: "call", side: "heads" }));
  expect(at(table, ANN).owed()).toEqual(SEATS);
  expect(at(table, BOB).owed()).toEqual(SEATS);
});

test("g54 challenge window is owed by every active seat", () => {
  const table = makeTable(g54, {
    seats: SEATS,
    setup: { roles: ["banker", "director", "guerrilla", "politician", "peacekeeper"] },
    seed: SEED,
    clock: fakeClock().clock,
  });

  // Frame 0 is the turn window, owed only by the active seat.
  expect(at(table, ANN).owed()).toEqual([ANN]);
  at(table, ANN).report(act<G54Action>({ t: "claim", role: "banker", target: null }));

  // Frame 1 is the challenge window, owed by all three seats.
  expect(at(table, ANN).owed()).toEqual(SEATS);
  expect(at(table, BOB).owed()).toEqual(SEATS);
  expect(at(table, CARA).owed()).toEqual(SEATS);
});

test("g54 admits a challenge from a seat that is not the active player", () => {
  const table = makeTable(g54, {
    seats: SEATS,
    setup: { roles: ["banker", "director", "guerrilla", "politician", "peacekeeper"] },
    seed: SEED,
    clock: fakeClock().clock,
  });
  at(table, ANN).report(act<G54Action>({ t: "claim", role: "banker", target: null }));

  // ann is the active claimant; bob, who is not active, challenges. The active
  // seat and cara pass.
  driveAll(table, (seat) => (seat === BOB ? { t: "challenge" } : null));

  const resolved = at(table, ANN).view();
  expect(resolved.window?.purpose).toBe("proof-claim");
  expect(resolved.pending?.role).toBe("banker");
});

test("g54 project redacts the Court deck and other hands", () => {
  const table = makeTable(g54, {
    seats: SEATS,
    setup: { roles: ["banker", "director", "guerrilla", "politician", "peacekeeper"] },
    seed: SEED,
    clock: fakeClock().clock,
  });
  const view = at(table, ANN).view();
  // Three copies of each of the five chosen roles is 15 cards; three seats take
  // two each, leaving 9 in the Court.
  expect(view.courtCount).toBe(9);
  expect(Object.keys(view)).not.toContain("court");
  expect(view.myHand.length).toBe(2);
  for (const player of view.players) {
    expect(Object.keys(player)).toEqual(["seat", "coins", "handCount", "revealed", "resigned"]);
  }
});

test("resign drops a seat from the owed set for later frames", () => {
  const table = makeTable(coinflip, {
    seats: SEATS,
    setup: { rounds: 3 },
    seed: SEED,
    clock: fakeClock().clock,
  });
  at(table, ANN).report(act<CoinflipAction>({ t: "call", side: "heads" }));

  // The stake frame is owed by all three; cara resigns in it.
  at(table, ANN).report(act<CoinflipAction>({ t: "stake" }));
  at(table, BOB).report(act<CoinflipAction>({ t: "stake" }));
  at(table, CARA).report(resign<CoinflipAction>());

  // Drive forward to the next multi-actor window; cara is no longer owed.
  for (let guard = 0; guard < 10 && at(table, ANN).view().phase !== "stake"; guard += 1) {
    driveFrame<CoinflipAction, CoinflipView>(table, () => null);
  }
  expect(at(table, ANN).view().phase).toBe("stake");
  expect(at(table, ANN).owed()).not.toContain(CARA);
  expect(at(table, ANN).owed()).toEqual(expect.arrayContaining([ANN, BOB]));
  expect(at(table, BOB).owed()).not.toContain(CARA);
});

test("an out-of-order frame is buffered and applied once the gap closes", () => {
  const table = makeTable(coinflip, {
    seats: SEATS,
    setup: { rounds: 3 },
    seed: SEED,
    clock: fakeClock().clock,
  });
  // Drive the bus forward until at least four frames are sealed.
  for (let guard = 0; guard < 20 && table.sealed.size < 4; guard += 1) {
    driveFrame<CoinflipAction, CoinflipView>(table, () => ({ t: "stake" }));
  }

  const frame0 = table.sealed.get(0)!;
  const frame1 = table.sealed.get(1)!;
  const frame2 = table.sealed.get(2)!;
  const frame3 = table.sealed.get(3)!;

  const lagging = recordingSession(coinflip, {
    seats: SEATS,
    setup: { rounds: 3 },
    seed: SEED,
    clock: fakeClock().clock,
    seat: ANN,
  });
  // Deliver out of order: 0, then 2 (buffered), then 1 (which closes the gap
  // and drains the buffered 2), then 3.
  lagging.session.receive({ kind: "frame", frame: frame0 });
  lagging.session.receive({ kind: "frame", frame: frame2 });
  expect(lagging.session.frame).toBe(frameIndex(1));
  lagging.session.receive({ kind: "frame", frame: frame1 });
  expect(lagging.session.frame).toBe(frameIndex(3));
  lagging.session.receive({ kind: "frame", frame: frame3 });
  expect(lagging.session.frame).toBe(frameIndex(4));
  expect(lagging.session.view()).toEqual(at(table, ANN).view());
});

test("g54 deals two cards per seat and conserves the whole deck", () => {
  const table = makeTable(g54, {
    seats: SEATS,
    setup: { roles: [...G54_ROLES] },
    seed: SEED,
    clock: fakeClock().clock,
  });

  const view = at(table, ANN).view();
  // Every seat holds exactly two cards...
  for (const seat of SEATS) {
    expect(at(table, seat).view().myHand.length).toBe(2);
  }
  // ...and Court plus every hand accounts for the full deck: three copies of
  // each of the five chosen roles is 15 cards.
  const hands = SEATS.reduce((total, seat) => total + at(table, seat).view().myHand.length, 0);
  expect(view.courtCount + hands).toBe(15);
  // Dealt cards leave the Court; they are not duplicated into it.
  expect(view.courtCount).toBe(15 - 2 * SEATS.length);
});

test("g54 genesis rejects a role selection that breaks the 1/1/1/2 draft rule", () => {
  expect(() =>
    makeTable(g54, {
      seats: SEATS,
      setup: { roles: ["banker", "capitalist", "director", "guerrilla", "politician"] },
      seed: SEED,
      clock: fakeClock().clock,
    }),
  ).toThrow(G54Error);
});

test("g54 hands stay within the deck's per-role supply", () => {
  const table = makeTable(g54, {
    seats: SEATS,
    setup: { roles: [...G54_ROLES] },
    seed: SEED,
    clock: fakeClock().clock,
  });
  // Hands are only revealed to their owners, so reconstruct the deal by asking
  // each seat for its own hand.
  const dealt = SEATS.flatMap((seat) => at(table, seat).view().myHand);
  expect(dealt).toHaveLength(2 * SEATS.length);
  // No role is dealt more times than the deck supplies (three copies each).
  const counts = new Map<string, number>();
  for (const role of dealt) counts.set(role, (counts.get(role) ?? 0) + 1);
  for (const [, count] of counts) expect(count).toBeLessThanOrEqual(3);
});
