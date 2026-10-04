import type { ChangeReason, RoomEvents } from "../../../../shared/rooms/events.ts";
import type { Room } from "../../../../shared/rooms/room.ts";

export interface RecordedChange {
  readonly room: Room;
  readonly reason: ChangeReason;
}

export interface RecordingEvents {
  readonly events: RoomEvents;
  readonly changes: RecordedChange[];
}

export const recordingEvents = (): RecordingEvents => {
  const changes: RecordedChange[] = [];
  return {
    changes,
    events: {
      changed: async (room, reason) => {
        changes.push({ room, reason });
      },
    },
  };
};

export const throwingEvents = (error: Error): RoomEvents => ({
  changed: async () => {
    throw error;
  },
});
