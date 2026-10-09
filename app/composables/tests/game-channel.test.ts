import { expect, test } from "vitest";
import { roomCode } from "../../../shared/rooms/ids.ts";
import type { GameEnvelope } from "../../../shared/game/events.ts";
import type { RoomChannelClient } from "../useRoomChannel.ts";
import { bindGameChannel, createGameChannel } from "../game-channel.ts";

const CODE = roomCode("BAWOLUTI");

interface FakeChannel {
  readonly name: string;
  readonly handlers: Map<string, (data: unknown) => void>;
}

interface FakeClient extends RoomChannelClient {
  readonly subscribed: string[];
  readonly unsubscribed: string[];
  emit(event: string, data?: unknown): void;
}

const fakeClient = (): FakeClient => {
  const subscribed: string[] = [];
  const unsubscribed: string[] = [];
  const channels = new Map<string, FakeChannel>();

  return {
    subscribed,
    unsubscribed,
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
      bind() {},
      unbind() {},
    },
    emit(event, data) {
      for (const channel of channels.values()) {
        channel.handlers.get(event)?.(data);
      }
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

  expect(client.subscribed).toEqual(["private-game-BAWOLUTI"]);
  client.emit("game", { v: 1, body: { kind: "sync" } });
  expect(messages).toEqual([{ v: 1, body: { kind: "sync" } }]);

  teardown();
  expect(client.unsubscribed).toEqual(["private-game-BAWOLUTI"]);
});

test("fires onConnected when the channel subscription succeeds", () => {
  const client = fakeClient();
  let connected = 0;
  bindGameChannel({
    client,
    code: CODE,
    handlers: { onMessage: () => {}, onConnected: () => (connected += 1) },
  });

  client.emit("pusher:subscription_succeeded");
  client.emit("pusher:subscription_succeeded");
  expect(connected).toBe(2);
});

test("teardown unbinds the subscription hook", () => {
  const client = fakeClient();
  let connected = 0;
  const teardown = bindGameChannel({
    client,
    code: CODE,
    handlers: { onMessage: () => {}, onConnected: () => (connected += 1) },
  });

  teardown();
  client.emit("pusher:subscription_succeeded");
  expect(connected).toBe(0);
});

test("createGameChannel publishes through the injected send", () => {
  const client = fakeClient();
  const sent: GameEnvelope[] = [];
  const channel = createGameChannel({ client, code: CODE, send: (envelope) => sent.push(envelope) });

  const teardown = channel.subscribe({ onMessage: () => {}, onConnected: () => {} });
  channel.publish({ v: 1, body: { kind: "sync" } });
  expect(sent).toEqual([{ v: 1, body: { kind: "sync" } }]);

  teardown();
  expect(client.unsubscribed).toEqual(["private-game-BAWOLUTI"]);
});
