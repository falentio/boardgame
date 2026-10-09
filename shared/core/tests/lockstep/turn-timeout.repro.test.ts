import { expect, test } from "vitest";
import {
  act,
  createSession,
  deadline,
  frameIndex,
  genesisSeed,
  makeRoster,
  resumeSession,
  seatId,
  type FrameIndex,
} from "../../index.ts";
import {
  coinflip,
  type CoinflipAction,
  type CoinflipView,
} from "../../lockstep/games/coinflip.ts";
import { at, fakeClock, makeTable, nullPort } from "./harness.ts";

const SEATS = [seatId("ann"), seatId("bob"), seatId("cara")] as const;
const ANN = SEATS[0];
const BOB = SEATS[1];
const CARA = SEATS[2];
const SEED = genesisSeed("turn-timeout-repro");
const SETUP = { rounds: 3 };

// The repro reloads during the host's first turn window, which is frame 0. A
// rebuild from the agreed epoch must recompute the identical frame-0 deadline,
// not hand back the full budget.
test("REPRO: a refresh does not extend the turn clock", () => {
  const clock = fakeClock();
  const table = makeTable(coinflip, {
    seats: SEATS,
    setup: SETUP,
    seed: SEED,
    clock: clock.clock,
    timeoutMs: 30_000,
  });
  clock.advance(20_000);
  expect(at(table, ANN).remainingMs()).toBe(10_000);

  const resumed = resumeSession(
    {
      game: coinflip,
      port: nullPort<CoinflipAction>(),
      clock: clock.clock,
      config: { seat: ANN, inputTimeoutMs: 30_000 },
    },
    at(table, ANN).snapshot(),
  );
  expect(resumed.remainingMs()).toBe(10_000);
});

// A frame seals only when every owed seat has reported. Today each peer only
// times out its own seat, so a silent or absent turn-holder hangs the frame for
// everyone present. The ticks here are 16ms apart, which is a tab that is
// running: the carry has to keep working for a slow seat, so only a clock that
// jumped across whole budgets is a pause.
test("a present peer carries a silent owed seat so the frame seals", () => {
  const clock = fakeClock();
  const table = makeTable(coinflip, {
    seats: SEATS,
    setup: SETUP,
    seed: SEED,
    clock: clock.clock,
    timeoutMs: 1_000,
  });
  at(table, ANN).report(act<CoinflipAction>({ t: "call", side: "heads" }));
  expect(at(table, ANN).frame).toBe(frameIndex(1));
  // BOB goes silent; ANN and CARA are present and have no move to make.
  for (let elapsed = 0; elapsed <= 1_016; elapsed += 16) {
    at(table, ANN).tick();
    clock.advance(16);
  }
  expect(at(table, ANN).frame).toBe(frameIndex(2));
  expect(at(table, CARA).frame).toBe(frameIndex(2));
});

test("adopting a same-frame snapshot never extends the deadline", () => {
  const clock = fakeClock();
  const table = makeTable(coinflip, {
    seats: SEATS,
    setup: SETUP,
    seed: SEED,
    clock: clock.clock,
    timeoutMs: 1_000,
  });
  at(table, ANN).report(act<CoinflipAction>({ t: "call", side: "heads" }));
  clock.advance(400);
  const ann = at(table, ANN);
  expect(ann.remainingMs()).toBe(600);

  // A peer snapshot that carries a later deadline must not push ours out.
  const stale = { ...ann.snapshot(), deadline: deadline(999_999) };
  ann.receive({ kind: "snapshot", snapshot: stale });
  expect(ann.remainingMs()).toBe(600);
});

// Frame 0 is owed by one seat, so a table where that seat walks away would hang
// forever if frame 0 could not time out. Its deadline is agreed like every other
// frame's, so a present peer carries it.
test("a present peer carries an overdue frame 0", () => {
  const clock = fakeClock(40_000);
  const bob = createSession(
    {
      game: coinflip,
      port: nullPort<CoinflipAction>(),
      clock: clock.clock,
      config: { seat: BOB, inputTimeoutMs: 30_000 },
    },
    { seed: SEED, roster: makeRoster(SEATS), setup: SETUP, startedAt: deadline(0) },
  );
  // The epoch deadline (30000) passed at now 40000, so frame 0 is overdue.
  bob.tick();
  expect(bob.frame).toBe<FrameIndex>(frameIndex(1));
});

// The app reload path is createSession plus the room's genesis, not resumeSession.
// Two sessions built from the same genesis at different times must agree on the
// deadline, which is what stops a reload from handing back a full clock.
test("a rebuild from the same genesis recomputes the same deadline", () => {
  const clock = fakeClock();
  const genesis = { seed: SEED, roster: makeRoster(SEATS), setup: SETUP, startedAt: deadline(0) };
  const deps = {
    game: coinflip,
    port: nullPort<CoinflipAction>(),
    clock: clock.clock,
    config: { seat: ANN, inputTimeoutMs: 30_000 },
  };
  const before = createSession(deps, genesis);
  clock.advance(20_000);
  expect(before.remainingMs()).toBe(10_000);

  const after = createSession(deps, genesis);
  expect(after.remainingMs()).toBe(10_000);
});

// Carrying writes for seats other than the local one and can seal the frame, so
// only a session that is itself a roster member may do it. A session for a seat
// the table never agreed to must not speak for it.
test("a session that is not a roster member carries no seats", () => {
  const clock = fakeClock();
  const outsider = createSession(
    {
      game: coinflip,
      port: nullPort<CoinflipAction>(),
      clock: clock.clock,
      config: { seat: seatId("mallory"), inputTimeoutMs: 1_000 },
    },
    { seed: SEED, roster: makeRoster(SEATS), setup: SETUP, startedAt: deadline(0) },
  );
  clock.advance(5_000);
  outsider.tick();
  expect(outsider.frame).toBe(frameIndex(0));
});
