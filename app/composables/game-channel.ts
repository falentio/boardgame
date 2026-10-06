import {
  GAME_EVENT,
  gameChannel,
  type GameChannel,
  type GameChannelHandlers,
  type GameEnvelope,
} from "#shared/game/index.ts";
import type { RoomCode } from "#shared/rooms/ids.ts";
import type { RoomChannelClient } from "./useRoomChannel.ts";

export const bindGameChannel = (deps: {
  readonly client: RoomChannelClient;
  readonly code: RoomCode;
  readonly handlers: GameChannelHandlers;
}): (() => void) => {
  const name = gameChannel(deps.code);
  const channel = deps.client.subscribe(name);

  channel.bind(GAME_EVENT, deps.handlers.onMessage);
  channel.bind("pusher:subscription_succeeded", deps.handlers.onConnected);

  return () => {
    channel.unbind(GAME_EVENT, deps.handlers.onMessage);
    channel.unbind("pusher:subscription_succeeded", deps.handlers.onConnected);
    deps.client.unsubscribe(name);
  };
};

export const createGameChannel = (deps: {
  readonly client: RoomChannelClient;
  readonly code: RoomCode;
  readonly send?: (envelope: GameEnvelope) => void;
}): GameChannel => {
  const send = deps.send ?? ((envelope: GameEnvelope): void => postEnvelope(deps.code, envelope));
  return {
    subscribe(handlers) {
      return bindGameChannel({ client: deps.client, code: deps.code, handlers });
    },
    publish(envelope) {
      send(envelope);
    },
  };
};

const postEnvelope = (code: RoomCode, envelope: GameEnvelope): void => {
  void $fetch(`/api/rooms/${code}/game`, { method: "POST", body: envelope }).catch(() => {});
};
