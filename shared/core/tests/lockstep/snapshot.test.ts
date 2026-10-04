import { expect, test } from "vitest";
import {
  act,
  decodeRoster,
  decodeSnapshot,
  encodeRoster,
  encodeSnapshot,
  expectObject,
  expectedSnapshotSeed,
  frameIndex,
  genesisSeed,
  makeRoster,
  replayFromGenesis,
  resumeSession,
  seatId,
  SessionError,
  SnapshotError,
  withResigned,
  type Frame,
  type Json,
  type SeatId,
} from "../../index.ts";
import {
  coinflip,
  type CoinflipAction,
  type CoinflipView,
} from "../../lockstep/games/coinflip.ts";
import { at, fakeClock, makeTable, nullPort, type Table } from "./harness.ts";

const SEATS = [seatId("ann"), seatId("bob"), seatId("cara")] as const;
const ANN = SEATS[0];
const BOB = SEATS[1];
const SEED = genesisSeed("lockstep-load-tests");
const SETUP = { rounds: 3 };

const newTable = (): Table<CoinflipAction, CoinflipView> =>
  makeTable(coinflip, { seats: SEATS, setup: SETUP, seed: SEED, clock: fakeClock().clock });

const play = (table: Table<CoinflipAction, CoinflipView>, rounds: number): void => {
  for (let round = 0; round < rounds; round += 1) {
    const frame = at(table, ANN).frame;
    for (const seat of at(table, ANN).owed()) {
      const session = at(table, seat);
      if (session.frame !== frame) continue;
      const view = session.view();
      if (view.phase === "call") session.report(act<CoinflipAction>({ t: "call", side: "heads" }));
      else session.report(act<CoinflipAction>({ t: "stake" }));
    }
  }
};

const deps = (seat: SeatId) => ({
  game: coinflip,
  port: nullPort<CoinflipAction>(),
  clock: fakeClock().clock,
  config: { seat, inputTimeoutMs: 1000 },
});

test("snapshot encodes and decodes losslessly, then resumes to the same view", () => {
  const table = newTable();
  play(table, 2);
  const snapshot = at(table, ANN).snapshot();

  const json = encodeSnapshot(coinflip, snapshot);
  const decoded = decodeSnapshot(coinflip, json);
  expect(decoded.frame).toBe(snapshot.frame);
  expect(decoded.seed).toBe(snapshot.seed);
  expect(decoded.head).toEqual(snapshot.head);

  const resumed = resumeSession(deps(ANN), decoded);
  expect(resumed.view()).toEqual(at(table, ANN).view());
});

test("resumeSession, replayFromGenesis, and the live session agree", () => {
  const table = newTable();
  play(table, 2);

  const log = {
    gameId: coinflip.id,
    base: frameIndex(0),
    frames: [...table.sealed.keys()]
      .sort((a, b) => a - b)
      .map((index) => table.sealed.get(index) as Frame<CoinflipAction>),
  };
  const replayed = replayFromGenesis(
    coinflip,
    { seed: SEED, roster: makeRoster(SEATS), setup: SETUP },
    log,
  );
  expect(replayed.frame).toBe(at(table, ANN).frame);

  const resumed = resumeSession(deps(ANN), at(table, ANN).snapshot());
  expect(resumed.view()).toEqual(at(table, ANN).view());
});

/** Narrow an encoded snapshot to its object form for tampering in tests. */
const asObject = (json: Json): { readonly [key: string]: Json } => expectObject(json, "snapshot");

test("decodeSnapshot rejects a mismatched game id", () => {
  const table = newTable();
  const json = encodeSnapshot(coinflip, at(table, ANN).snapshot());
  const tampered: Json = { ...asObject(json), gameId: "something-else" };
  expect(() => decodeSnapshot(coinflip, tampered)).toThrow(SnapshotError);
});

test("decodeSnapshot rejects a snapshot whose state fails the game codec", () => {
  const table = newTable();
  const json = encodeSnapshot(coinflip, at(table, ANN).snapshot());
  const broken: Json = { ...asObject(json), state: { not: "a coinflip state" } };
  expect(() => decodeSnapshot(coinflip, broken)).toThrow();
});

test("decodeSnapshot rejects a snapshot whose seed is tampered", () => {
  const table = newTable();
  play(table, 2);
  const json = encodeSnapshot(coinflip, at(table, ANN).snapshot());
  const tampered: Json = { ...asObject(json), seed: genesisSeed("not-the-chain") };
  expect(() => decodeSnapshot(coinflip, tampered)).toThrow(SnapshotError);
});

test("decodeSnapshot rejects a headless snapshot that claims a non-zero frame", () => {
  const table = newTable();
  const json = encodeSnapshot(coinflip, at(table, ANN).snapshot());
  // The genesis snapshot has no head; a frame > 0 with no head is impossible.
  const tampered: Json = { ...asObject(json), frame: 1 };
  expect(() => decodeSnapshot(coinflip, tampered)).toThrow(SnapshotError);
});

test("resumeSession rejects a snapshot whose seed is tampered", () => {
  const table = newTable();
  play(table, 2);
  const snapshot = at(table, ANN).snapshot();
  const tampered = { ...snapshot, seed: genesisSeed("not-the-chain") };
  expect(() => resumeSession(deps(ANN), tampered)).toThrow(SessionError);
});

test("a stale inbound snapshot does not rewind a live session", () => {
  const table = newTable();
  play(table, 2);
  const live = resumeSession(deps(ANN), at(table, ANN).snapshot());
  const ahead = live.frame;
  expect(ahead).toBeGreaterThan(0);

  // Build an older snapshot at frame 0 and offer it to the live session.
  const stale = encodeSnapshot(coinflip, at(table, ANN).snapshot());
  const rewound = { ...decodeSnapshot(coinflip, stale), frame: frameIndex(0), head: null };
  expect(() => live.receive({ kind: "snapshot", snapshot: rewound })).not.toThrow();
  expect(live.frame).toBe(ahead);
});

test("a same-frame snapshot with a divergent state is rejected loudly", () => {
  const table = newTable();
  play(table, 2);
  const snapshot = at(table, ANN).snapshot();
  const live = resumeSession(deps(ANN), snapshot);

  // Build a snapshot that is internally self-consistent (its seed chains from
  // its head over its own state) but describes a *different* state at the same
  // frame. This is a silent fork: it must be rejected, not adopted.
  const decoded = decodeSnapshot(coinflip, encodeSnapshot(coinflip, snapshot));
  const state = coinflip.state.decode(decoded.state);
  const divergentState = { ...state, round: state.round + 100 };
  const divergent = {
    ...decoded,
    state: coinflip.state.encode(divergentState),
    seed: expectedSnapshotSeed(coinflip, decoded.head!, divergentState),
  };
  expect(divergent.seed).not.toBe(snapshot.seed);
  expect(() => live.receive({ kind: "snapshot", snapshot: divergent })).toThrow(SessionError);
  // The live session is untouched.
  expect(live.view()).toEqual(at(table, ANN).view());
});

test("decodeRoster round-trips a valid roster losslessly, including a resigned seat", () => {
  const roster = withResigned(makeRoster(SEATS), SEATS[1]);
  const decoded = decodeRoster(encodeRoster(roster));
  expect(decoded.order).toEqual(roster.order);
  for (const seat of roster.order) {
    expect(decoded.status.get(seat)).toBe(roster.status.get(seat));
  }
  // The re-encode is byte-identical: the round trip loses nothing.
  expect(encodeRoster(decoded)).toEqual(encodeRoster(roster));
});

test("encodeRoster refuses to fabricate a status for a seat the roster omits", () => {
  // A roster whose status map is missing a seat must not silently encode that
  // seat as "active"; the missing-means-active default is not a round trip.
  const partial = {
    order: SEATS,
    status: new Map<SeatId, "active" | "resigned">([[ANN, "active"]]),
  };
  expect(() => encodeRoster(partial)).toThrow(SnapshotError);
});

test("decodeRoster rejects an empty order", () => {
  expect(() => decodeRoster({ order: [], status: [] })).toThrow(SnapshotError);
});

test("decodeRoster rejects a duplicate seat in the order", () => {
  expect(() =>
    decodeRoster({
      order: [ANN, ANN],
      status: [
        [ANN, "active"],
        [ANN, "active"],
      ],
    }),
  ).toThrow(SnapshotError);
});

test("decodeRoster rejects a status entry for a seat outside the order", () => {
  expect(() =>
    decodeRoster({
      order: [ANN],
      status: [
        [ANN, "active"],
        [BOB, "active"],
      ],
    }),
  ).toThrow(SnapshotError);
});

test("decodeRoster rejects a status that does not cover every seat in the order", () => {
  expect(() =>
    decodeRoster({
      order: [ANN, BOB],
      status: [[ANN, "active"]],
    }),
  ).toThrow(SnapshotError);
});
