import { expect, test } from "vitest";
import {
  act,
  frameIndex,
  genesisSeed,
  idle,
  MAX_PENDING_AHEAD,
  resign,
  resumeSession,
  seatId,
  SessionError,
  type Frame,
  type SeatId,
} from "../../index.ts";
import {
  coinflip,
  type CoinflipAction,
  type CoinflipView,
} from "../../lockstep/games/coinflip.ts";
import { at, fakeClock, makeTable, nullPort, recordingSession, type Table } from "./harness.ts";

const SEATS = [seatId("ann"), seatId("bob"), seatId("cara")] as const;
const ANN = SEATS[0];
const BOB = SEATS[1];
const CARA = SEATS[2];
const SEED = genesisSeed("lockstep-session-tests");
const SETUP = { rounds: 3 };

/** A recording session for `seat`, with the shared test lobby inputs. */
const recording = (
  seat: SeatId,
): ReturnType<typeof recordingSession<never, CoinflipAction, typeof SETUP, CoinflipView>> =>
  recordingSession(coinflip, {
    seats: SEATS,
    setup: SETUP,
    seed: SEED,
    clock: fakeClock().clock,
    seat,
  });

/** Drive one frame: every owed seat reports once, in roster order. */
const driveFrame = (
  table: Table<CoinflipAction, CoinflipView>,
  decide: (seat: SeatId, view: CoinflipView) => CoinflipAction | null,
): void => {
  const opener = at(table, ANN);
  const frame = opener.frame;
  for (const seat of opener.owed()) {
    const session = at(table, seat);
    if (session.frame !== frame) continue;
    const action = decide(seat, session.view());
    session.report(action === null ? idle<CoinflipAction>() : act<CoinflipAction>(action));
  }
};

const playHeads = (seat: SeatId, view: CoinflipView): CoinflipAction | null => {
  if (view.phase === "call") return { t: "call", side: "heads" };
  if (view.phase === "stake") return { t: "stake" };
  return null;
};

const driveToTerminal = (table: Table<CoinflipAction, CoinflipView>): void => {
  for (let guard = 0; guard < 200 && !at(table, ANN).terminal; guard += 1) {
    driveFrame(table, playHeads);
  }
};

const newTable = (): Table<CoinflipAction, CoinflipView> =>
  makeTable(coinflip, { seats: SEATS, setup: SETUP, seed: SEED, clock: fakeClock().clock });

test("two independent sessions fed the same frames converge to identical views", () => {
  const first = newTable();
  const second = newTable();
  driveToTerminal(first);
  driveToTerminal(second);

  expect(at(first, ANN).terminal).toBe(true);
  for (const seat of SEATS) {
    expect(at(second, seat).view()).toEqual(at(first, seat).view());
  }
  expect([...second.sealed.keys()].sort((a, b) => a - b)).toEqual(
    [...first.sealed.keys()].sort((a, b) => a - b),
  );
});

test("a frame seals only when every owed seat reports", () => {
  const table = newTable();
  at(table, ANN).report(act<CoinflipAction>({ t: "call", side: "heads" }));

  expect(table.sealed.get(0)).toBeDefined();
  expect(at(table, ANN).frame).toBe(frameIndex(1));
  expect(at(table, ANN).owed()).toEqual(SEATS);
});

test("a late report seals the same frame regardless of arrival order", () => {
  const table = newTable();
  at(table, ANN).report(act<CoinflipAction>({ t: "call", side: "heads" }));
  const frame0 = table.sealed.get(0)!;

  const ahead = recording(ANN);
  const behind = recording(ANN);
  ahead.session.receive({ kind: "frame", frame: frame0 });
  behind.session.receive({ kind: "frame", frame: frame0 });

  const annReport = { frame: frameIndex(1), seat: ANN, input: idle<CoinflipAction>() };
  const bobReport = { frame: frameIndex(1), seat: BOB, input: act<CoinflipAction>({ t: "stake" }) };
  const caraReport = { frame: frameIndex(1), seat: CARA, input: idle<CoinflipAction>() };

  // Two reports leave the frame open.
  ahead.session.receive({ kind: "report", report: annReport });
  ahead.session.receive({ kind: "report", report: bobReport });
  expect(ahead.session.frame).toBe(frameIndex(1));
  expect(ahead.frames).toHaveLength(0);

  // The third report seals it.
  ahead.session.receive({ kind: "report", report: caraReport });
  expect(ahead.session.frame).toBe(frameIndex(2));
  expect(ahead.frames).toHaveLength(1);

  // The same reports in reverse arrival order seal an identical frame.
  behind.session.receive({ kind: "report", report: caraReport });
  behind.session.receive({ kind: "report", report: bobReport });
  behind.session.receive({ kind: "report", report: annReport });
  expect(behind.session.frame).toBe(frameIndex(2));
  expect(behind.frames[0]).toEqual(ahead.frames[0]);
  expect(ahead.frames[0]?.inputs.map(([seat]) => seat)).toEqual(SEATS);
});

test("resumeSession from a snapshot equals a session that folded the whole log", () => {
  const table = newTable();
  for (let round = 0; round < 2; round += 1) driveFrame(table, playHeads);

  const snapshot = at(table, ANN).snapshot();
  const resumed = resumeSession(
    {
      game: coinflip,
      port: nullPort<CoinflipAction>(),
      clock: fakeClock().clock,
      config: { seat: ANN, inputTimeoutMs: 1000 },
    },
    snapshot,
  );

  const replayed = recording(ANN);
  for (const index of [...table.sealed.keys()].sort((a, b) => a - b)) {
    replayed.session.receive({ kind: "frame", frame: table.sealed.get(index)! });
  }

  expect(resumed.frame).toBe(snapshot.frame);
  expect(resumed.view()).toEqual(replayed.session.view());
  expect(resumed.view()).toEqual(at(table, ANN).view());
});

test("receive drops a frame whose seed does not chain from the local head", () => {
  const table = newTable();
  at(table, ANN).report(act<CoinflipAction>({ t: "call", side: "heads" }));
  const frame0 = table.sealed.get(0)!;
  driveFrame(table, playHeads);
  const frame1 = table.sealed.get(1)!;

  const target = recording(ANN);
  target.session.receive({ kind: "frame", frame: frame0 });
  expect(target.session.frame).toBe(frameIndex(1));

  // A forged seed must not throw out of `receive` and must not advance the head.
  const forged: Frame<CoinflipAction> = { ...frame1, seed: genesisSeed("not-the-chain") };
  expect(() => target.session.receive({ kind: "frame", frame: forged })).not.toThrow();
  expect(target.session.frame).toBe(frameIndex(1));

  target.session.receive({ kind: "frame", frame: frame1 });
  expect(target.session.frame).toBe(frameIndex(2));
});

test("receive drops a frame whose inputs do not match the owed seats", () => {
  const table = newTable();
  at(table, ANN).report(act<CoinflipAction>({ t: "call", side: "heads" }));
  const frame0 = table.sealed.get(0)!;
  driveFrame(table, playHeads);
  const frame1 = table.sealed.get(1)!;

  const target = recording(ANN);
  target.session.receive({ kind: "frame", frame: frame0 });

  const truncated: Frame<CoinflipAction> = { ...frame1, inputs: frame1.inputs.slice(0, 2) };
  expect(() => target.session.receive({ kind: "frame", frame: truncated })).not.toThrow();
  expect(target.session.frame).toBe(frameIndex(1));
});

test("view redacts hidden state", () => {
  const table = newTable();
  const annView = at(table, ANN).view();
  const bobView = at(table, BOB).view();

  expect(annView.mySecret).not.toBe(bobView.mySecret);
  expect(JSON.stringify(annView)).not.toContain(String(bobView.mySecret));
  expect(Object.keys(annView)).not.toContain("pendingCoin");
  for (const player of annView.players) {
    expect(Object.keys(player)).toEqual(["seat", "coins"]);
  }
});

test("tick fills idle for a silent local seat after the timeout", () => {
  const clock = fakeClock();
  const table = makeTable(coinflip, {
    seats: SEATS,
    setup: SETUP,
    seed: SEED,
    clock: clock.clock,
    timeoutMs: 1000,
  });
  const frame0 = at(table, ANN).frame;
  at(table, ANN).tick();
  expect(at(table, ANN).frame).toBe(frame0);
  clock.advance(1000);
  at(table, ANN).tick();
  expect(at(table, ANN).frame).toBe(frameIndex(1));
});

test("remainingMs counts down to the same deadline tick acts on", () => {
  const clock = fakeClock();
  const table = makeTable(coinflip, {
    seats: SEATS,
    setup: SETUP,
    seed: SEED,
    clock: clock.clock,
    timeoutMs: 1000,
  });
  const ann = at(table, ANN);
  expect(ann.remainingMs()).toBe(1000);
  clock.advance(400);
  expect(ann.remainingMs()).toBe(600);
  clock.advance(600);
  // The deadline is reached; tick fills idle for the local seat in the same step.
  expect(ann.remainingMs()).toBe(0);
  ann.tick();
  expect(ann.frame).toBe(frameIndex(1));
});

test("remainingMs is null for a seat the open frame does not owe", () => {
  const table = newTable();
  // Frame 0 is the caller-only window; only ANN is owed, so only ANN has a clock.
  expect(at(table, ANN).remainingMs()).toBe(1000);
  expect(at(table, BOB).remainingMs()).toBeNull();
});

test("remainingMs is null once the local seat has reported in an open frame", () => {
  const table = newTable();
  at(table, ANN).report(act<CoinflipAction>({ t: "call", side: "heads" }));
  // Frame 1 is the stake window, owed by every seat, and ANN owes it too.
  expect(at(table, ANN).frame).toBe(frameIndex(1));
  expect(at(table, ANN).remainingMs()).toBe(1000);
  at(table, ANN).report(act<CoinflipAction>({ t: "stake" }));
  // ANN has reported, so its clock is done even though the frame is still open.
  expect(at(table, ANN).frame).toBe(frameIndex(1));
  expect(at(table, ANN).remainingMs()).toBeNull();
});

test("snapshot round-trips through the codec and decodes back", () => {
  const table = newTable();
  at(table, ANN).report(act<CoinflipAction>({ t: "call", side: "heads" }));
  const snapshot = at(table, ANN).snapshot();
  const resumed = resumeSession(
    {
      game: coinflip,
      port: nullPort<CoinflipAction>(),
      clock: fakeClock().clock,
      config: { seat: ANN, inputTimeoutMs: 1000 },
    },
    snapshot,
  );
  expect(resumed.view()).toEqual(at(table, ANN).view());
  expect(resumed.snapshot().frame).toBe(snapshot.frame);
});

test("an all-resign session with an empty owed set throws instead of spinning", () => {
  const table = newTable();
  at(table, ANN).report(act<CoinflipAction>({ t: "call", side: "heads" }));
  // Frame 1 is the stake window, owed by all three seats.
  expect(at(table, ANN).owed()).toEqual(SEATS);
  // Everyone resigns. The last report seals the frame into a non-terminal state
  // that owes nobody — a contract violation the session surfaces immediately
  // rather than sealing empty frames forever and spinning the index.
  at(table, ANN).report(resign<CoinflipAction>());
  at(table, BOB).report(resign<CoinflipAction>());
  expect(() => at(table, CARA).report(resign<CoinflipAction>())).toThrow(SessionError);
  expect(at(table, ANN).terminal).toBe(false);
  expect(() => at(table, ANN).owed()).toThrow(SessionError);
  expect(() => at(table, ANN).tick()).toThrow(SessionError);
});

test("a forged frame buffered ahead does not throw out of an unrelated receive", () => {
  const table = newTable();
  for (let guard = 0; guard < 20 && table.sealed.size < 3; guard += 1) {
    driveFrame(table, playHeads);
  }
  const frame0 = table.sealed.get(0)!;
  const frame1 = table.sealed.get(1)!;
  const frame2 = table.sealed.get(2)!;
  const forged2: Frame<CoinflipAction> = { ...frame2, seed: genesisSeed("forged") };

  const lagging = recording(ANN);
  lagging.session.receive({ kind: "frame", frame: frame0 });
  lagging.session.receive({ kind: "frame", frame: forged2 }); // buffered ahead

  // Closing the gap drains the forged frame; it is dropped, not thrown.
  expect(() => lagging.session.receive({ kind: "frame", frame: frame1 })).not.toThrow();
  expect(lagging.session.frame).toBe(frameIndex(2));

  // The genuine frame 2 still applies afterwards.
  lagging.session.receive({ kind: "frame", frame: frame2 });
  expect(lagging.session.frame).toBe(frameIndex(3));
});

test("a terminal peer seals no trailing empty frame; peers end on the same frame", () => {
  const table = newTable();
  driveToTerminal(table);

  // A terminal peer must not seal a vacuously-complete (empty-owed) frame, which
  // would advance its frame index past its peers.
  const frames = [...table.sealed.keys()].sort((a, b) => a - b);
  for (const frame of table.sealed.values()) {
    expect(frame.inputs.length).toBeGreaterThan(0);
  }
  const ends = SEATS.map((seat) => at(table, seat).frame);
  expect(new Set(ends).size).toBe(1);
  expect(ends[0]).toBe(frames[frames.length - 1]! + 1);
  // A terminal peer also declines to seal when prodded again.
  at(table, ANN).tick();
  expect(at(table, ANN).frame).toBe(ends[0]);
  expect(table.sealed.size).toBe(frames.length);
});

test("a frame more than MAX_PENDING_AHEAD ahead is dropped, not buffered", () => {
  // A long, non-terminating game so the frame index can climb past the bound.
  const setup = { rounds: 500 };
  const table = makeTable(coinflip, {
    seats: SEATS,
    setup,
    seed: SEED,
    clock: fakeClock().clock,
  });
  const target = MAX_PENDING_AHEAD + 2;
  // Idle everywhere: no coins change, so the game does not terminate early.
  for (let guard = 0; guard < 200 && table.sealed.size < target + 1; guard += 1) {
    driveFrame(table, () => null);
  }
  expect(table.sealed.size).toBeGreaterThan(target);
  const far = table.sealed.get(target)!;

  const lagging = recordingSession(coinflip, {
    seats: SEATS,
    setup,
    seed: SEED,
    clock: fakeClock().clock,
    seat: ANN,
  });
  // Too far ahead: dropped rather than held.
  lagging.session.receive({ kind: "frame", frame: far });
  // Deliver the whole prefix; if `far` had been buffered it would apply now and
  // push the frame past `target`.
  for (let i = 0; i < target; i += 1) {
    lagging.session.receive({ kind: "frame", frame: table.sealed.get(i)! });
  }
  expect(lagging.session.frame).toBe(frameIndex(target));
});
