import Pusher from "pusher-js";
import {
  ROOM_CHANGED,
  roomChannel,
  type ChangeReason,
  type RoomChangedSignal,
} from "#shared/rooms/events.ts";
import type { RoomCode } from "#shared/rooms/ids.ts";

export interface RoomChannel {
  bind(event: string, handler: (data: unknown) => void): void;
  unbind(event: string, handler: (data: unknown) => void): void;
}

export interface RoomChannelConnection {
  bind(event: string, handler: () => void): void;
  unbind(event: string, handler: () => void): void;
}

export interface RoomChannelClient {
  subscribe(name: string): RoomChannel;
  unsubscribe(name: string): void;
  connection: RoomChannelConnection;
}

export interface RoomChannelConfig {
  readonly key: string;
  readonly host: string;
}

export type RoomChangeHandler = (signal?: RoomChangedSignal) => void;

export interface RoomChannelOptions {
  readonly createClient?: (config: RoomChannelConfig) => RoomChannelClient;
}

const isChangeReason = (value: unknown): value is ChangeReason =>
  value === "created" || value === "joined" || value === "updated" || value === "deleted";

const signalFrom = (code: RoomCode, data: unknown): RoomChangedSignal | null => {
  if (typeof data !== "object" || data === null || !("reason" in data)) return null;
  return isChangeReason(data.reason) ? { code, reason: data.reason } : null;
};

export const bindRoomChannel = (deps: {
  readonly client: RoomChannelClient;
  readonly code: RoomCode;
  readonly onChange: RoomChangeHandler;
}): (() => void) => {
  const name = roomChannel(deps.code);
  const channel = deps.client.subscribe(name);

  const onEvent = (data: unknown): void => {
    const signal = signalFrom(deps.code, data);
    if (signal !== null) deps.onChange(signal);
  };
  channel.bind(ROOM_CHANGED, onEvent);

  let dropped = false;
  const onDisconnected = (): void => {
    dropped = true;
  };
  const onConnected = (): void => {
    if (!dropped) return;
    dropped = false;
    deps.onChange();
  };
  deps.client.connection.bind("disconnected", onDisconnected);
  deps.client.connection.bind("connected", onConnected);

  return () => {
    channel.unbind(ROOM_CHANGED, onEvent);
    deps.client.connection.unbind("disconnected", onDisconnected);
    deps.client.connection.unbind("connected", onConnected);
    deps.client.unsubscribe(name);
  };
};

export const connectRoomChannel = async (deps: {
  readonly createClient: () => RoomChannelClient | Promise<RoomChannelClient>;
  readonly code: RoomCode;
  readonly onChange: RoomChangeHandler;
}): Promise<() => void> => {
  const client = await deps.createClient();
  return bindRoomChannel({ client, code: deps.code, onChange: deps.onChange });
};

const singleton = (): ((create: () => RoomChannelClient) => Promise<RoomChannelClient>) => {
  let client: Promise<RoomChannelClient> | null = null;
  return (create) => {
    client ??= Promise.resolve().then(create);
    return client;
  };
};

const sharedClient = singleton();

const createPusherClient = (config: RoomChannelConfig): RoomChannelClient =>
  new Pusher(config.key, {
    wsHost: config.host,
    httpHost: config.host,
    forceTLS: true,
    // pusher-js requires a cluster even when wsHost overrides the endpoint.
    cluster: "",
    enabledTransports: ["ws"],
    enableStats: false,
    authEndpoint: "/api/pusher/auth",
  });

const pusherConfigFrom = (value: unknown): RoomChannelConfig | null => {
  if (typeof value !== "object" || value === null) return null;
  const key = "key" in value ? value.key : undefined;
  const host = "host" in value ? value.host : undefined;
  if (typeof key !== "string" || typeof host !== "string" || !key || !host) return null;
  return { key, host };
};

export const useRoomChannel = (
  code: RoomCode,
  onChange: RoomChangeHandler,
  opts: RoomChannelOptions = {},
): void => {
  if (!import.meta.client) return;
  const config = pusherConfigFrom(useRuntimeConfig().public.pusher);
  if (config === null) return;
  const createClient = opts.createClient ?? createPusherClient;
  let teardown: (() => void) | null = null;

  onMounted(async () => {
    teardown = await connectRoomChannel({
      createClient: () => sharedClient(() => createClient(config)),
      code,
      onChange,
    });
  });

  onUnmounted(() => {
    teardown?.();
    teardown = null;
  });
};
