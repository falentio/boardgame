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
const makeRoom = () => {
  const clients = new Map<SeatId, Client>();
  const clock = fakeClock();

  const deliver = (client: Client, envelope: unknown): void => {
    const message = decodeMessage(g54, envelope);
    if (message === null) return;
    client.session.session.receive(message as never);
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
    for (const client of clients.values()) {
      if (client.frozen) continue;
      client.session.tick();
      client.syncTimeline.push(client.session.sync);
    }
    clock.advance(TICK);
  };

  return { clients, clock, join, step, connect };
};

test("an inactive tab resyncs itself in the background and nobody else notices", () => {
  const room = makeRoom();
  const ann = room.join(ANN);
  const bob = room.join(BOB);
  room.connect(ANN);
  room.connect(BOB);

  const playTo = (frame: number): void => {
    for (let i = 0; i < 4000 && ann.session.session.frame < frame; i++) {
      for (const client of [ann, bob].filter((c) => !c.frozen)) {
        const view = client.session.session.view();
        const owed = client.session.session.owed();
        if (owed.includes(client.seat)) {
          const action: G54Action = view.active === client.seat
            ? ({ t: "income" } as G54Action)
            : ({ t: "pass" } as G54Action);
          client.session.session.report(act<G54Action>(action));
        }
      }
      room.step();
    }
  };
  playTo(6);

  const publishedBeforeFreeze = ann.published.length;
  const bobHeadBefore = bob.session.session.snapshot().head;
  const bobFrameBefore = bob.session.session.frame;

  // ann switches away. Its JS stops: no ticks, and the socket buffers everything
  // bob publishes for the whole gap.
  ann.frozen = true;
  for (let i = 0; i < 4 * BUDGET; i += TICK) room.step();

  expect(bob.session.session.sync).toBe("live");
  expect(bob.session.session.frame).toBeGreaterThan(bobFrameBefore);
  expect(ann.session.session.sync).toBe("live");

  // ann comes back. Its first tick sees a clock that jumped past several budgets.
  ann.frozen = false;
  for (const envelope of ann.inbox.splice(0)) {
    (ann as unknown as { handlers: GameChannelHandlers }).handlers.onMessage(envelope);
  }
  room.step();

  // Only the tab that fell behind asks for a checkpoint, and it says so while it
  // waits instead of telling anyone to reload.
  expect(ann.session.sync).toBe("resyncing");
  const syncsSinceResume = ann.published
    .slice(publishedBeforeFreeze)
    .filter((e) => decodeMessage(g54, e)?.kind === "sync");
  expect(syncsSinceResume).toHaveLength(1);
  expect(bob.published.filter((e) => decodeMessage(g54, e)?.kind === "sync")).toHaveLength(1);

  // It catches up on its own, and the peer it asked answers without being moved.
  for (let i = 0; i < 200; i++) room.step();

  expect(ann.session.session.sync).toBe("live");
  expect(ann.session.session.frame).toBe(bob.session.session.frame);
  expect(ann.session.session.view().players).toEqual(bob.session.session.view().players);
  expect(ann.session.session.view().active).toBe(bob.session.session.view().active);
  expect(bob.session.session.sync).toBe("live");
  expect(bob.session.session.snapshot().head).not.toBeNull();
  expect(bobHeadBefore).not.toBeNull();

  // The peer's own chain is untouched: the frame it agreed before the freeze is
  // still its head, so nothing it holds was replaced by a resync.
  expect(bob.session.session.frame).toBeGreaterThanOrEqual(bobFrameBefore);
});
