import { expect, test } from "vitest";
import { roomCode } from "../../../shared/rooms/ids.ts";
import type { GameEnvelope } from "../../../shared/game/events.ts";
import type { RoomChannelClient } from "../useRoomChannel.ts";
import { bindGameChannel, createGameChannel } from "../game-channel.ts";

const CODE = roomCode("BAVOKUTI");

interface FakeChannel {
  readonly name: string;
  readonly handlers: Map<string, (data: unknown) => void>;
}

interface FakeClient extends RoomChannelClient {
  readonly subscribed: string[];
  readonly unsubscribed: string[];
  readonly connectionHandlers: Map<string, () => void>;
  emit(event: string, data: unknown): void;
  emitConnection(event: string): void;
}

const fakeClient = (): FakeClient => {
  const subscribed: string[] = [];
  const unsubscribed: string[] = [];
  const channels = new Map<string, FakeChannel>();
  const connectionHandlers = new Map<string, () => void>();

  return {
    subscribed,
    unsubscribed,
    connectionHandlers,
    subscribe(name) {
      subscribed.push(name);
      const channel: FakeChannel = { name, handlers: new Map() };
      channels.set(name, channel);
      return {
        bind(event, handler) {
          channel.handlers.set(event, handler);
        },
        unbind(event) {
          channel.handlers.delete(event);
        },
      };
    },
    unsubscribe(name) {
      unsubscribed.push(name);
      channels.delete(name);
    },
    connection: {
      bind(event, handler) {
        connectionHandlers.set(event, handler);
      },
      unbind(event) {
        connectionHandlers.delete(event);
      },
    },
    emit(event, data) {
      for (const channel of channels.values()) {
        channel.handlers.get(event)?.(data);
      }
    },
    emitConnection(event) {
      connectionHandlers.get(event)?.();
    },
  };
};

test("binds game on the private game channel and forwards messages", () => {
  const client = fakeClient();
  const messages: unknown[] = [];
  const teardown = bindGameChannel({
    client,
    code: CODE,
    handlers: { onMessage: (data) => messages.push(data), onConnected: () => {} },
  });

  expect(client.subscribed).toEqual(["private-game-BAVOKUTI"]);
  client.emit("game", { v: 1, body: { kind: "sync" } });
  expect(messages).toEqual([{ v: 1, body: { kind: "sync" } }]);

  teardown();
  expect(client.unsubscribed).toEqual(["private-game-BAVOKUTI"]);
});

test("fires onConnected on every connect, including the first", () => {
  const client = fakeClient();
  let connected = 0;
  bindGameChannel({
    client,
    code: CODE,
    handlers: { onMessage: () => {}, onConnected: () => (connected += 1) },
  });

  client.emitConnection("connected");
  client.emitConnection("connected");
  expect(connected).toBe(2);
});

test("teardown unbinds the connection hook", () => {
  const client = fakeClient();
  let connected = 0;
  const teardown = bindGameChannel({
    client,
    code: CODE,
    handlers: { onMessage: () => {}, onConnected: () => (connected += 1) },
  });

  teardown();
  client.emitConnection("connected");
  expect(connected).toBe(0);
  expect(client.connectionHandlers.size).toBe(0);
});

test("createGameChannel publishes through the injected send", () => {
  const client = fakeClient();
  const sent: GameEnvelope[] = [];
  const channel = createGameChannel({ client, code: CODE, send: (envelope) => sent.push(envelope) });

  const teardown = channel.subscribe({ onMessage: () => {}, onConnected: () => {} });
  channel.publish({ v: 1, body: { kind: "sync" } });
  expect(sent).toEqual([{ v: 1, body: { kind: "sync" } }]);

  teardown();
  expect(client.unsubscribed).toEqual(["private-game-BAVOKUTI"]);
});
