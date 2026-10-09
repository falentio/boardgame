import { expect, test } from "vitest";
import {
  act,
  deadline,
  genesisSeed,
  seatId,
  type FrameIndex,
  type SeatId,
} from "../../index.ts";
import {
  coinflip,
  type CoinflipAction,
  type CoinflipSetup,
  type CoinflipView,
} from "../../lockstep/games/coinflip.ts";
import { at, fakeClock, makeTable, type Table } from "./harness.ts";

const SEATS = [seatId("ann"), seatId("bob"), seatId("cara")] as const;
const ANN: SeatId = SEATS[0];
const SETUP: CoinflipSetup = { rounds: 50 };
const SEED = genesisSeed("paused-clock");
const BUDGET = 30_000;

const openTable = (clock: ReturnType<typeof fakeClock>): Table<CoinflipAction, CoinflipView> =>
  makeTable(coinflip, {
    seats: SEATS,
    setup: SETUP,
    seed: SEED,
    clock: clock.clock,
    timeoutMs: BUDGET,
  });

/**
 * The repro. A tab that stops running still holds a head the table moves past:
 * the peers seal the frames this client owes, then the client wakes with a clock
 * that has jumped across several budgets. Carrying at that moment seals an index
 * the table already sealed from inputs this client never saw, so its chain can
 * no longer match any frame the table agrees on and it can never rejoin.
 */
test("REPRO: a paused tab's first tick forks its chain instead of waiting", () => {
  const clock = fakeClock();
  const table = openTable(clock);
  const ann = at(table, ANN);

  ann.report(act<CoinflipAction>({ t: "call", side: "heads" }));
  expect(ann.frame).toBe<FrameIndex>(1);

  // The tab is backgrounded. Its JS stops, so neither the frame reports the
  // peers exchange nor their own ticks reach this session, and wall time runs
  // past several budgets before JS runs again.
  clock.advance(4 * BUDGET);
  ann.tick();

  // Today the carry fires and frame 1 seals from nothing but idles, so the head
  // it writes is not the one the table agreed at index 1. Every frame the table
  // broadcasts from here on is then rejected and this client is stranded on its
  // own fork, while the turn clock still reads as a race this client is in.
  expect(ann.frame).toBe<FrameIndex>(1);
  expect(ann.snapshot().head?.index).toBe<FrameIndex>(0);
  expect(ann.remainingMs()).toBeNull();
});

/**
 * A running peer must still carry a silent owed seat. That is the documented
 * bound on frame barrier latency and it is what stops a stalled player from
 * hanging the table, so the pause rule must not swallow it. The ticks here are
 * 16ms apart, which is a process that is running.
 */
test("a running peer still carries a silent owed seat after the deadline", () => {
  const clock = fakeClock();
  const ann = at(openTable(clock), ANN);
  ann.report(act<CoinflipAction>({ t: "call", side: "heads" }));

  for (let elapsed = 0; elapsed <= BUDGET + 16; elapsed += 16) {
    ann.tick();
    clock.advance(16);
  }

  expect(ann.frame).toBeGreaterThan<FrameIndex>(1);
});

/** Once a frame the table agreed on is folded, the session is live again. */
test("folding an agreed frame ends the pause", () => {
  const clock = fakeClock();
  const ann = at(openTable(clock), ANN);
  ann.report(act<CoinflipAction>({ t: "call", side: "heads" }));

  // A peer that kept running seals the same index from the agreed reports.
  const liveTable = openTable(clock);
  const live = at(liveTable, ANN);
  live.report(act<CoinflipAction>({ t: "call", side: "heads" }));
  for (let elapsed = 0; elapsed <= BUDGET + 16; elapsed += 16) {
    live.tick();
    clock.advance(16);
  }

  clock.advance(4 * BUDGET);
  ann.tick();
  expect(ann.frame).toBe<FrameIndex>(1);

  const agreed = [...liveTable.sealed.values()].find((frame) => frame.index === 1);
  if (agreed === undefined) throw new Error("the live peer never sealed frame 1");
  ann.receive({ kind: "frame", frame: agreed });

  expect(ann.frame).toBe<FrameIndex>(2);
  expect(ann.paused).toBe(false);
});
