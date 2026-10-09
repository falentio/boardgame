import { expect, test } from "vitest";
import {
  act,
  deadline,
  genesisSeed,
  makeRoster,
  seatId,
  type GameDefinition,
  type GenesisInput,
  type SeatId,
} from "../../core/lockstep/index.ts";
import { STARTER_ROLES } from "../../core/lockstep/games/g54/roles.ts";
import {
  g54,
  type G54Action,
  type G54Setup,
  type G54State,
  type G54View,
} from "../../core/lockstep/games/g54/index.ts";
import type { GameChannel, GameChannelHandlers, SyncState } from "../session.ts";
import { openGameSession } from "../session.ts";
import { decodeMessage, encodeMessage } from "../protocol.ts";
import { fakeClock } from "../../core/tests/lockstep/harness.ts";

const ANN = seatId("ann");
const BOB = seatId("bob");
const SETUP: G54Setup = { roles: STARTER_ROLES };

const genesis = (entropy: string): GenesisInput<G54Setup> => ({
  seed: genesisSeed(entropy),
  roster: makeRoster([ANN, BOB]),
  setup: SETUP,
  startedAt: deadline(0),
});

/** The turn budget, compressed so the whole scenario runs in a fast test. */
const BUDGET = 400;
/** The app drives the deadline check this often; see useGame's TICK_MS. */
const TICK = 16;

interface Client {
  readonly seat: SeatId;
  readonly session: ReturnType<typeof openGameSession>;
  /** Every envelope this client published, in order. */
  readonly published: unknown[];
  /** A frozen tab runs no JS: nothing is delivered to it and nothing ticks it. */
  frozen: boolean;
  readonly inbox: unknown[];
  readonly syncTimeline: SyncState[];
  readonly handlers: GameChannelHandlers;
}

/**
 * A two-peer room over a bus that can freeze one client, on one shared clock.
 * Delivering to a frozen tab queues, exactly as a socket buffer does for a tab
 * whose JS has stopped.
 */
const makeRoom = (latencySteps = 0) => {
  const clients = new Map<SeatId, Client>();
  const clock = fakeClock();
  /** Envelopes in flight, so a checkpoint costs a round trip like the real one. */
  const inFlight: { at: number; to: Client; envelope: unknown }[] = [];
  let stepCount = 0;

  const deliver = (client: Client, envelope: unknown): void => {
    if (latencySteps === 0) {
      client.handlers.onMessage(envelope);
      return;
    }
    inFlight.push({ at: stepCount + latencySteps, to: client, envelope });
  };

  const flushDue = (): void => {
    for (let i = inFlight.length - 1; i >= 0; i--) {
      if (inFlight[i]!.at > stepCount) continue;
      const item = inFlight.splice(i, 1)[0]!;
      item.to.handlers.onMessage(item.envelope);
    }
  };

  const publish = (from: Client, envelope: unknown): void => {
    from.published.push(envelope);
    for (const client of clients.values()) {
      if (client.seat === from.seat) continue;
      if (client.frozen) {
        client.inbox.push(envelope);
        continue;
      }
      deliver(client, envelope);
    }
  };

  const connect = (seat: SeatId): void => {
    const client = clients.get(seat);
    if (client === undefined) throw new Error("no client for seat");
    // Pusher replaying the subscription is what a reconnect delivers.
    client.handlers.onConnected();
  };

  const join = (seat: SeatId): Client => {
    const record: Client = {
      seat,
      published: [],
      frozen: false,
      inbox: [],
      syncTimeline: [],
      handlers: undefined as unknown as GameChannelHandlers,
    } as Client;
    const channel: GameChannel = {
      subscribe: (handlers: GameChannelHandlers): (() => void) => {
        record.handlers = handlers;
        return () => {};
      },
      publish: (envelope): void => publish(record, envelope),
    } as GameChannel;
    record.session = openGameSession<unknown, G54Action, G54Setup, G54View>({
      game: g54,
      channel,
      seat,
      genesis: genesis("inactive-tab"),
      clock: clock.clock,
      inputTimeoutMs: BUDGET,
    });
    clients.set(seat, record);
    return record;
  };

  /** One step of the room: the app's tick, then the clock. */
  const step = (): void => {
    stepCount += 1;
    flushDue();
    for (const client of clients.values()) {
      if (client.frozen) continue;
      client.session.tick();
      client.syncTimeline.push(client.session.sync);
    }
    clock.advance(TICK);
  };

  return { clients, clock, join, step, connect };
};

/**
 * A short gap closes on its own: the frames the room published while this tab
 * was away are still in its pending buffer, so it needs no checkpoint at all.
 */
test("a short inactivity closes on the backlog and nobody else notices", () => {
  const room = makeRoom();
  const ann = room.join(ANN);
  const bob = room.join(BOB);
  room.connect(ANN);
  room.connect(BOB);
  playTo(room, ann, bob, 6);

  const publishedBeforeFreeze = ann.published.length;
  const bobFrameBefore = bob.session.session.frame;

  ann.frozen = true;
  for (let i = 0; i < 2 * BUDGET; i += TICK) room.step();

  // The frozen tab asked for nothing, because it ran no code at all.
  expect(ann.published).toHaveLength(publishedBeforeFreeze);

  ann.frozen = false;
  drainInbox(ann);
  room.step();

  // The backlog folded, so this client is back on the agreed chain and never
  // needed a checkpoint or a reload.
  expect(ann.session.sync).toBe("live");
  expect(ann.session.session.frame).toBe(bob.session.session.frame);
  expect(ann.session.session.view().players).toEqual(bob.session.session.view().players);
  expect(
    ann.published.slice(publishedBeforeFreeze).filter((e) => decodeMessage(g54, e)?.kind === "sync"),
  ).toHaveLength(0);
  expect(bob.session.sync).toBe("live");
});

/**
 * A long gap cannot: the frames that would close it are beyond the session's
 * pending buffer and have already gone by. This is the tab that must resync,
 * and it must do so alone and without a reload.
 */
test("a long inactivity resyncs that tab alone, in the background", () => {
  const room = makeRoom(3);
  const ann = room.join(ANN);
  const bob = room.join(BOB);
  room.connect(ANN);
  room.connect(BOB);
  playTo(room, ann, bob, 6);

  const publishedBeforeFreeze = ann.published.length;
  const bobFrameBefore = bob.session.session.frame;

  ann.frozen = true;
  for (let i = 0; i < 16 * BUDGET; i += TICK) room.step();

  // Bob kept playing the whole time. Nothing asked him for anything, and his
  // own chain never moved sideways.
  expect(bob.session.sync).toBe("live");
  expect(bob.session.session.frame).toBeGreaterThan(bobFrameBefore);
  expect(ann.published).toHaveLength(publishedBeforeFreeze);

  // ann comes back. Her clock has jumped past many budgets, so she cannot carry
  // and the frames that would bridge the gap have already gone by.
  ann.frozen = false;
  dropWindow(ann);
  drainInbox(ann);
  room.step();

  // She says she is catching up instead of telling anyone to reload, and she
  // asks exactly once.
  expect(ann.session.sync).toBe("resyncing");
  expect(
    ann.published.slice(publishedBeforeFreeze).filter((e) => decodeMessage(g54, e)?.kind === "sync"),
  ).toHaveLength(1);

  // Bob answered. He never entered a resync, and the frame he agreed before the
  // freeze is still behind him: he was never rewound.
  expect(bob.session.sync).toBe("live");
  const bobHeadBeforeResync = bob.session.session.snapshot().head;
  expect(bobHeadBeforeResync).not.toBeNull();

  // She catches up on her own.
  for (let i = 0; i < 120; i++) room.step();

  expect(ann.session.sync).toBe("live");
  expect(ann.session.session.frame).toBe(bob.session.session.frame);
  expect(ann.session.session.view().players).toEqual(bob.session.session.view().players);
  expect(ann.session.session.view().active).toBe(bob.session.session.view().active);

  // Bob's head is still his own: the checkpoint he answered with did not
  // replace his chain.
  const bobHeadAfter = bob.session.session.snapshot().head;
  expect(bob.syncTimeline.every((state) => state === "live")).toBe(true);
  expect(bobHeadAfter!.index).toBeGreaterThanOrEqual(bobHeadBeforeResync!.index);

  // Her own timeline shows the loading state and then the automatic exit, which
  // is exactly what the UI renders.
  expect(ann.syncTimeline).toContain("resyncing");
  expect(ann.syncTimeline.at(-1)).toBe("live");
});
/**
 * A window the tab never received. A tab that stopped running loses its
 * socket, so the frames published across the gap are gone rather than queued,
 * and the log can no longer be bridged frame by frame.
 */
const dropWindow = (client: Client): void => {
  // The socket is down for the whole inactive period, so what comes back is only
  // the tail. Everything the room published while it was away is gone.
  client.inbox.splice(0, Math.floor(client.inbox.length * 0.6));
};

const drainInbox = (client: Client): void => {
  for (const envelope of client.inbox.splice(0)) client.handlers.onMessage(envelope);
};

const playTo = (
  room: ReturnType<typeof makeRoom>,
  ann: Client,
  bob: Client,
  frame: number,
): void => {
  for (let i = 0; i < 4000 && ann.session.session.frame < frame; i++) {
    for (const client of [ann, bob].filter((c) => !c.frozen)) {
      const owed = client.session.session.owed();
      if (!owed.includes(client.seat)) continue;
      const view = client.session.session.view();
      const action: G54Action =
        view.active === client.seat
          ? ({ t: "income" } as G54Action)
          : ({ t: "pass" } as G54Action);
      client.session.session.report(act<G54Action>(action));
    }
    room.step();
  }
};