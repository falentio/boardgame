import type { Room } from "./room-domain.ts";

export type StartOutcome = { kind: "unavailable" } | { kind: "started"; gameId: string };

export const startGame = (room: Room): StartOutcome => {
  void room;
  return { kind: "unavailable" };
};
