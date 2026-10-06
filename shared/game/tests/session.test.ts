import { expect, test } from "vitest";
import {
  act,
  genesisSeed,
  makeRoster,
  seatId,
  type GameDefinition,
  type GenesisInput,
  type SeatId,
} from "../../core/lockstep/index.ts";
import { STARTER_ROLES } from "../../core/lockstep/games/g54/roles.ts";
import { g54, type G54Action, type G54Setup, type G54State, type G54View } from "../../core/lockstep/games/g54/index.ts";
import type { GameChannel, GameChannelHandlers } from "../session.ts";
import { openGameSession } from "../session.ts";
import { encodeMessage } from "../protocol.ts";

const ANN = seatId("ann");
const BOB = seatId("bob");
const SETUP: G54Setup = { roles: STARTER_ROLES };

const genesis = (entropy: string): GenesisInput<G54Setup> => ({
  seed: genesisSeed(entropy),
  roster: makeRoster([ANN, BOB]),
  setup: SETUP,
});

interface Peer {
  readonly handlers: GameChannelHandlers;
}

const makeBus = () => {
  const peers = new Map<string, Peer>();
  const channel = (id: string): GameChannel => ({
    subscribe(handlers) {
      peers.set(id, { handlers });
      return () => {
        peers.delete(id);
      };
    },
    publish(envelope) {
      for (const [peerId, peer] of peers) {
        if (peerId !== id) peer.handlers.onMessage(envelope);
      }
    },
  });
  const connect = (id: string): void => {
    peers.get(id)?.handlers.onConnected();
  };
  return { channel, connect };
};

const open = (
  id: string,
  game: GameDefinition<G54State, G54Action, G54Setup, G54View>,
  bus: ReturnType<typeof makeBus>,
  onError?: (error: Error) => void,
) =>
  openGameSession({
    game,
    channel: bus.channel(id),
    seat: id === "ann" ? ANN : BOB,
    genesis: genesis("game-session-tests"),
    clock: { now: () => 0 },
    onError,
  });

test("two peers built from the same genesis converge after both report", () => {
  const bus = makeBus();
  const ann = open("ann", g54, bus);
  const bob = open("bob", g54, bus);
  bus.connect("ann");
  bus.connect("bob");

  ann.session.report(act<G54Action>({ t: "income" }));
  bob.session.report(act<G54Action>({ t: "pass" }));

  expect(ann.session.frame).toBe(bob.session.frame);
  expect(ann.session.view().players).toEqual(bob.session.view().players);
  expect(ann.session.view().active).toBe(bob.session.view().active);
});

test("a divergent snapshot is contained and surfaced through onError", () => {
  const bus = makeBus();
  const errors: Error[] = [];
  const ann = open("ann", g54, bus, (error) => errors.push(error));
  const bob = open("bob", g54, bus);
  bus.connect("ann");
  bus.connect("bob");

  const divergent = openGameSession({
    game: g54,
    channel: { subscribe: () => () => {}, publish: () => {} },
    seat: ANN,
    genesis: genesis("game-session-other-seed"),
    clock: { now: () => 0 },
  });
  bus.channel("bob").publish(
    encodeMessage(g54, { kind: "snapshot", snapshot: divergent.session.snapshot() }),
  );

  expect(errors).toHaveLength(1);
  expect(ann.session.frame).toBe(0);
});

test("a sync from a fresh peer is answered with a snapshot and adopted", () => {
  const bus = makeBus();
  const ann = open("ann", g54, bus);
  const bob = open("bob", g54, bus);
  bus.connect("ann");
  bus.connect("bob");

  ann.session.report(act<G54Action>({ t: "income" }));
  bob.session.report(act<G54Action>({ t: "pass" }));
  expect(ann.session.frame).toBe(2);

  const fresh = open("fresh", g54, bus);
  bus.connect("fresh");

  expect(fresh.session.frame).toBe(ann.session.frame);
  expect(fresh.session.view().players).toEqual(ann.session.view().players);
});
