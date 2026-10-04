import { expect, test } from "vitest";
import { roomCode } from "../../../shared/rooms/ids.ts";
import type { RoomChangedSignal } from "../../../shared/rooms/events.ts";
import {
  bindRoomChannel,
  connectRoomChannel,
  type RoomChannelClient,
} from "../useRoomChannel.ts";

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

test("binds room-changed on the private channel and forwards the parsed signal", () => {
  const client = fakeClient();
  const signals: (RoomChangedSignal | undefined)[] = [];
  const teardown = bindRoomChannel({ client, code: CODE, onChange: (s) => signals.push(s) });

  expect(client.subscribed).toEqual(["private-room-BAVOKUTI"]);
  client.emit("room-changed", { code: "BAVOKUTI", reason: "joined" });
  expect(signals).toEqual([{ code: "BAVOKUTI", reason: "joined" }]);

  teardown();
  expect(client.unsubscribed).toEqual(["private-room-BAVOKUTI"]);
});

test("ignores a payload that is not a valid signal", () => {
  const client = fakeClient();
  const signals: (RoomChangedSignal | undefined)[] = [];
  bindRoomChannel({ client, code: CODE, onChange: (s) => signals.push(s) });

  client.emit("room-changed", { reason: "bogus" });
  client.emit("room-changed", null);
  expect(signals).toEqual([]);
});

test("fires one resync on reconnected, after a disconnect, and not before", () => {
  const client = fakeClient();
  const signals: (RoomChangedSignal | undefined)[] = [];
  bindRoomChannel({ client, code: CODE, onChange: (s) => signals.push(s) });

  client.emitConnection("connected");
  expect(signals).toEqual([]);

  client.emitConnection("disconnected");
  client.emitConnection("connected");
  expect(signals).toEqual([undefined]);

  client.emitConnection("connected");
  expect(signals).toEqual([undefined]);
});

test("connectRoomChannel subscribes only after the guarded client resolves", async () => {
  const client = fakeClient();
  let created = 0;
  const teardown = await connectRoomChannel({
    createClient: () => {
      created += 1;
      return client;
    },
    code: CODE,
    onChange: () => {},
  });

  expect(created).toBe(1);
  expect(client.subscribed).toEqual(["private-room-BAVOKUTI"]);
  teardown();
  expect(client.unsubscribed).toEqual(["private-room-BAVOKUTI"]);
});
