import { GAME_EVENT, gameChannel, type GameEvents } from "../../../shared/game/events.ts";
import { pusherPublisher, type PusherConfig } from "../realtime/pusher.ts";

export const pusherGameEvents = (config: PusherConfig): GameEvents => {
  const publish = pusherPublisher(config);
  return {
    published: (code, envelope) => publish(gameChannel(code), GAME_EVENT, envelope),
  };
};
