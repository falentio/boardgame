import { ROOM_CHANGED, roomChannel, type RoomEvents } from "../../../shared/rooms/events.ts";
import { pusherPublisher, type PusherConfig } from "../realtime/pusher.ts";

export const pusherRoomEvents = (config: PusherConfig): RoomEvents => {
  const publish = pusherPublisher(config);
  return {
    changed: (room, reason) =>
      publish(roomChannel(room.code), ROOM_CHANGED, { code: room.code, reason }),
  };
};
