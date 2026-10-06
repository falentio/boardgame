import { expect, test } from "vitest";
import {
  act,
  buildFrame,
  createSession,
  frameIndex,
  genesisSeed,
  idle,
  makeRoster,
  resign,
  seatId,
  type SeatId,
  type SeatInput,
  type SessionPort,
} from "../../core/lockstep/index.ts";
import { STARTER_ROLES } from "../../core/lockstep/games/g54/roles.ts";
import { g54, type G54Action } from "../../core/lockstep/games/g54/index.ts";
import { encodeMessage, decodeMessage, type GameMessage } from "../protocol.ts";

const SEATS = [seatId("ann"), seatId("bob"), seatId("cara")] as const;
const ANN = SEATS[0];
const SEED = genesisSeed("game-protocol-tests");
const SETUP = { roles: STARTER_ROLES };

const nullPort = (): SessionPort<G54Action> => ({
  sendReport: (): void => undefined,
  send: (): void => undefined,
  sendSnapshot: (): void => undefined,
});

const session = () =>
  createSession(
    { game: g54, port: nullPort(), clock: { now: () => 0 }, config: { seat: ANN, inputTimeoutMs: 1000 } },
    { seed: SEED, roster: makeRoster(SEATS), setup: SETUP },
  );

const roundTrip = (message: GameMessage<G54Action>): GameMessage<G54Action> | null =>
  decodeMessage(g54, encodeMessage(g54, message));

test("round-trips a report", () => {
  const message: GameMessage<G54Action> = {
    kind: "report",
    report: { frame: frameIndex(2), seat: ANN, input: act<G54Action>({ t: "income" }) },
  };
  expect(roundTrip(message)).toEqual(message);
});

test("round-trips every seat input kind", () => {
  const inputs: SeatInput<G54Action>[] = [
    act<G54Action>({ t: "claim", role: "banker", target: null }),
    idle<G54Action>(),
    resign<G54Action>(),
  ];
  for (const input of inputs) {
    const message: GameMessage<G54Action> = {
      kind: "report",
      report: { frame: frameIndex(0), seat: ANN, input },
    };
    expect(roundTrip(message)).toEqual(message);
  }
});

test("round-trips a frame", () => {
  const buffer = new Map<SeatId, SeatInput<G54Action>>([
    [SEATS[0], act<G54Action>({ t: "income" })],
    [SEATS[1], idle<G54Action>()],
    [SEATS[2], resign<G54Action>()],
  ]);
  const frame = buildFrame(makeRoster(SEATS), SEATS, frameIndex(3), SEED, buffer);
  const message: GameMessage<G54Action> = { kind: "frame", frame };
  expect(roundTrip(message)).toEqual(message);
});

test("round-trips a snapshot", () => {
  const snapshot = session().snapshot();
  const message: GameMessage<G54Action> = { kind: "snapshot", snapshot };
  expect(roundTrip(message)).toEqual(message);
});

test("round-trips a sync", () => {
  expect(roundTrip({ kind: "sync" })).toEqual({ kind: "sync" });
});

test("returns null for a non-envelope, wrong version, or unknown kind", () => {
  expect(decodeMessage(g54, 42)).toBeNull();
  expect(decodeMessage(g54, null)).toBeNull();
  expect(decodeMessage(g54, { v: 2, body: { kind: "sync" } })).toBeNull();
  expect(decodeMessage(g54, { v: 1, body: { kind: "bogus" } })).toBeNull();
  expect(decodeMessage(g54, { v: 1 })).toBeNull();
});

test("returns null for a hostile body without throwing", () => {
  expect(decodeMessage(g54, { v: 1, body: { kind: "report" } })).toBeNull();
  expect(decodeMessage(g54, { v: 1, body: { kind: "report", report: { frame: 0, seat: ANN } } })).toBeNull();
  expect(
    decodeMessage(g54, {
      v: 1,
      body: {
        kind: "report",
        report: { frame: 0, seat: ANN, input: { k: "act", a: { t: "not-an-action" } } },
      },
    }),
  ).toBeNull();
  expect(
    decodeMessage(g54, { v: 1, body: { kind: "frame", frame: { index: -1, seed: SEED, inputs: [] } } }),
  ).toBeNull();
  expect(decodeMessage(g54, { v: 1, body: { kind: "snapshot", snapshot: {} } })).toBeNull();
});
